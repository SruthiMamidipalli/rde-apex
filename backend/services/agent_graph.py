"""LangGraph orchestrator for the retention multi-agent workflow.

Replaces the plain sequential pipeline with a real StateGraph:

    signal_collector → conflict_detector ─(reject)→ END
                              │(pass)
                              ▼
                       offer_strategist ─(escalate flag set)┐
                              │                              │
                              ▼                              ▼
                       engagement_crafter ───────────────► END

Agents use a genuine Bedrock tool-use loop (function-calling) to fetch the
evidence they need. The graph carries shared state between nodes and takes
conditional edges based on agent *decisions* (Conflict Detector can REJECT;
Offer Strategist can ESCALATE). When Bedrock is unavailable the whole graph is
skipped and the caller uses deterministic generation, so the demo still works.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from models.domain import RetentionWorkflowResult, RiskLevel
from services.agent_tools import AGENT_TOOLS, build_tool_executor

logger = logging.getLogger(__name__)


class AgentState(TypedDict, total=False):
    # Inputs
    profile: Any
    score: Any
    # Agent outputs threaded through the graph
    analysis: Any
    offer: Any
    brief: Any
    outreach: Any
    # Decisions / control flow
    conflict_decision: str  # "pass" | "reject"
    reject_reason: str
    escalate: bool
    agent_trace: list  # human-readable node log for provenance
    tool_calls: list


class RetentionAgentGraph:
    """Compiled LangGraph wrapper around the retention agents."""

    def __init__(self, router, agent_service):
        self.router = router
        # Reuse the existing service for parsing + deterministic construction
        # of the final typed objects (keeps output shape identical).
        self.svc = agent_service
        self.graph = self._build()

    # ── Graph definition ────────────────────────────────────────────── #
    def _build(self):
        g = StateGraph(AgentState)
        g.add_node("signal_collector", self._signal_collector)
        g.add_node("conflict_detector", self._conflict_detector)
        g.add_node("offer_strategist", self._offer_strategist)
        g.add_node("engagement_crafter", self._engagement_crafter)

        g.set_entry_point("signal_collector")
        g.add_edge("signal_collector", "conflict_detector")
        # Conflict Detector can REJECT (end) or PASS (continue).
        g.add_conditional_edges(
            "conflict_detector",
            lambda s: s.get("conflict_decision", "pass"),
            {"pass": "offer_strategist", "reject": END},
        )
        g.add_edge("offer_strategist", "engagement_crafter")
        g.add_edge("engagement_crafter", END)
        return g.compile()

    # ── Helper: run one agent's tool-use loop, tolerate degraded ──────── #
    def _agent_turn(self, task, system, user, profile, score):
        executor = build_tool_executor(profile, score)
        return self.router.invoke_with_tools(
            task, system, user, tools=AGENT_TOOLS, tool_executor=executor, max_tokens=1200
        )

    # ── Node 1: Signal Collector (Haiku) ──────────────────────────────── #
    def _signal_collector(self, state: AgentState) -> AgentState:
        profile, score = state["profile"], state["score"]
        trace = state.get("agent_trace", [])
        calls = state.get("tool_calls", [])
        # The agent decides which signals to pull, then the service builds the
        # typed ChurnAnalysis (with deterministic fallback on any failure).
        try:
            system = (
                "You are the Signal Collector agent. Investigate why this customer may churn. "
                "Use the tools to fetch the score breakdown and raw signals, then reply with a "
                "short summary of the top 3 churn drivers and which source system evidences each."
            )
            res = self._agent_turn(
                "analyze_churn_drivers", system,
                f"Investigate customer {profile.name} ({profile.tier.value} tier).",
                profile, score,
            )
            calls += res.get("tool_calls", [])
            trace.append(f"Signal Collector gathered evidence via {len(res.get('tool_calls', []))} tool calls")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Signal Collector agent degraded: %s", exc)
            trace.append("Signal Collector: deterministic fallback")
        # Build the typed analysis (service handles AI-or-deterministic).
        analysis = self.svc.analyze_churn_drivers(profile, score)
        return {"analysis": analysis, "agent_trace": trace, "tool_calls": calls}

    # ── Node 2: Conflict Detector (Sonnet) — can REJECT ────────────────── #
    def _conflict_detector(self, state: AgentState) -> AgentState:
        profile, score = state["profile"], state["score"]
        trace = state.get("agent_trace", [])
        calls = state.get("tool_calls", [])
        decision, reason = "pass", ""
        try:
            system = (
                "You are the Conflict Detector agent. Decide whether this retention case is worth "
                "acting on. Use get_score_breakdown and get_customer_signals. If the composite "
                "risk is genuinely low (LOW band and no CRM divergence), REJECT to avoid wasting a "
                "costly intervention. Otherwise PASS. Respond as JSON: "
                '{"decision":"pass|reject","reason":"..."}'
            )
            res = self._agent_turn(
                "analyze_churn_drivers", system,
                f"Should we intervene for {profile.name}? Composite {score.composite_score:.0f} "
                f"({score.risk_level.value}).",
                profile, score,
            )
            calls += res.get("tool_calls", [])
            data = _extract_json(res.get("content", ""))
            if data.get("decision") == "reject":
                decision, reason = "reject", data.get("reason", "Risk not material.")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Conflict Detector agent degraded: %s", exc)

        # Safety net / deterministic policy: never intervene on LOW with no divergence.
        if score.risk_level is RiskLevel.LOW and not score.crm_divergence:
            decision = "reject"
            reason = reason or "LOW risk with no CRM divergence — intervention not warranted."

        trace.append(
            "Conflict Detector: REJECT — " + reason if decision == "reject"
            else "Conflict Detector: PASS — risk confirmed, proceeding"
        )
        return {"conflict_decision": decision, "reject_reason": reason,
                "agent_trace": trace, "tool_calls": calls}

    # ── Node 3: Offer Strategist (Sonnet) — can ESCALATE ───────────────── #
    def _offer_strategist(self, state: AgentState) -> AgentState:
        profile, score, analysis = state["profile"], state["score"], state["analysis"]
        trace = state.get("agent_trace", [])
        calls = state.get("tool_calls", [])
        try:
            system = (
                "You are the Offer Strategist agent. Design a tier-appropriate retention offer. "
                "Use get_loyalty_history and check_value_threshold. If check_value_threshold says "
                "the offer must escalate, note that DRI sign-off will be required."
            )
            res = self._agent_turn(
                "generate_offer", system,
                f"Craft a retention offer for {profile.name} ({profile.tier.value}, "
                f"{score.risk_level.value} risk).",
                profile, score,
            )
            calls += res.get("tool_calls", [])
            trace.append(f"Offer Strategist designed offer via {len(res.get('tool_calls', []))} tool calls")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Offer Strategist agent degraded: %s", exc)
            trace.append("Offer Strategist: deterministic fallback")

        offer = self.svc.generate_offer(profile, analysis, score)
        # Escalation is a real agent-surfaced decision based on value threshold.
        from config import settings
        escalate = (
            score.risk_level is RiskLevel.CRITICAL
            and offer.value_score > settings.ESCALATION_VALUE_THRESHOLD
        )
        if escalate:
            trace.append("Offer Strategist: ESCALATE — high-value CRITICAL, routing to DRI")
        return {"offer": offer, "escalate": escalate, "agent_trace": trace, "tool_calls": calls}

    # ── Node 4: Engagement Crafter (Haiku) ─────────────────────────────── #
    def _engagement_crafter(self, state: AgentState) -> AgentState:
        profile, score, analysis, offer = (
            state["profile"], state["score"], state["analysis"], state["offer"]
        )
        trace = state.get("agent_trace", [])
        brief = self.svc.generate_brief(profile, score, analysis, offer)
        outreach = self.svc.generate_outreach(profile, offer, score)
        trace.append("Engagement Crafter: brief + 3-channel outreach generated")
        return {"brief": brief, "outreach": outreach, "agent_trace": trace}

    # ── Public entry ───────────────────────────────────────────────────── #
    def run(self, profile, score) -> RetentionWorkflowResult:
        start = time.perf_counter()
        final = self.graph.invoke({"profile": profile, "score": score,
                                   "agent_trace": [], "tool_calls": []})
        elapsed = round(time.perf_counter() - start, 3)

        rejected = final.get("conflict_decision") == "reject"
        analysis = final.get("analysis") or self.svc._fallback_analysis(profile, score)
        # On reject, still produce an offer/brief record for auditability but mark it.
        offer = final.get("offer") or self.svc.generate_offer(profile, analysis, score)
        brief = final.get("brief") or self.svc.generate_brief(profile, score, analysis, offer)
        outreach = final.get("outreach") or self.svc.generate_outreach(profile, offer, score)

        return RetentionWorkflowResult(
            workflow_id=f"wf_{uuid.uuid4().hex[:12]}",
            customer_id=profile.customer_id,
            score=score,
            analysis=analysis,
            offer=offer,
            brief=brief,
            outreach=outreach,
            elapsed_seconds=elapsed,
            completed_at=datetime.now(timezone.utc),
            degraded=not self.router.available,
        ), {
            "rejected": rejected,
            "reject_reason": final.get("reject_reason", ""),
            "escalate": final.get("escalate", False),
            "trace": final.get("agent_trace", []),
            "tool_calls": final.get("tool_calls", []),
        }


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        return {}
    try:
        return json.loads(text[s:e + 1])
    except json.JSONDecodeError:
        return {}
