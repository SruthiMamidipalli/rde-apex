"""MCP server exposing Apex retention capabilities as 5 tools.

Run with:  python -m mcp_server.server   (stdio transport)

Tools:
  - calculate_churn_score
  - generate_retention_offer
  - get_customer_signals
  - generate_outreach_content
  - get_at_risk_customers

Each tool validates its inputs and returns a structured error (never an
unhandled exception) on invalid parameters, per MCP spec.
"""

from __future__ import annotations

import json
import sys

# Ensure the backend dir is importable when run as a module or script.
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server import Server  # noqa: E402
from mcp.server.stdio import stdio_server  # noqa: E402
from mcp.types import TextContent, Tool  # noqa: E402

from services.orchestrator import get_orchestrator  # noqa: E402

server = Server("apex-retention")


# --------------------------------------------------------------------------- #
# Tool schemas
# --------------------------------------------------------------------------- #
TOOLS = [
    Tool(
        name="calculate_churn_score",
        description="Calculate composite churn score (0-100) with per-signal breakdown and risk level for a customer.",
        inputSchema={
            "type": "object",
            "properties": {"customer_id": {"type": "string", "description": "Customer ID, e.g. C001"}},
            "required": ["customer_id"],
        },
    ),
    Tool(
        name="generate_retention_offer",
        description="Generate a personalized retention offer with confidence score for a customer.",
        inputSchema={
            "type": "object",
            "properties": {"customer_id": {"type": "string", "description": "Customer ID"}},
            "required": ["customer_id"],
        },
    ),
    Tool(
        name="get_customer_signals",
        description="Retrieve all raw signals from the six source systems for a customer.",
        inputSchema={
            "type": "object",
            "properties": {"customer_id": {"type": "string", "description": "Customer ID"}},
            "required": ["customer_id"],
        },
    ),
    Tool(
        name="generate_outreach_content",
        description="Generate formatted outreach content for a channel (email, sms, or push) for a customer.",
        inputSchema={
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "Customer ID"},
                "channel": {"type": "string", "enum": ["email", "sms", "push"]},
            },
            "required": ["customer_id", "channel"],
        },
    ),
    Tool(
        name="get_at_risk_customers",
        description="Return customers whose composite churn score exceeds a threshold, sorted descending.",
        inputSchema={
            "type": "object",
            "properties": {
                "threshold": {"type": "number", "minimum": 0, "maximum": 100, "default": 50}
            },
        },
    ),
]


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


def _error(message: str) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps({"error": message}))]


def _ok(payload: dict) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(payload, default=str, indent=2))]


# --------------------------------------------------------------------------- #
# Tool dispatch
# --------------------------------------------------------------------------- #
@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    orch = get_orchestrator()
    arguments = arguments or {}
    try:
        if name == "calculate_churn_score":
            cid = arguments.get("customer_id")
            if not isinstance(cid, str) or not cid:
                return _error("Parameter 'customer_id' is required and must be a non-empty string.")
            result = orch.score_customer(cid)
            if result is None:
                return _error(f"Customer '{cid}' not found.")
            return _ok(json.loads(result.model_dump_json()))

        if name == "generate_retention_offer":
            cid = arguments.get("customer_id")
            if not isinstance(cid, str) or not cid:
                return _error("Parameter 'customer_id' is required and must be a non-empty string.")
            if not orch.data_loader.exists(cid):
                return _error(f"Customer '{cid}' not found.")
            profile = orch.data_loader.get_customer(cid)
            score = orch.get_score(cid)
            analysis = orch.agent.analyze_churn_drivers(profile, score)
            offer = orch.agent.generate_offer(profile, analysis, score)
            return _ok(json.loads(offer.model_dump_json()))

        if name == "get_customer_signals":
            cid = arguments.get("customer_id")
            if not isinstance(cid, str) or not cid:
                return _error("Parameter 'customer_id' is required and must be a non-empty string.")
            signals = orch.data_loader.get_customer_signals(cid)
            if signals is None:
                return _error(f"Customer '{cid}' not found.")
            return _ok({"customer_id": cid, "signals": json.loads(signals.model_dump_json())})

        if name == "generate_outreach_content":
            cid = arguments.get("customer_id")
            channel = arguments.get("channel")
            if not isinstance(cid, str) or not cid:
                return _error("Parameter 'customer_id' is required and must be a non-empty string.")
            if channel not in ("email", "sms", "push"):
                return _error("Parameter 'channel' must be one of: email, sms, push.")
            if not orch.data_loader.exists(cid):
                return _error(f"Customer '{cid}' not found.")
            profile = orch.data_loader.get_customer(cid)
            score = orch.get_score(cid)
            analysis = orch.agent.analyze_churn_drivers(profile, score)
            offer = orch.agent.generate_offer(profile, analysis, score)
            outreach = orch.agent.generate_outreach(profile, offer, score)
            content = outreach.get(channel)
            return _ok({"customer_id": cid, "channel": channel,
                        "content": json.loads(content.model_dump_json())})

        if name == "get_at_risk_customers":
            threshold = arguments.get("threshold", 50)
            try:
                threshold = float(threshold)
            except (TypeError, ValueError):
                return _error("Parameter 'threshold' must be a number.")
            if not 0 <= threshold <= 100:
                return _error("Parameter 'threshold' must be between 0 and 100.")
            orch.score_all()
            rows = []
            for profile in orch.data_loader.get_all_customers():
                s = orch.get_score(profile.customer_id)
                if s.composite_score > threshold:
                    rows.append({
                        "customer_id": profile.customer_id,
                        "name": profile.name,
                        "tier": profile.tier.value,
                        "composite_score": s.composite_score,
                        "risk_level": s.risk_level.value,
                    })
            rows.sort(key=lambda r: r["composite_score"], reverse=True)
            return _ok({"threshold": threshold, "count": len(rows), "customers": rows})

        return _error(f"Unknown tool: {name}")
    except Exception as exc:  # noqa: BLE001 - never surface unhandled exception
        return _error(f"Internal error processing '{name}': {exc}")


async def _main() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio

    asyncio.run(_main())
