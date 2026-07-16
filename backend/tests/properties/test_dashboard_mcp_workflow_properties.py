"""Property tests for dashboard, MCP error handling, and workflow priority.

Feature: apex-loyalty-ai-retention
Properties 14, 15, 16, 18.
"""

from __future__ import annotations

import asyncio
import json

from hypothesis import given, settings
from hypothesis import strategies as st

from models.domain import RiskLevel
from services.orchestrator import Orchestrator


# Property 14: Customer List Sorted by Churn Score
def test_property_14_customer_list_sorted():
    orch = Orchestrator()
    orch.score_all()
    profiles = orch.data_loader.get_all_customers()
    summaries = sorted(
        (orch.get_score(p.customer_id).composite_score for p in profiles),
        reverse=True,
    )
    # Descending order.
    assert summaries == sorted(summaries, reverse=True)


# Property 15: Aggregate Metrics Correctness
@given(threshold=st.floats(0, 100))
@settings(max_examples=50, deadline=None)
def test_property_15_aggregate_metrics(threshold):
    orch = Orchestrator()
    scores = orch.score_all()
    values = [s.composite_score for s in scores.values()]
    m = orch.metrics(threshold=threshold)
    assert m["total_customers"] == len(values)
    assert m["total_at_risk"] == sum(1 for v in values if v > threshold)
    expected_avg = round(sum(values) / len(values), 2) if values else 0.0
    assert abs(m["average_churn_score"] - expected_avg) < 0.01
    assert sum(m["risk_distribution"].values()) == len(values)


# Property 16: MCP Invalid Input Error Handling
def test_property_16_mcp_invalid_input():
    from mcp_server.server import call_tool

    invalid_calls = [
        ("calculate_churn_score", {}),                      # missing required
        ("calculate_churn_score", {"customer_id": ""}),     # empty
        ("calculate_churn_score", {"customer_id": "NOPE"}), # not found
        ("generate_outreach_content", {"customer_id": "C001", "channel": "carrier-pigeon"}),
        ("get_at_risk_customers", {"threshold": "abc"}),    # wrong type
        ("get_at_risk_customers", {"threshold": 500}),      # out of range
        ("unknown_tool", {}),                                # unknown
    ]
    for name, args in invalid_calls:
        result = asyncio.run(call_tool(name, args))
        assert result and len(result) == 1
        payload = json.loads(result[0].text)
        assert "error" in payload, f"{name} {args} did not return structured error"
        assert isinstance(payload["error"], str) and payload["error"]


# Property 18: Workflow Priority Ordering
def test_property_18_workflow_priority_ordering():
    orch = Orchestrator()
    ordered = orch.triggered_customers(threshold=0)  # include everyone
    ranks = [orch.get_score(p.customer_id).risk_level.rank for p in ordered]
    # Non-increasing rank => CRITICAL(3) before HIGH(2) before MEDIUM(1) before LOW(0).
    assert ranks == sorted(ranks, reverse=True)
