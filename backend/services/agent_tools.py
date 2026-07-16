"""Tools the retention agents can call during the LangGraph tool-use loop.

Each tool exposes a slice of real, live platform state (signals, score
breakdown, loyalty history, value thresholds) so the agents decide what to
fetch rather than receiving everything pre-baked. Schemas follow the Anthropic
tool-use spec; `build_tool_executor` binds them to a specific customer + score.
"""

from __future__ import annotations

from config import settings

# Anthropic tool schemas advertised to the model.
AGENT_TOOLS = [
    {
        "name": "get_customer_signals",
        "description": "Get the raw signals from all six source systems (Salesforce CRM, "
                       "Shopify, Yotpo loyalty, Klaviyo, Zendesk, Google Analytics) for the "
                       "customer under review. Use this to find concrete evidence.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_score_breakdown",
        "description": "Get the composite churn score, risk band, and each signal's weighted "
                       "contribution, plus whether the CRM health score diverges from the "
                       "cross-system composite.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_loyalty_history",
        "description": "Get the customer's loyalty tier, points balance, and redemption recency "
                       "from Yotpo — useful for deciding offer type and generosity.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "check_value_threshold",
        "description": "Check whether a proposed offer value (0-100 magnitude) for this CRITICAL/"
                       "high-value customer exceeds the auto-escalation threshold that requires "
                       "DRI sign-off. Returns {escalate: bool, threshold: number}.",
        "input_schema": {
            "type": "object",
            "properties": {
                "offer_value_score": {
                    "type": "number",
                    "description": "Proposed offer magnitude 0-100.",
                }
            },
            "required": ["offer_value_score"],
        },
    },
]


def build_tool_executor(profile, score):
    """Return a `tool_executor(name, input)` bound to this customer + score."""
    sig = profile.signals

    def _signals():
        return sig.model_dump(mode="json")

    def _breakdown():
        return {
            "composite_score": score.composite_score,
            "risk_level": score.risk_level.value,
            "base_score": score.base_score,
            "interaction_boost": score.interaction_boost,
            "crm_divergence": score.crm_divergence,
            "crm_health_score": score.crm_health_score,
            "contributions": [c.model_dump() for c in score.signal_contributions],
        }

    def _loyalty():
        if sig.yotpo is None:
            return {"enrolled": False}
        y = sig.yotpo
        return {
            "enrolled": True,
            "tier": y.tier,
            "points_balance": y.points_balance,
            "redemptions_30d": y.redemptions_30d,
            "days_since_last_redemption": y.days_since_last_redemption,
        }

    def _threshold(inp):
        val = float(inp.get("offer_value_score", 0))
        thr = settings.ESCALATION_VALUE_THRESHOLD
        from models.domain import RiskLevel
        escalate = score.risk_level is RiskLevel.CRITICAL and val > thr
        return {"escalate": escalate, "threshold": thr, "offer_value_score": val}

    def executor(name: str, inp: dict):
        if name == "get_customer_signals":
            return _signals()
        if name == "get_score_breakdown":
            return _breakdown()
        if name == "get_loyalty_history":
            return _loyalty()
        if name == "check_value_threshold":
            return _threshold(inp or {})
        return {"error": f"unknown tool {name}"}

    return executor
