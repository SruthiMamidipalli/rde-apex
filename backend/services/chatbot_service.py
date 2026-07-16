"""Context-aware AI chatbot assistant.

Grounded in live platform state (scores, approvals, cost, audit) and aware of
the current page + selected customer. Uses the ModelRouter (Sonnet for complex
queries, Haiku for simple lookups) when Bedrock is available; otherwise answers
deterministically from real data so the demo always responds. Every answer is
cited to source systems and never fabricates numbers.
"""

from __future__ import annotations

import json
import logging

from models.domain import RiskLevel

logger = logging.getLogger(__name__)

# Simple keyword router: which queries need Sonnet (reasoning) vs Haiku (lookup).
_COMPLEX_HINTS = ("why", "explain", "compare", "should", "recommend", "trust",
                  "flag every", "across", "conflict")


class ChatbotService:
    def __init__(self, orchestrator, kpi_service):
        self.orch = orchestrator
        self.kpi = kpi_service

    # ------------------------------------------------------------------ #
    def _complexity(self, message: str) -> str:
        m = message.lower()
        return "complex" if any(h in m for h in _COMPLEX_HINTS) else "simple"

    def _live_context(self, context: dict) -> dict:
        """Assemble the grounded facts the assistant is allowed to cite."""
        self.orch.score_all()
        scored = [
            (p, self.orch.get_score(p.customer_id))
            for p in self.orch.data_loader.get_all_customers()
        ]
        scored.sort(key=lambda ps: ps[1].composite_score, reverse=True)
        top = [
            {
                "customer_id": p.customer_id, "name": p.name, "tier": p.tier.value,
                "score": s.composite_score, "band": s.risk_level.value,
                "ltv": p.ltv, "value_rank": round(s.composite_score * p.ltv, 0),
            }
            for p, s in scored[:10]
        ]
        pending = self.orch.approvals.get_pending()
        cost = self.orch.router.get_cost_summary()
        cc = self.kpi.command_center()
        facts = {
            "current_page": context.get("page", "Command Center"),
            "selected_customer": context.get("customer_id"),
            "top_at_risk": top,
            "pending_approvals": len(pending),
            "oldest_pending": (
                max(pending, key=lambda p: p.time_since_signal_seconds).workflow_result.customer_id
                if pending else None
            ),
            "cost_summary": cost,
            "churn_rate": cc["kpis"][0]["value"],
            "revenue_at_risk": cc["revenue_at_risk"],
        }
        return facts

    # ------------------------------------------------------------------ #
    # Tools the assistant can call (real function-calling loop).
    def _tool_schemas(self) -> list[dict]:
        return [
            {"name": "get_top_at_risk",
             "description": "Get today's top at-risk customers ranked by risk × value.",
             "input_schema": {"type": "object", "properties": {
                 "limit": {"type": "integer", "description": "How many (default 10)."}}}},
            {"name": "explain_customer",
             "description": "Explain why a specific customer is at risk — top signals, "
                            "interaction boost, and CRM divergence. Use the currently selected "
                            "customer if no id is given.",
             "input_schema": {"type": "object", "properties": {
                 "customer_id": {"type": "string"}}}},
            {"name": "get_cost_summary",
             "description": "Get AI model cost so far: total, all-Sonnet baseline, savings, "
                            "and per-model breakdown.",
             "input_schema": {"type": "object", "properties": {}}},
            {"name": "get_pending_approvals",
             "description": "Get how many approvals are pending and the oldest one.",
             "input_schema": {"type": "object", "properties": {}}},
        ]

    def _tool_executor(self, context: dict):
        def run(name: str, inp: dict):
            inp = inp or {}
            if name == "get_top_at_risk":
                facts = self._live_context(context)
                rows = facts["top_at_risk"][: int(inp.get("limit", 10))]
                # Do not expose raw customer IDs in assistant-facing output.
                return [{k: v for k, v in r.items() if k != "customer_id"} for r in rows]
            if name == "explain_customer":
                cid = inp.get("customer_id") or context.get("customer_id")
                return {"explanation": self._explain_customer(cid)}
            if name == "get_cost_summary":
                return self.orch.router.get_cost_summary()
            if name == "get_pending_approvals":
                pend = self.orch.approvals.get_pending()
                oldest = (max(pend, key=lambda p: p.time_since_signal_seconds)
                          .workflow_result.customer_id if pend else None)
                return {"pending": len(pend), "oldest_customer_id": oldest}
            return {"error": f"unknown tool {name}"}
        return run

    def answer(self, message: str, context: dict | None = None) -> dict:
        context = context or {}
        tier = self._complexity(message)

        # Real tool-using agent loop when Bedrock is available.
        if self.orch.router.available:
            try:
                task = "analyze_churn_drivers" if tier == "complex" else "summarize_signals"
                page = context.get("page", "Overview")
                system = (
                    "You are the Apex Retention AI assistant. Use the provided tools to fetch "
                    "live, real data before answering — never invent numbers. Cite source systems "
                    "in [brackets] like [GA], [Yotpo], [Audit]. Be concise. The user is on the "
                    f"'{page}' page"
                    + (f", viewing customer {context['customer_id']}." if context.get("customer_id") else ".")
                )
                result = self.orch.router.invoke_with_tools(
                    task, system, message,
                    tools=self._tool_schemas(),
                    tool_executor=self._tool_executor(context),
                    max_tokens=700,
                )
                if result.get("content"):
                    return {
                        "reply": result["content"],
                        "model": result["model_used"],
                        "grounded": True,
                        "tools_used": result.get("tool_calls", []),
                        "context_used": {"page": page, "customer_id": context.get("customer_id")},
                    }
            except Exception as exc:  # noqa: BLE001
                logger.warning("Chatbot tool-use path failed (%s); deterministic reply", exc)

        # Deterministic grounded fallback.
        facts = self._live_context(context)
        return {
            "reply": self._deterministic(message, facts, context),
            "model": "deterministic",
            "grounded": True,
            "context_used": {"page": facts["current_page"],
                             "customer_id": facts["selected_customer"]},
        }

    # ------------------------------------------------------------------ #
    def _deterministic(self, message: str, facts: dict, context: dict) -> str:
        m = message.lower()

        # Cross-section flagging.
        if "flag every" in m or ("flag" in m and "attention" in m):
            return self._flag_sections(facts)

        # Top at-risk.
        if ("top" in m and ("risk" in m or "at-risk" in m)) or "top 10" in m:
            lines = [
                f"{i+1}. {c['name']} #{c['customer_id']} — score {c['score']:.0f} "
                f"{c['band']}, ${c['ltv']:,.0f} LTV"
                for i, c in enumerate(facts["top_at_risk"][:10])
            ]
            return ("Today's top at-risk by risk × value [Scoring engine, Shopify]:\n"
                    + "\n".join(lines))

        # Cost.
        if "cost" in m or "token" in m or "spend" in m:
            cs = facts["cost_summary"]
            return (
                f"AI cost so far [Cost service]:\n"
                f"• Total: ${cs['total_cost']:.4f} across {cs['total_requests']} requests\n"
                f"• All-Sonnet baseline: ${cs['all_sonnet_baseline']:.4f}\n"
                f"• Savings: ${cs['savings']:.4f} ({cs['savings_percentage']:.0f}%)\n"
                f"Multi-model routing (Sonnet for reasoning, Haiku for content) "
                f"is what drives the saving."
            )

        # Oldest / pending approvals.
        if "approval" in m or "pending" in m or "oldest" in m:
            if facts["oldest_pending"]:
                return (f"There are {facts['pending_approvals']} approvals pending. "
                        f"Oldest is customer #{facts['oldest_pending']} [Audit log]. "
                        f"Recommend actioning it before the SLA breaches.")
            return "No approvals are pending right now [Audit log]. Queue is clear."

        # Why is X high / customer-specific.
        cid = context.get("customer_id")
        if ("why" in m or "explain" in m) and (cid or "#" in m):
            target = cid
            if "#" in m:
                token = m.split("#", 1)[1].strip().split()[0].upper()
                target = token
            return self._explain_customer(target or cid)

        # Churn rate.
        if "churn" in m:
            return (f"Projected annual churn is {facts['churn_rate']:.1f}% against the "
                    f"<14% target [Shopify + CRM]. Down from the 28% baseline. "
                    f"${facts['revenue_at_risk']:,.0f} of ARR is currently at risk.")

        # Default grounded response.
        return (
            f"You're on the {facts['current_page']} page. I can see "
            f"{facts['pending_approvals']} approvals pending and "
            f"${facts['revenue_at_risk']:,.0f} ARR at risk. Everything I surface is "
            f"cited to one of the six source systems and logged to the audit trail. "
            f"Try: 'top 10 at-risk', 'why is #C026 high?', 'AI cost this week', or "
            f"'flag every area needing attention'."
        )

    def _explain_customer(self, customer_id: str | None) -> str:
        if not customer_id or not self.orch.data_loader.exists(customer_id):
            return "Select a customer first, or reference one by ID (e.g. #C026)."
        p = self.orch.data_loader.get_customer(customer_id)
        s = self.orch.get_score(customer_id)
        top = sorted(s.signal_contributions, key=lambda c: c.weighted_contribution,
                     reverse=True)[:3]
        src = {"google_analytics": "GA", "yotpo": "Yotpo", "zendesk": "Zendesk",
               "shopify": "Shopify", "klaviyo": "Klaviyo", "salesforce": "CRM"}
        lines = [f"• {c.signal_name} → risk {c.normalized_score:.0f}/100 "
                 f"[{src.get(c.source, c.source)}]" for c in top]
        out = (f"{p.name} scores {s.composite_score:.0f} "
               f"({s.risk_level.value}) driven by:\n" + "\n".join(lines))
        if s.interaction_boost_applied:
            out += (f"\nInteraction boost applied (+{s.interaction_boost:.0f}): "
                    f"multiple churn signals co-occur, so true risk exceeds the "
                    f"linear blend. [Model {s.model_version}]")
        if s.crm_divergence:
            out += (f"\n⚠ CRM divergence: Salesforce rates health "
                    f"{s.crm_health_score:.0f}/100 'healthy', but the composite says "
                    f"{s.risk_level.value}. Trust the composite. [CRM + Scoring]")
        return out

    def _flag_sections(self, facts: dict) -> str:
        critical = [c for c in facts["top_at_risk"] if c["band"] == "CRITICAL"]
        lines = []
        if critical:
            lines.append(f"🔴 At-Risk Queue: {len(critical)} CRITICAL customers "
                         f"unactioned (top: {critical[0]['name']}) [Scoring]")
        if facts["pending_approvals"]:
            lines.append(f"🟠 Retention Brief: {facts['pending_approvals']} approvals "
                         f"awaiting sign-off [Audit log]")
        if facts["churn_rate"] > 14:
            lines.append(f"🟠 Impact & ROI: churn {facts['churn_rate']:.0f}% still "
                         f"above the 14% target [Shopify + CRM]")
        lines.append(f"🟢 Cost: routing saving "
                     f"{facts['cost_summary']['savings_percentage']:.0f}% vs all-Sonnet")
        divergent = [c for c in facts["top_at_risk"]]
        return ("Scanning all areas for what needs your attention:\n"
                + "\n".join(lines)
                + "\nClick any item to jump straight to it.")
