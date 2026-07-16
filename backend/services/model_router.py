"""Intelligent model router for cost optimization.

Routes each AI task to the cheapest model that meets its quality bar:
  - Complex reasoning (churn analysis, offers, briefs) -> Claude Sonnet 4
  - Lightweight generation (outreach, summaries, formatting) -> Claude 3.5 Haiku

Tracks token usage and estimated cost per request so the dashboard can show
the savings versus routing everything to Sonnet. When Bedrock is unavailable
(no credentials or forced degraded mode) the router raises so callers can fall
back to deterministic generation.
"""

from __future__ import annotations

import json
import logging
from enum import Enum

from config import settings

logger = logging.getLogger(__name__)


class TaskComplexity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ModelTier(str, Enum):
    SONNET = "sonnet"
    HAIKU = "haiku"


# Task -> model tier mapping (editable without code changes via TASK_MODEL_MAP).
TASK_MODEL_MAP: dict[str, ModelTier] = {
    "analyze_churn_drivers": ModelTier.SONNET,
    "generate_offer": ModelTier.SONNET,
    "generate_brief": ModelTier.SONNET,
    "generate_outreach_email": ModelTier.HAIKU,
    "generate_outreach_sms": ModelTier.HAIKU,
    "generate_outreach_push": ModelTier.HAIKU,
    "generate_outreach": ModelTier.HAIKU,
    "summarize_signals": ModelTier.HAIKU,
}

# Pricing per 1M tokens (USD): (input, output).
PRICING = {
    ModelTier.SONNET: (3.0, 15.0),   # Claude Sonnet 4.5
    ModelTier.HAIKU: (1.0, 5.0),     # Claude Haiku 4.5
}

# Task -> the named agent in the 4-agent retention pipeline. Drives the
# agent-level cost breakdown on the Cost Analytics page.
TASK_AGENT = {
    "analyze_churn_drivers": "Signal Collector",
    "generate_offer": "Offer Strategist",
    "generate_brief": "Conflict Detector",
    "generate_outreach": "Engagement Crafter",
    "generate_outreach_email": "Engagement Crafter",
    "generate_outreach_sms": "Engagement Crafter",
    "generate_outreach_push": "Engagement Crafter",
    "summarize_signals": "Signal Collector",
    "chatbot": "Assistant",
}


class ModelRouter:
    """Routes AI tasks to cost-optimal Bedrock models and tracks usage."""

    def __init__(self, client=None):
        self._client = client
        self.usage_log: list[dict] = []

    # ------------------------------------------------------------------ #
    @property
    def available(self) -> bool:
        return self._client is not None

    def _tier_for(self, task_name: str) -> ModelTier:
        return TASK_MODEL_MAP.get(task_name, ModelTier.HAIKU)

    def get_model(self, task_name: str) -> str:
        """Return the Bedrock model ID for a given task."""
        tier = self._tier_for(task_name)
        return (
            settings.BEDROCK_MODEL_HEAVY
            if tier is ModelTier.SONNET
            else settings.BEDROCK_MODEL_LIGHT
        )

    # ------------------------------------------------------------------ #
    def invoke(
        self,
        task_name: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 2048,
    ) -> dict:
        """Route to the appropriate model, invoke it, and record usage.

        Raises RuntimeError if no Bedrock client is configured — callers use
        this to trigger deterministic fallback.
        """
        if self._client is None:
            raise RuntimeError("Bedrock client unavailable (degraded mode)")

        primary_tier = self._tier_for(task_name)
        try:
            return self._call(task_name, primary_tier, system_prompt, user_message, max_tokens)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Model tier %s failed for %s: %s", primary_tier, task_name, exc)
            # Fallback: Sonnet -> Haiku (cheaper/available); Haiku -> Sonnet.
            fallback = ModelTier.HAIKU if primary_tier is ModelTier.SONNET else ModelTier.SONNET
            logger.warning("Falling back to %s for %s", fallback, task_name)
            return self._call(
                task_name, fallback, system_prompt, user_message, max_tokens, fell_back=True
            )

    def invoke_with_tools(
        self,
        task_name: str,
        system_prompt: str,
        user_message: str,
        tools: list[dict],
        tool_executor,
        max_tokens: int = 1500,
        max_iters: int = 5,
    ) -> dict:
        """Run a real tool-use (function-calling) agent loop against Bedrock.

        `tools` is a list of Anthropic tool schemas; `tool_executor(name, input)`
        runs a tool and returns a JSON-serialisable result. The model may call
        tools across several turns; we loop until it stops requesting tools (or
        we hit max_iters), then return the final text. Raises RuntimeError in
        degraded mode so callers fall back to deterministic generation.
        """
        if self._client is None:
            raise RuntimeError("Bedrock client unavailable (degraded mode)")

        tier = self._tier_for(task_name)
        model_id = (
            settings.BEDROCK_MODEL_HEAVY if tier is ModelTier.SONNET
            else settings.BEDROCK_MODEL_LIGHT
        )
        messages = [{"role": "user", "content": user_message}]
        tool_calls: list[str] = []

        for _ in range(max_iters):
            resp = self._client.messages.create(
                model=model_id,
                max_tokens=max_tokens,
                system=system_prompt,
                tools=tools,
                messages=messages,
            )
            self.record_usage(task_name, tier, resp.usage.input_tokens, resp.usage.output_tokens)

            if resp.stop_reason != "tool_use":
                text = "".join(b.text for b in resp.content if b.type == "text")
                return {"content": text, "model_used": model_id, "tier": tier.value,
                        "tool_calls": tool_calls}

            # Execute every tool the model asked for this turn.
            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for block in resp.content:
                if block.type == "tool_use":
                    tool_calls.append(block.name)
                    try:
                        out = tool_executor(block.name, block.input)
                    except Exception as exc:  # noqa: BLE001
                        out = {"error": str(exc)}
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(out, default=str),
                    })
            messages.append({"role": "user", "content": results})

        # Ran out of iterations — return best-effort final text.
        return {"content": "", "model_used": model_id, "tier": tier.value,
                "tool_calls": tool_calls, "exhausted": True}

    def _call(
        self,
        task_name: str,
        tier: ModelTier,
        system_prompt: str,
        user_message: str,
        max_tokens: int,
        fell_back: bool = False,
    ) -> dict:
        model_id = (
            settings.BEDROCK_MODEL_HEAVY
            if tier is ModelTier.SONNET
            else settings.BEDROCK_MODEL_LIGHT
        )
        response = self._client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text
        self.record_usage(
            task_name,
            tier,
            response.usage.input_tokens,
            response.usage.output_tokens,
            fell_back=fell_back,
        )
        return {"content": text, "model_used": model_id, "tier": tier.value}

    # ------------------------------------------------------------------ #
    def record_simulated_usage(self, task_name: str, input_tokens: int, output_tokens: int) -> None:
        """Record estimated token usage for a task in degraded mode.

        Lets the cost-optimization dashboard show representative multi-model
        savings even when Bedrock is not actually invoked.
        """
        self.record_usage(task_name, self._tier_for(task_name), input_tokens, output_tokens)

    def record_usage(
        self,
        task_name: str,
        tier: ModelTier,
        input_tokens: int,
        output_tokens: int,
        fell_back: bool = False,
    ) -> None:
        in_rate, out_rate = PRICING[tier]
        cost = (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000
        self.usage_log.append(
            {
                "task": task_name,
                "tier": tier.value,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost": cost,
                "fell_back": fell_back,
            }
        )

    def _estimate_cost(self, tier: ModelTier, input_tokens: int, output_tokens: int) -> float:
        in_rate, out_rate = PRICING[tier]
        return (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000

    # ------------------------------------------------------------------ #
    def get_cost_summary(self) -> dict:
        """Return the cost breakdown for the dashboard."""
        total = sum(e["estimated_cost"] for e in self.usage_log)

        by_model: dict[str, dict] = {}
        for e in self.usage_log:
            label = "Sonnet 4.5" if e["tier"] == ModelTier.SONNET.value else "Haiku 4.5"
            slot = by_model.setdefault(
                label,
                {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0},
            )
            slot["requests"] += 1
            slot["input_tokens"] += e["input_tokens"]
            slot["output_tokens"] += e["output_tokens"]
            slot["cost"] += e["estimated_cost"]

        # Baseline: everything routed to Sonnet.
        s_in, s_out = PRICING[ModelTier.SONNET]
        all_sonnet = sum(
            (e["input_tokens"] * s_in + e["output_tokens"] * s_out) / 1_000_000
            for e in self.usage_log
        )
        savings = all_sonnet - total
        savings_pct = (savings / all_sonnet * 100) if all_sonnet > 0 else 0.0

        # Agent-level breakdown (which of the 4 pipeline agents spent what).
        by_agent: dict[str, dict] = {}
        for e in self.usage_log:
            agent = TASK_AGENT.get(e["task"], "Other")
            model = "Sonnet 4.5" if e["tier"] == ModelTier.SONNET.value else "Haiku 4.5"
            slot = by_agent.setdefault(
                agent,
                {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0, "model": model},
            )
            slot["requests"] += 1
            slot["input_tokens"] += e["input_tokens"]
            slot["output_tokens"] += e["output_tokens"]
            slot["cost"] += e["estimated_cost"]

        return {
            "total_cost": round(total, 6),
            "total_requests": len(self.usage_log),
            "all_sonnet_baseline": round(all_sonnet, 6),
            "savings": round(savings, 6),
            "savings_percentage": round(savings_pct, 1),
            "by_model": [
                {"model": k, **{kk: (round(vv, 6) if kk == "cost" else vv) for kk, vv in v.items()}}
                for k, v in by_model.items()
            ],
            "by_agent": [
                {"agent": k, **{kk: (round(vv, 6) if kk == "cost" else vv) for kk, vv in v.items()}}
                for k, v in by_agent.items()
            ],
        }
