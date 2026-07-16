"""Audit trail service — persists every recommendation and decision to a JSON
log with full traceability, and supports multi-filter queries.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from config import settings
from models.domain import (
    ApprovalDecision,
    AuditEntry,
    RetentionWorkflowResult,
    RiskLevel,
)

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, storage_path: Path | str | None = None):
        self.path = Path(storage_path) if storage_path else settings.AUDIT_DIR / "audit_log.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._entries: list[AuditEntry] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            self._entries = []
            return
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
            self._entries = [AuditEntry(**e) for e in raw]
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            logger.error("Failed to load audit log (%s); starting empty", exc)
            self._entries = []

    def _persist(self) -> None:
        try:
            with self.path.open("w", encoding="utf-8") as fh:
                json.dump(
                    [json.loads(e.model_dump_json()) for e in self._entries],
                    fh,
                    indent=2,
                )
        except OSError as exc:
            logger.error("Failed to persist audit log: %s", exc)

    # ------------------------------------------------------------------ #
    def log_recommendation(self, result: RetentionWorkflowResult) -> str:
        entry = AuditEntry(
            entry_id=f"audit_{uuid.uuid4().hex[:12]}",
            customer_id=result.customer_id,
            timestamp=datetime.now(timezone.utc),
            event_type="recommendation",
            churn_score=result.score.composite_score,
            risk_level=result.score.risk_level,
            sources_consulted=[c.source for c in result.score.signal_contributions],
            offer_type=result.offer.offer_type,
            offer_value=result.offer.value,
            confidence_score=result.offer.confidence_score,
        )
        self._entries.append(entry)
        self._persist()
        return entry.entry_id

    def log_decision(self, decision: ApprovalDecision, risk_level: RiskLevel | None = None) -> str:
        entry = AuditEntry(
            entry_id=f"audit_{uuid.uuid4().hex[:12]}",
            customer_id=decision.customer_id,
            timestamp=decision.decided_at,
            event_type="escalation" if decision.decision.value == "escalated" else "approval",
            risk_level=risk_level,
            approver=decision.approver,
            decision=decision.decision.value,
            modifications=decision.modifications,
        )
        self._entries.append(entry)
        self._persist()
        return entry.entry_id

    # ------------------------------------------------------------------ #
    def query(
        self,
        customer_id: str | None = None,
        date_range: tuple[datetime, datetime] | None = None,
        risk_level: RiskLevel | None = None,
        approver: str | None = None,
    ) -> list[AuditEntry]:
        results = []
        for e in self._entries:
            if customer_id is not None and e.customer_id != customer_id:
                continue
            if risk_level is not None and e.risk_level != risk_level:
                continue
            if approver is not None and e.approver != approver:
                continue
            if date_range is not None:
                start, end = date_range
                ts = e.timestamp
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if not (start <= ts <= end):
                    continue
            results.append(e)
        return results

    def get_customer_history(self, customer_id: str) -> list[AuditEntry]:
        entries = self.query(customer_id=customer_id)
        return sorted(entries, key=lambda e: e.timestamp)

    def all_entries(self) -> list[AuditEntry]:
        return list(self._entries)
