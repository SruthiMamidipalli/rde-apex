"""Application orchestrator — wires all services together and owns the
end-to-end retention pipeline plus agentic trigger logic.

This is the single composition root used by both the REST API and the MCP
server, so both surfaces share one in-memory state (scores, workflows,
approvals, audit trail, model-usage log).
"""

from __future__ import annotations

import logging

from config import settings
from models.domain import (
    ChurnScoreResult,
    CustomerProfile,
    RetentionWorkflowResult,
    RiskLevel,
)
from services.approval_service import ApprovalService
from services.audit_service import AuditService
from services.data_loader import DataLoaderService
from services.model_router import ModelRouter
from services.retention_agent import RetentionAgentService
from services.scoring_engine import ChurnScoreEngine

logger = logging.getLogger(__name__)


def _build_bedrock_client():
    """Construct an AnthropicBedrock client, or return None for degraded mode."""
    if not settings.bedrock_available:
        logger.warning("Bedrock unavailable — running in DEGRADED (deterministic) mode.")
        return None
    try:
        from anthropic import AnthropicBedrock

        kwargs = {"aws_region": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID:
            kwargs["aws_access_key"] = settings.AWS_ACCESS_KEY_ID
        if settings.AWS_SECRET_ACCESS_KEY:
            kwargs["aws_secret_key"] = settings.AWS_SECRET_ACCESS_KEY
        if settings.AWS_SESSION_TOKEN:
            kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN
        return AnthropicBedrock(**kwargs)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to init Bedrock client (%s); degraded mode.", exc)
        return None


class Orchestrator:
    def __init__(self):
        self.data_loader = DataLoaderService()
        self.scoring = ChurnScoreEngine()
        self.router = ModelRouter(_build_bedrock_client())
        self.agent = RetentionAgentService(self.router, self.scoring)
        self.audit = AuditService()
        self.approvals = ApprovalService(self.audit)

        # customer_id -> latest score / workflow.
        self._scores: dict[str, ChurnScoreResult] = {}
        self._workflows: dict[str, RetentionWorkflowResult] = {}

        # KPI + chatbot services (constructed lazily to avoid import cycles).
        from services.kpi_service import KpiService
        from services.chatbot_service import ChatbotService

        self.kpi = KpiService(self)
        self.chatbot = ChatbotService(self, self.kpi)

    # ------------------------------------------------------------------ #
    @property
    def degraded(self) -> bool:
        return not self.router.available

    # --- Scoring ------------------------------------------------------ #
    def score_customer(self, customer_id: str) -> ChurnScoreResult | None:
        profile = self.data_loader.get_customer(customer_id)
        if profile is None:
            return None
        result = self.scoring.calculate_score(customer_id, profile.signals)
        self._scores[customer_id] = result
        return result

    def get_score(self, customer_id: str) -> ChurnScoreResult | None:
        if customer_id not in self._scores:
            return self.score_customer(customer_id)
        return self._scores[customer_id]

    def score_all(self) -> dict[str, ChurnScoreResult]:
        for profile in self.data_loader.get_all_customers():
            self._scores[profile.customer_id] = self.scoring.calculate_score(
                profile.customer_id, profile.signals
            )
        return self._scores

    # --- Workflow ----------------------------------------------------- #
    def run_workflow(self, customer_id: str, submit: bool = True) -> RetentionWorkflowResult | None:
        profile = self.data_loader.get_customer(customer_id)
        if profile is None:
            return None
        score = self.get_score(customer_id)
        result = self.agent.run_retention_workflow(profile, score)
        self._workflows[customer_id] = result
        if submit:
            # time_since_signal simulates detection->delivery latency.
            self.approvals.submit_for_approval(result, time_since_signal_seconds=result.elapsed_seconds)
        return result

    def get_workflow(self, customer_id: str) -> RetentionWorkflowResult | None:
        return self._workflows.get(customer_id)

    # --- Agentic trigger / priority processing ------------------------ #
    def _ga_session_drop_trigger(self, profile: CustomerProfile) -> bool:
        """Requirement 12.2: GA session frequency drop > 40% over 14d window."""
        ga = profile.signals.google_analytics
        return ga is not None and ga.session_change_pct <= -40

    def triggered_customers(self, threshold: float | None = None) -> list[CustomerProfile]:
        """Customers that should auto-trigger the workflow, in priority order."""
        threshold = threshold if threshold is not None else settings.CHURN_THRESHOLD
        self.score_all()
        candidates: list[tuple[CustomerProfile, ChurnScoreResult]] = []
        for profile in self.data_loader.get_all_customers():
            score = self._scores[profile.customer_id]
            if score.composite_score > threshold or self._ga_session_drop_trigger(profile):
                candidates.append((profile, score))
        # Priority: CRITICAL -> HIGH -> MEDIUM -> LOW, then by score desc.
        candidates.sort(
            key=lambda pair: (pair[1].risk_level.rank, pair[1].composite_score),
            reverse=True,
        )
        return [p for p, _ in candidates]

    def run_triggered_workflows(self, threshold: float | None = None) -> list[RetentionWorkflowResult]:
        """Process all triggered customers in priority order."""
        results = []
        for profile in self.triggered_customers(threshold):
            if profile.customer_id in self._workflows:
                results.append(self._workflows[profile.customer_id])
                continue
            result = self.run_workflow(profile.customer_id, submit=True)
            if result:
                results.append(result)
        return results

    # --- Dashboard aggregates ----------------------------------------- #
    def metrics(self, threshold: float | None = None) -> dict:
        threshold = threshold if threshold is not None else settings.CHURN_THRESHOLD
        self.score_all()
        scores = list(self._scores.values())
        total = len(scores)
        at_risk = sum(1 for s in scores if s.composite_score > threshold)
        avg = round(sum(s.composite_score for s in scores) / total, 2) if total else 0.0
        dist: dict[str, int] = {r.value: 0 for r in RiskLevel}
        for s in scores:
            dist[s.risk_level.value] += 1
        counts = self.approvals.counts()
        return {
            "total_customers": total,
            "total_at_risk": at_risk,
            "average_churn_score": avg,
            "campaigns_pending": counts["pending"] + counts["escalated"],
            "campaigns_launched": counts["launched"],
            "risk_distribution": dist,
        }

    # --- Signals feed / connector health ------------------------------ #
    def signals_feed(self) -> list[dict]:
        """Real-time-style feed of threshold crossings, derived from live data."""
        self.score_all()
        src_meta = {
            "google_analytics": ("📉", "GA", "Behavioural"),
            "yotpo": ("💔", "Yotpo", "Loyalty"),
            "zendesk": ("🎫", "Zendesk", "Support"),
            "shopify": ("🛒", "Shopify", "Transactional"),
            "klaviyo": ("✉", "Klaviyo", "Engagement"),
            "salesforce": ("◎", "CRM", "Relationship"),
        }
        events: list[dict] = []
        for profile in self.data_loader.get_all_customers():
            score = self._scores[profile.customer_id]
            if score.risk_level.value not in ("HIGH", "CRITICAL"):
                continue
            top = sorted(score.signal_contributions,
                         key=lambda c: c.weighted_contribution, reverse=True)[:1]
            if not top:
                continue
            c = top[0]
            icon, tag, cat = src_meta.get(c.source, ("⚡", c.source, "Signal"))
            events.append({
                "customer_id": profile.customer_id,
                "name": profile.name,
                "icon": icon, "tag": tag, "category": cat,
                "text": f"{c.signal_name} crossed threshold — risk {c.normalized_score:.0f}/100",
                "score": score.composite_score,
                "band": score.risk_level.value,
                "boost": score.interaction_boost_applied,
            })
        events.sort(key=lambda e: e["score"], reverse=True)
        return events

    def system_health(self) -> list[dict]:
        """Live-style connector status. GA amber (recent lag), rest green."""
        # Deterministic demo state matching the reference design.
        cfg = [
            ("Salesforce", "green", "just now"),
            ("Shopify", "green", "2m ago"),
            ("Yotpo", "green", "1m ago"),
            ("Klaviyo", "amber", "15m lag"),
            ("Zendesk", "green", "3m ago"),
            ("Google Analytics", "green", "just now"),
        ]
        return [
            {"name": n, "status": s, "last_sync": t,
             "uptime_pct": 99.9 if s == "green" else 97.2}
            for n, s, t in cfg
        ]


# Singleton composition root.
orchestrator = Orchestrator()


def get_orchestrator() -> Orchestrator:
    return orchestrator
