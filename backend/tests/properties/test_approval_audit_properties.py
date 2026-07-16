"""Property tests for approval and audit services.

Feature: apex-loyalty-ai-retention
Properties 12, 13, 17.
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from models.domain import (
    AuditEntry,
    ChurnAnalysis,
    ChurnScoreResult,
    RetentionBrief,
    RetentionOffer,
    RetentionWorkflowResult,
    RiskLevel,
)
from services.approval_service import ApprovalService
from services.audit_service import AuditService


def _make_workflow(risk: RiskLevel, value_score: float, cid: str = "T001") -> RetentionWorkflowResult:
    now = datetime.now(timezone.utc)
    score = ChurnScoreResult(
        customer_id=cid, composite_score=80.0 if risk is RiskLevel.CRITICAL else 40.0,
        risk_level=risk, signal_contributions=[], computed_at=now, missing_signals=[],
    )
    offer = RetentionOffer(
        offer_id="o1", customer_id=cid, offer_type="discount", description="d",
        value="10% off", value_score=value_score, matched_signal="x",
        confidence_score=70.0, tier_justification="t",
    )
    analysis = ChurnAnalysis(customer_id=cid, drivers=[], summary="s",
                             dominant_category="transaction", generated_at=now)
    brief = RetentionBrief(
        brief_id="b1", customer_id=cid, customer_summary="cs", risk_classification=risk,
        churn_score=score.composite_score, signal_breakdown=[], historical_comparison="h",
        recommended_offer=offer, outreach_strategy="os", generated_at=now,
    )
    return RetentionWorkflowResult(
        workflow_id="w1", customer_id=cid, score=score, analysis=analysis, offer=offer,
        brief=brief, outreach={}, elapsed_seconds=1.0, completed_at=now,
    )


def _fresh_services():
    tmp = Path(tempfile.mkdtemp()) / "audit.json"
    audit = AuditService(storage_path=tmp)
    approvals = ApprovalService(audit, value_threshold=50)
    return audit, approvals


# Property 12: Approval Audit Entry Completeness
@given(approver=st.text(min_size=1, max_size=20), modify=st.booleans())
@settings(max_examples=100, deadline=None)
def test_property_12_approval_audit_completeness(approver, modify):
    audit, approvals = _fresh_services()
    pending = approvals.submit_for_approval(_make_workflow(RiskLevel.MEDIUM, 40))
    mods = {"value": "20% off"} if modify else None
    decision = approvals.approve(pending.approval_id, approver, modifications=mods)

    entries = [e for e in audit.all_entries() if e.event_type in ("approval",)]
    assert entries
    entry = entries[-1]
    assert entry.approver and entry.approver.strip()
    assert entry.timestamp is not None
    assert entry.decision in ("approved", "overridden")
    # Modifications flag correctly recorded.
    assert (entry.modifications is not None) == modify


# Property 13: CRITICAL Risk Escalation Rule
@given(
    risk=st.sampled_from(list(RiskLevel)),
    value_score=st.floats(0, 100),
)
@settings(max_examples=200, deadline=None)
def test_property_13_critical_escalation(risk, value_score):
    audit, approvals = _fresh_services()
    result = _make_workflow(risk, value_score)
    should = risk is RiskLevel.CRITICAL and value_score > 50
    assert approvals.should_escalate(result) == should
    pending = approvals.submit_for_approval(result)
    assert pending.escalated == should


# Property 17: Audit Query Filter Correctness
@given(
    entries=st.lists(
        st.tuples(
            st.sampled_from(["C001", "C002", "C003"]),
            st.sampled_from(list(RiskLevel)),
            st.sampled_from(["alice", "bob", "carol"]),
            st.integers(0, 30),
        ),
        min_size=1,
        max_size=25,
    ),
    f_customer=st.sampled_from([None, "C001", "C002", "C003"]),
    f_risk=st.sampled_from([None, *list(RiskLevel)]),
    f_approver=st.sampled_from([None, "alice", "bob", "carol"]),
)
@settings(max_examples=100, deadline=None)
def test_property_17_audit_query_filters(entries, f_customer, f_risk, f_approver):
    audit, _ = _fresh_services()
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    stored = []
    for i, (cid, risk, approver, day) in enumerate(entries):
        e = AuditEntry(
            entry_id=f"e{i}", customer_id=cid, timestamp=base + timedelta(days=day),
            event_type="approval", risk_level=risk, approver=approver, decision="approved",
        )
        audit._entries.append(e)
        stored.append(e)

    got = audit.query(customer_id=f_customer, risk_level=f_risk, approver=f_approver)

    def matches(e):
        return (
            (f_customer is None or e.customer_id == f_customer)
            and (f_risk is None or e.risk_level == f_risk)
            and (f_approver is None or e.approver == f_approver)
        )

    expected = [e for e in stored if matches(e)]
    assert len(got) == len(expected)
    for e in got:
        assert matches(e)
