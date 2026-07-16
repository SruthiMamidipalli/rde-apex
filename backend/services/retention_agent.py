"""Retention Agent Service — orchestrates the full AI workflow:

    score -> analyze drivers -> generate offer -> generate brief -> outreach

Uses the ModelRouter for cost-optimized model selection (Sonnet for reasoning,
Haiku for content). When Bedrock is unavailable (or a call fails after retry),
each step falls back to deterministic generation so the demo is always fully
populated. Deterministic output is engineered to satisfy the same correctness
properties as the AI path (offer-type mapping, tier monotonicity, character
limits, personalization).
"""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone

from config import settings
from models.domain import (
    ChurnAnalysis,
    ChurnDriver,
    ChurnScoreResult,
    CustomerProfile,
    CustomerTier,
    OutreachContent,
    RetentionBrief,
    RetentionOffer,
    RetentionWorkflowResult,
    RiskLevel,
)
from services.model_router import ModelRouter
from services.scoring_engine import ChurnScoreEngine

logger = logging.getLogger(__name__)

# Tier -> base offer magnitude (0-100). Monotonic in tier rank.
_TIER_VALUE = {
    CustomerTier.BRONZE: 30.0,
    CustomerTier.SILVER: 50.0,
    CustomerTier.GOLD: 70.0,
    CustomerTier.PLATINUM: 90.0,
}
# Risk adds a bounded bump so higher risk => more generous (never crosses tiers).
_RISK_BUMP = {
    RiskLevel.LOW: 0.0,
    RiskLevel.MEDIUM: 3.0,
    RiskLevel.HIGH: 6.0,
    RiskLevel.CRITICAL: 9.0,
}

_CATEGORY_OFFER = {
    "transaction": "discount",
    "engagement": "exclusive_access",
    "support": "service_recovery",
}


def _load_prompt(name: str) -> str:
    path = settings.PROMPTS_DIR / f"{name}.txt"
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        logger.warning("Prompt file missing: %s", path)
        return ""


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response."""
    text = text.strip()
    # Strip markdown fences if present.
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


class RetentionAgentService:
    def __init__(self, router: ModelRouter, scoring: ChurnScoreEngine):
        self.router = router
        self.scoring = scoring

    # ================================================================== #
    # Full workflow
    # ================================================================== #
    def run_retention_workflow(
        self, customer: CustomerProfile, score: ChurnScoreResult
    ) -> RetentionWorkflowResult:
        start = time.perf_counter()
        degraded = not self.router.available

        analysis = self.analyze_churn_drivers(customer, score)
        offer = self.generate_offer(customer, analysis, score)
        brief = self.generate_brief(customer, score, analysis, offer)
        outreach = self.generate_outreach(customer, offer, score)

        elapsed = time.perf_counter() - start
        return RetentionWorkflowResult(
            workflow_id=f"wf_{uuid.uuid4().hex[:12]}",
            customer_id=customer.customer_id,
            score=score,
            analysis=analysis,
            offer=offer,
            brief=brief,
            outreach=outreach,
            elapsed_seconds=round(elapsed, 3),
            completed_at=datetime.now(timezone.utc),
            degraded=degraded,
        )

    # Representative token counts per task (used to populate the cost panel in
    # degraded mode so the demo shows realistic multi-model routing savings).
    _SIM_TOKENS = {
        "analyze_churn_drivers": (900, 380),
        "generate_offer": (450, 180),
        "generate_brief": (1100, 320),
        "generate_outreach": (300, 260),
    }

    def _invoke_with_retry(self, task: str, system: str, user: str, max_tokens: int) -> dict | None:
        """Invoke via router with one retry. Returns None on failure -> fallback."""
        if not self.router.available:
            in_tok, out_tok = self._SIM_TOKENS.get(task, (400, 200))
            self.router.record_simulated_usage(task, in_tok, out_tok)
            return None
        for attempt in range(2):
            try:
                return self.router.invoke(task, system, user, max_tokens=max_tokens)
            except Exception as exc:  # noqa: BLE001
                logger.warning("%s attempt %d failed: %s", task, attempt + 1, exc)
                time.sleep(2 if attempt == 0 else 0)
        logger.error("%s failed after retry; using deterministic fallback", task)
        return None

    # ================================================================== #
    # Step 1: analyze churn drivers
    # ================================================================== #
    def analyze_churn_drivers(
        self, customer: CustomerProfile, score: ChurnScoreResult
    ) -> ChurnAnalysis:
        user_msg = json.dumps(
            {
                "customer": {"name": customer.name, "tier": customer.tier.value},
                "composite_score": score.composite_score,
                "risk_level": score.risk_level.value,
                "signal_contributions": [c.model_dump() for c in score.signal_contributions],
                "raw_signals": customer.signals.model_dump(mode="json"),
            },
            default=str,
        )
        result = self._invoke_with_retry(
            "analyze_churn_drivers", _load_prompt("analyze_drivers"), user_msg, 1500
        )
        if result:
            try:
                data = _extract_json(result["content"])
                drivers = [
                    ChurnDriver(
                        driver=d["driver"],
                        source_system=d["source_system"],
                        evidence=d["evidence"],
                        severity=d.get("severity", "medium"),
                    )
                    for d in data.get("drivers", [])
                ]
                if drivers:
                    return ChurnAnalysis(
                        customer_id=customer.customer_id,
                        drivers=drivers,
                        summary=data.get("summary", ""),
                        dominant_category=data.get("dominant_category", "transaction"),
                        generated_at=datetime.now(timezone.utc),
                    )
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                logger.error("Failed to parse analysis response: %s", exc)

        return self._fallback_analysis(customer, score)

    def _dominant_category(self, score: ChurnScoreResult) -> str:
        """Determine dominant churn category from the top weighted contribution."""
        if not score.signal_contributions:
            return "transaction"
        top = max(score.signal_contributions, key=lambda c: c.weighted_contribution)
        source_to_cat = {
            "shopify": "transaction",
            "yotpo": "transaction",
            "salesforce": "engagement",
            "klaviyo": "engagement",
            "google_analytics": "engagement",
            "zendesk": "support",
        }
        return source_to_cat.get(top.source, "transaction")

    def _fallback_analysis(
        self, customer: CustomerProfile, score: ChurnScoreResult
    ) -> ChurnAnalysis:
        # Top 3 contributing signals become drivers.
        top = sorted(
            score.signal_contributions,
            key=lambda c: c.weighted_contribution,
            reverse=True,
        )[:3]
        source_label = {
            "shopify": "Shopify",
            "salesforce": "Salesforce",
            "zendesk": "Zendesk",
            "google_analytics": "Google Analytics",
            "yotpo": "Yotpo",
            "klaviyo": "Klaviyo",
        }
        drivers = [
            ChurnDriver(
                driver=c.signal_name,
                source_system=source_label.get(c.source, c.source),
                evidence=f"{c.signal_name} normalized risk {c.normalized_score:.0f}/100 "
                f"(weighted {c.weighted_contribution:.1f} pts) [{source_label.get(c.source, c.source)}]",
                severity="high" if c.normalized_score >= 66 else "medium" if c.normalized_score >= 33 else "low",
            )
            for c in top
        ]
        cat = self._dominant_category(score)
        summary = (
            f"{customer.name} has a composite churn score of {score.composite_score:.0f} "
            f"({score.risk_level.value}). The dominant risk category is {cat}, driven by "
            f"{', '.join(d.driver for d in drivers)}."
        )
        return ChurnAnalysis(
            customer_id=customer.customer_id,
            drivers=drivers,
            summary=summary,
            dominant_category=cat,
            generated_at=datetime.now(timezone.utc),
        )

    # ================================================================== #
    # Step 2: generate offer
    # ================================================================== #
    def generate_offer(
        self,
        customer: CustomerProfile,
        analysis: ChurnAnalysis,
        score: ChurnScoreResult,
    ) -> RetentionOffer:
        # Deterministic value floor guarantees tier-monotonicity regardless of AI text.
        base_value = _TIER_VALUE[customer.tier] + _RISK_BUMP[score.risk_level]
        offer_type = _CATEGORY_OFFER.get(analysis.dominant_category, "discount")

        user_msg = json.dumps(
            {
                "customer_name": customer.name,
                "tier": customer.tier.value,
                "risk_level": score.risk_level.value,
                "dominant_category": analysis.dominant_category,
                "drivers": [d.model_dump() for d in analysis.drivers],
                "required_offer_type": offer_type,
            }
        )
        result = self._invoke_with_retry(
            "generate_offer", _load_prompt("generate_offer"), user_msg, 800
        )
        if result:
            try:
                data = _extract_json(result["content"])
                conf = float(data.get("confidence_score", 70))
                conf = max(0.0, min(100.0, conf))
                return RetentionOffer(
                    offer_id=f"offer_{uuid.uuid4().hex[:10]}",
                    customer_id=customer.customer_id,
                    # Enforce category->type mapping deterministically for correctness.
                    offer_type=offer_type,
                    description=data.get("description", ""),
                    value=data.get("value", ""),
                    value_score=round(base_value, 2),
                    matched_signal=data.get("matched_signal", analysis.dominant_category),
                    confidence_score=conf,
                    tier_justification=data.get("tier_justification", ""),
                )
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                logger.error("Failed to parse offer response: %s", exc)

        return self._fallback_offer(customer, analysis, score, offer_type, base_value)

    def _fallback_offer(
        self,
        customer: CustomerProfile,
        analysis: ChurnAnalysis,
        score: ChurnScoreResult,
        offer_type: str,
        base_value: float,
    ) -> RetentionOffer:
        tier = customer.tier
        # Human-readable value scaled by tier.
        if offer_type == "discount":
            pct = {CustomerTier.BRONZE: 10, CustomerTier.SILVER: 15,
                   CustomerTier.GOLD: 20, CustomerTier.PLATINUM: 25}[tier]
            value = f"{pct}% off your next order"
            desc = f"A {pct}% discount to win back {customer.name.split()[0]}'s next purchase."
        elif offer_type == "exclusive_access":
            perk = {CustomerTier.BRONZE: "early-access previews",
                    CustomerTier.SILVER: "a members-only collection",
                    CustomerTier.GOLD: "a VIP early-access event",
                    CustomerTier.PLATINUM: "a private concierge shopping session"}[tier]
            value = f"Exclusive access to {perk}"
            desc = f"Re-engage {customer.name.split()[0]} with {perk}."
        elif offer_type == "service_recovery":
            comp = {CustomerTier.BRONZE: "priority support + $10 credit",
                    CustomerTier.SILVER: "priority support + $25 credit",
                    CustomerTier.GOLD: "dedicated support + $50 credit",
                    CustomerTier.PLATINUM: "a dedicated account manager + $100 credit"}[tier]
            value = comp
            desc = f"Service recovery for {customer.name.split()[0]}: {comp}."
        else:  # bonus_points
            pts = {CustomerTier.BRONZE: 1000, CustomerTier.SILVER: 2500,
                   CustomerTier.GOLD: 5000, CustomerTier.PLATINUM: 10000}[tier]
            value = f"{pts:,} bonus loyalty points"
            desc = f"{pts:,} bonus points to reactivate {customer.name.split()[0]}."

        # Confidence: higher for clearer/dominant signals, bounded [0,100].
        confidence = min(100.0, 55.0 + score.composite_score * 0.35)
        matched = analysis.drivers[0].driver if analysis.drivers else analysis.dominant_category
        return RetentionOffer(
            offer_id=f"offer_{uuid.uuid4().hex[:10]}",
            customer_id=customer.customer_id,
            offer_type=offer_type,
            description=desc,
            value=value,
            value_score=round(base_value, 2),
            matched_signal=matched,
            confidence_score=round(confidence, 1),
            tier_justification=f"{tier.value} tier customer — offer scaled to tier value "
            f"and {score.risk_level.value} risk level.",
        )

    # ================================================================== #
    # Step 3: generate brief
    # ================================================================== #
    def generate_brief(
        self,
        customer: CustomerProfile,
        score: ChurnScoreResult,
        analysis: ChurnAnalysis,
        offer: RetentionOffer,
    ) -> RetentionBrief:
        user_msg = json.dumps(
            {
                "customer": {"name": customer.name, "tier": customer.tier.value,
                             "email": customer.email},
                "composite_score": score.composite_score,
                "risk_level": score.risk_level.value,
                "signal_breakdown": [c.model_dump() for c in score.signal_contributions],
                "analysis": analysis.model_dump(mode="json"),
                "offer": offer.model_dump(),
                "raw_signals": customer.signals.model_dump(mode="json"),
            },
            default=str,
        )
        result = self._invoke_with_retry(
            "generate_brief", _load_prompt("generate_brief"), user_msg, 1200
        )
        summary = comparison = strategy = None
        if result:
            try:
                data = _extract_json(result["content"])
                summary = data.get("customer_summary")
                comparison = data.get("historical_comparison")
                strategy = data.get("outreach_strategy")
            except (ValueError, json.JSONDecodeError) as exc:
                logger.error("Failed to parse brief response: %s", exc)

        if not summary:
            summary = (
                f"{customer.name} is a {customer.tier.value}-tier customer "
                f"(member since {customer.join_date.date()}). Composite churn score "
                f"{score.composite_score:.0f} places them at {score.risk_level.value} risk."
            )
        if not comparison:
            comparison = self._fallback_comparison(customer, score)
        if not strategy:
            tone = {"CRITICAL": "Immediate, high-touch outreach within 24h.",
                    "HIGH": "Warm proactive outreach within 48h.",
                    "MEDIUM": "Friendly re-engagement within the week.",
                    "LOW": "Light appreciation touch, low urgency."}[score.risk_level.value]
            strategy = (
                f"{tone} Lead with the {offer.offer_type.replace('_', ' ')} offer "
                f"({offer.value}) across email, then SMS follow-up."
            )

        return RetentionBrief(
            brief_id=f"brief_{uuid.uuid4().hex[:10]}",
            customer_id=customer.customer_id,
            customer_summary=summary,
            risk_classification=score.risk_level,
            churn_score=score.composite_score,
            signal_breakdown=score.signal_contributions,
            historical_comparison=comparison,
            recommended_offer=offer,
            outreach_strategy=strategy,
            generated_at=datetime.now(timezone.utc),
        )

    def _fallback_comparison(self, customer: CustomerProfile, score: ChurnScoreResult) -> str:
        s = customer.signals
        parts = []
        if s.google_analytics:
            parts.append(
                f"Sessions moved from {s.google_analytics.sessions_prev_30d} to "
                f"{s.google_analytics.sessions_30d} per 30 days "
                f"({s.google_analytics.session_change_pct:+.0f}%) [Google Analytics]"
            )
        if s.shopify:
            parts.append(
                f"Average order value changed {s.shopify.aov_change_pct:+.0f}% "
                f"with {s.shopify.order_count_30d} orders in 30 days [Shopify]"
            )
        if s.klaviyo:
            parts.append(
                f"Email open rate at {s.klaviyo.email_open_rate * 100:.0f}% [Klaviyo]"
            )
        if not parts:
            return "Insufficient historical signal data for baseline comparison."
        return "; ".join(parts) + "."

    # ================================================================== #
    # Step 4: multi-channel outreach
    # ================================================================== #
    def generate_outreach(
        self,
        customer: CustomerProfile,
        offer: RetentionOffer,
        score: ChurnScoreResult,
    ) -> dict[str, OutreachContent]:
        user_msg = json.dumps(
            {
                "customer_name": customer.name,
                "tier": customer.tier.value,
                "risk_level": score.risk_level.value,
                "offer": {"type": offer.offer_type, "value": offer.value,
                          "description": offer.description},
            }
        )
        result = self._invoke_with_retry(
            "generate_outreach", _load_prompt("generate_outreach"), user_msg, 900
        )
        content: dict[str, OutreachContent] | None = None
        if result:
            try:
                data = _extract_json(result["content"])
                content = self._parse_outreach(data, customer, offer)
            except (ValueError, KeyError, json.JSONDecodeError) as exc:
                logger.error("Failed to parse outreach response: %s", exc)
                content = None

        if content is None:
            content = self._fallback_outreach(customer, offer, score)

        # Enforce hard constraints defensively on whatever we produced.
        return self._enforce_constraints(content, customer, offer)

    def _parse_outreach(self, data: dict, customer, offer) -> dict[str, OutreachContent]:
        email = data.get("email", {})
        sms = data.get("sms", {})
        push = data.get("push", {})
        return {
            "email": OutreachContent(
                channel="email",
                subject=email.get("subject", ""),
                body=email.get("body", ""),
                call_to_action=email.get("call_to_action", "Shop now"),
            ),
            "sms": OutreachContent(channel="sms", body=sms.get("body", "")),
            "push": OutreachContent(
                channel="push", title=push.get("title", ""), body=push.get("body", "")
            ),
        }

    def _fallback_outreach(self, customer, offer, score) -> dict[str, OutreachContent]:
        first = customer.name.split()[0]
        val = offer.value
        urgency = {"CRITICAL": "We don't want to lose you.",
                   "HIGH": "We've missed you.",
                   "MEDIUM": "A little something for you.",
                   "LOW": "Thanks for being with us."}[score.risk_level.value]
        return {
            "email": OutreachContent(
                channel="email",
                subject=f"{first}, {val} — just for you",
                body=(
                    f"Hi {first},\n\n{urgency} As a valued {customer.tier.value} member, "
                    f"we'd like to offer you {val}. {offer.description}\n\n"
                    f"We'd love to see you again soon."
                ),
                call_to_action="Claim your offer",
            ),
            "sms": OutreachContent(
                channel="sms",
                body=f"Hi {first}, {customer.tier.value} exclusive: {val}. Claim now: {{link}}",
            ),
            "push": OutreachContent(
                channel="push",
                title=f"{first}, {val}"[:50],
                body=f"Your {customer.tier.value} offer is waiting: {val}"[:100],
            ),
        }

    def _enforce_constraints(self, content, customer, offer) -> dict[str, OutreachContent]:
        first = customer.name.split()[0]

        def ensure_personal(text: str) -> str:
            t = text or ""
            if first not in t:
                t = f"{first}: {t}".strip()
            # Reference offer value if missing.
            if offer.value and offer.value not in t:
                t = f"{t} ({offer.value})".strip()
            return t

        # Email
        email = content["email"]
        email.body = ensure_personal(email.body)
        if not email.subject:
            email.subject = f"{first}, {offer.value}"
        if not email.call_to_action:
            email.call_to_action = "Claim your offer"
        email.character_count = len(email.body)

        # SMS: ensure personal + link, then hard-truncate to 160.
        sms = content["sms"]
        sms.body = ensure_personal(sms.body)
        if "{link}" not in sms.body and "http" not in sms.body:
            sms.body = f"{sms.body} {{link}}"
        if len(sms.body) > 160:
            # Trim while keeping the link token.
            sms.body = sms.body[:156].rstrip() + " {link}" if "{link}" not in sms.body[:156] else sms.body[:160]
            sms.body = sms.body[:160]
        sms.character_count = len(sms.body)

        # Push: enforce title <=50, body <=100, personalization.
        push = content["push"]
        if not push.title:
            push.title = f"{first}, a gift for you"
        if first not in push.title and first not in (push.body or ""):
            push.title = f"{first}: {push.title}"
        push.title = push.title[:50]
        push.body = (push.body or f"Your offer: {offer.value}")
        if offer.value and offer.value not in push.body and offer.value not in push.title:
            push.body = f"{offer.value} — {push.body}"
        push.body = push.body[:100]
        push.character_count = len(push.body)

        return content
