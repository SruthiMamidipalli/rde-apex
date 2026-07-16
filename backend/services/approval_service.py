"""Human-in-the-loop approval workflow.

Queues retention recommendations for CRM-analyst review, records approve /
override / escalate decisions to the audit trail, and auto-escalates CRITICAL
recommendations whose offer value exceeds a configurable threshold to the DRI.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from config import settings
from models.domain import (
    ApprovalDecision,
    ApprovalStatus,
    EscalationRecord,
    PendingApproval,
    RetentionWorkflowResult,
    RiskLevel,
)
from services.audit_service import AuditService


class ApprovalService:
    def __init__(self, audit: AuditService, value_threshold: float | None = None):
        self.audit = audit
        self.value_threshold = (
            value_threshold if value_threshold is not None
            else settings.ESCALATION_VALUE_THRESHOLD
        )
        self._pending: dict[str, PendingApproval] = {}

    # ------------------------------------------------------------------ #
    def should_escalate(self, result: RetentionWorkflowResult) -> bool:
        """CRITICAL risk AND offer value over threshold => escalate."""
        return (
            result.score.risk_level is RiskLevel.CRITICAL
            and result.offer.value_score > self.value_threshold
        )

    def submit_for_approval(
        self, result: RetentionWorkflowResult, time_since_signal_seconds: float | None = None
    ) -> PendingApproval:
        # Supersede any still-open approval for this customer so re-running the
        # agent refreshes the recommendation instead of stacking duplicates.
        self._supersede_open(result.customer_id)

        approval_id = f"appr_{uuid.uuid4().hex[:12]}"
        escalate = self.should_escalate(result)
        pending = PendingApproval(
            approval_id=approval_id,
            workflow_result=result,
            status=ApprovalStatus.ESCALATED if escalate else ApprovalStatus.PENDING,
            submitted_at=datetime.now(timezone.utc),
            time_since_signal_seconds=(
                time_since_signal_seconds
                if time_since_signal_seconds is not None
                else result.elapsed_seconds
            ),
            escalated=escalate,
            escalation_reason=(
                f"CRITICAL risk with offer value {result.offer.value_score:.0f} "
                f"exceeds threshold {self.value_threshold:.0f}"
                if escalate else None
            ),
        )
        self._pending[approval_id] = pending
        self.audit.log_recommendation(result)
        if escalate:
            self._log_escalation(pending)
        return pending

    def _supersede_open(self, customer_id: str) -> None:
        """Drop any still-open (pending/escalated) approval for a customer.

        Decided approvals (approved/overridden) are kept so the campaign and
        audit trail remain intact; only undecided duplicates are removed.
        """
        stale = [
            aid for aid, p in self._pending.items()
            if p.workflow_result.customer_id == customer_id
            and p.status in (ApprovalStatus.PENDING, ApprovalStatus.ESCALATED)
        ]
        for aid in stale:
            del self._pending[aid]

    def _log_escalation(self, pending: PendingApproval) -> None:
        decision = ApprovalDecision(
            approval_id=pending.approval_id,
            customer_id=pending.workflow_result.customer_id,
            approver="system",
            decision=ApprovalStatus.ESCALATED,
            modifications=None,
            decided_at=datetime.now(timezone.utc),
        )
        self.audit.log_decision(decision, risk_level=pending.workflow_result.score.risk_level)

    # ------------------------------------------------------------------ #
    class RoleError(Exception):
        """Raised when a persona tries to approve a brief outside its authority."""

    def _authorized_role(self, pending: PendingApproval) -> str:
        """Which role may approve this brief: escalated → DRI, else CRM analyst."""
        return "dri" if pending.escalated else "crm"

    def approve(
        self,
        approval_id: str,
        approver: str,
        modifications: dict | None = None,
        role: str | None = None,
    ) -> ApprovalDecision:
        pending = self._require(approval_id)
        # Two-tier authority: escalated (high-value/CRITICAL) briefs are the DRI's
        # to approve; standard briefs are the CRM analyst's. Enforce when a role
        # is supplied (the API always supplies one).
        required = self._authorized_role(pending)
        if role is not None and role != required:
            raise self.RoleError(
                f"This brief requires {'DRI' if required == 'dri' else 'CRM Analyst'} "
                f"approval."
            )
        approver = approver.strip() if approver and approver.strip() else "unknown"
        status = ApprovalStatus.OVERRIDDEN if modifications else ApprovalStatus.APPROVED
        pending.status = status
        pending.approved_by = approver
        pending.approver_role = role or required
        decision = ApprovalDecision(
            approval_id=approval_id,
            customer_id=pending.workflow_result.customer_id,
            approver=approver,
            decision=status,
            modifications=modifications,
            decided_at=datetime.now(timezone.utc),
        )
        self.audit.log_decision(decision, risk_level=pending.workflow_result.score.risk_level)
        return decision

    def override(
        self, approval_id: str, approver: str, modifications: dict, role: str | None = None
    ) -> ApprovalDecision:
        return self.approve(approval_id, approver, modifications=modifications, role=role)

    def send(self, approval_id: str) -> PendingApproval:
        """Dispatch approved outreach (simulated). Only approved/overridden
        briefs can be sent; marks the approval SENT with a timestamp + channels."""
        pending = self._require(approval_id)
        if pending.status not in (ApprovalStatus.APPROVED, ApprovalStatus.OVERRIDDEN):
            raise self.RoleError("Only an approved brief can be sent.")
        outreach = pending.workflow_result.outreach or {}
        pending.sent_channels = [ch for ch in ("email", "sms", "push") if ch in outreach]
        pending.sent_at = datetime.now(timezone.utc)
        pending.status = ApprovalStatus.SENT
        self.audit.log_send(pending)
        return pending

    def escalate(self, approval_id: str, reason: str, escalated_to: str = "DRI") -> EscalationRecord:
        pending = self._require(approval_id)
        pending.status = ApprovalStatus.ESCALATED
        pending.escalated = True
        pending.escalation_reason = reason
        decision = ApprovalDecision(
            approval_id=approval_id,
            customer_id=pending.workflow_result.customer_id,
            approver=escalated_to,
            decision=ApprovalStatus.ESCALATED,
            modifications=None,
            decided_at=datetime.now(timezone.utc),
        )
        self.audit.log_decision(decision, risk_level=pending.workflow_result.score.risk_level)
        return EscalationRecord(
            approval_id=approval_id,
            customer_id=pending.workflow_result.customer_id,
            reason=reason,
            escalated_to=escalated_to,
            escalated_at=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------ #
    def _require(self, approval_id: str) -> PendingApproval:
        if approval_id not in self._pending:
            raise KeyError(f"Approval '{approval_id}' not found")
        return self._pending[approval_id]

    def get(self, approval_id: str) -> PendingApproval | None:
        return self._pending.get(approval_id)

    def get_for_customer(self, customer_id: str) -> PendingApproval | None:
        matches = [p for p in self._pending.values()
                   if p.workflow_result.customer_id == customer_id]
        if not matches:
            return None
        # Most recent submission wins.
        return max(matches, key=lambda p: p.submitted_at)

    def get_pending(self) -> list[PendingApproval]:
        """Return open (pending/escalated) approvals, CRITICAL first."""
        items = [
            p for p in self._pending.values()
            if p.status in (ApprovalStatus.PENDING, ApprovalStatus.ESCALATED)
        ]
        return sorted(
            items,
            key=lambda p: (p.workflow_result.score.risk_level.rank, p.workflow_result.score.composite_score),
            reverse=True,
        )

    def all(self) -> list[PendingApproval]:
        return list(self._pending.values())

    def counts(self) -> dict[str, int]:
        pending = sum(1 for p in self._pending.values() if p.status == ApprovalStatus.PENDING)
        approved = sum(
            1 for p in self._pending.values()
            if p.status in (ApprovalStatus.APPROVED, ApprovalStatus.OVERRIDDEN)
        )
        sent = sum(1 for p in self._pending.values() if p.status == ApprovalStatus.SENT)
        escalated = sum(1 for p in self._pending.values() if p.status == ApprovalStatus.ESCALATED)
        # "launched" = approved-but-not-yet-sent + sent (kept for existing metrics).
        return {
            "pending": pending,
            "approved": approved,
            "sent": sent,
            "launched": approved + sent,
            "escalated": escalated,
        }
