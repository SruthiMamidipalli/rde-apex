"""REST API endpoints for the Apex Loyalty AI Retention system."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException, Query

from models.api_models import (
    ApproveRequest,
    AtRiskResponse,
    ComparisonMetric,
    ComparisonResponse,
    CostByAgent,
    CostByModel,
    CostOptimizationResponse,
    CustomerSummary,
    DashboardMetrics,
    EscalateRequest,
    OverrideRequest,
)
from models.domain import ApprovalStatus
from services.orchestrator import get_orchestrator

router = APIRouter(prefix="/api")


def _summary(orch, profile) -> CustomerSummary:
    score = orch.get_score(profile.customer_id)
    pending = orch.approvals.get_for_customer(profile.customer_id)
    return CustomerSummary(
        customer_id=profile.customer_id,
        name=profile.name,
        email=profile.email,
        tier=profile.tier.value,
        composite_score=score.composite_score,
        risk_level=score.risk_level,
        has_workflow=orch.get_workflow(profile.customer_id) is not None,
        approval_status=pending.status if pending else None,
        ltv=profile.ltv,
        value_rank=round(score.composite_score * profile.ltv, 0),
        confidence=score.confidence,
        interaction_boost_applied=score.interaction_boost_applied,
        crm_divergence=score.crm_divergence,
        top_signal=(
            max(score.signal_contributions,
                key=lambda c: c.weighted_contribution).signal_name
            if score.signal_contributions else None
        ),
    )


# --------------------------------------------------------------------------- #
# Customer endpoints
# --------------------------------------------------------------------------- #
@router.get("/customers", response_model=list[CustomerSummary])
def list_customers():
    orch = get_orchestrator()
    orch.score_all()
    profiles = orch.data_loader.get_all_customers()
    summaries = [_summary(orch, p) for p in profiles]
    # Property 14: sorted by composite score descending.
    summaries.sort(key=lambda s: s.composite_score, reverse=True)
    return summaries


@router.get("/customers/{customer_id}")
def get_customer(customer_id: str):
    orch = get_orchestrator()
    profile = orch.data_loader.get_customer(customer_id)
    if profile is None:
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    profile.churn_score = orch.get_score(customer_id)
    return profile


@router.get("/customers/{customer_id}/signals")
def get_customer_signals(customer_id: str):
    orch = get_orchestrator()
    signals = orch.data_loader.get_customer_signals(customer_id)
    if signals is None:
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    return {"customer_id": customer_id, "signals": signals}


@router.get("/customers/{customer_id}/audit")
def get_customer_audit(customer_id: str):
    orch = get_orchestrator()
    if not orch.data_loader.exists(customer_id):
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    return orch.audit.get_customer_history(customer_id)


# --------------------------------------------------------------------------- #
# Scoring endpoints
# --------------------------------------------------------------------------- #
@router.post("/score/{customer_id}")
def score_customer(customer_id: str):
    orch = get_orchestrator()
    result = orch.score_customer(customer_id)
    if result is None:
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    return result


@router.get("/score/at-risk", response_model=AtRiskResponse)
def at_risk(threshold: float = Query(50, ge=0, le=100)):
    orch = get_orchestrator()
    orch.score_all()
    profiles = orch.data_loader.get_all_customers()
    summaries = [_summary(orch, p) for p in profiles]
    at = [s for s in summaries if s.composite_score > threshold]
    at.sort(key=lambda s: s.composite_score, reverse=True)
    return AtRiskResponse(threshold=threshold, count=len(at), customers=at)


# --------------------------------------------------------------------------- #
# Agent endpoints
# --------------------------------------------------------------------------- #
def _require_crm(role: str | None):
    """Generating briefs is the CRM Analyst's job. DRI reviews escalations only."""
    if role == "dri":
        raise HTTPException(
            403, "Generating retention briefs is the CRM Analyst's role. "
            "As DRI you review escalated high-value briefs."
        )


@router.post("/agent/run/{customer_id}")
def run_agent(customer_id: str, role: str | None = Query(None)):
    _require_crm(role)
    orch = get_orchestrator()
    result = orch.run_workflow(customer_id, submit=True)
    if result is None:
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    return result


@router.post("/agent/run-all")
def run_all_triggered(threshold: float = Query(50, ge=0, le=100), role: str | None = Query(None)):
    _require_crm(role)
    orch = get_orchestrator()
    results = orch.run_triggered_workflows(threshold)
    return {"processed": len(results), "workflow_ids": [r.workflow_id for r in results]}


@router.get("/agent/brief/{customer_id}")
def get_brief(customer_id: str):
    orch = get_orchestrator()
    if not orch.data_loader.exists(customer_id):
        raise HTTPException(404, f"Customer '{customer_id}' not found")
    wf = orch.get_workflow(customer_id)
    if wf is None:
        return {"customer_id": customer_id, "available": False, "brief": None}
    return {"customer_id": customer_id, "available": True, "brief": wf.brief,
            "workflow": wf}


# --------------------------------------------------------------------------- #
# Approval endpoints
# --------------------------------------------------------------------------- #
def _name_for(orch, customer_id: str) -> str:
    """Resolve a display name; never leak the raw customer id to the UI."""
    profile = orch.data_loader.get_customer(customer_id)
    return profile.name if profile else "Customer"


@router.get("/approvals/pending")
def pending_approvals():
    orch = get_orchestrator()
    out = []
    for p in orch.approvals.get_pending():
        d = p.model_dump(mode="json")
        d["customer_name"] = _name_for(orch, p.workflow_result.customer_id)
        out.append(d)
    return out


@router.post("/approvals/{approval_id}/approve")
def approve(approval_id: str, req: ApproveRequest):
    orch = get_orchestrator()
    try:
        return orch.approvals.approve(approval_id, req.approver, role=req.role)
    except KeyError:
        raise HTTPException(404, f"Approval '{approval_id}' not found")
    except orch.approvals.RoleError as exc:
        raise HTTPException(403, str(exc))


@router.post("/approvals/{approval_id}/override")
def override(approval_id: str, req: OverrideRequest):
    orch = get_orchestrator()
    try:
        return orch.approvals.override(approval_id, req.approver, req.modifications, role=req.role)
    except KeyError:
        raise HTTPException(404, f"Approval '{approval_id}' not found")
    except orch.approvals.RoleError as exc:
        raise HTTPException(403, str(exc))


@router.post("/approvals/{approval_id}/escalate")
def escalate(approval_id: str, req: EscalateRequest):
    orch = get_orchestrator()
    try:
        return orch.approvals.escalate(approval_id, req.reason, req.escalated_to)
    except KeyError:
        raise HTTPException(404, f"Approval '{approval_id}' not found")


@router.post("/approvals/{approval_id}/send")
def send_outreach(approval_id: str):
    """Dispatch approved outreach (simulated). Marks the brief SENT."""
    orch = get_orchestrator()
    try:
        pending = orch.approvals.send(approval_id)
    except KeyError:
        raise HTTPException(404, f"Approval '{approval_id}' not found")
    except orch.approvals.RoleError as exc:
        raise HTTPException(409, str(exc))
    return {
        "approval_id": pending.approval_id,
        "status": pending.status.value,
        "sent_at": pending.sent_at,
        "sent_channels": pending.sent_channels,
        "customer_name": _name_for(orch, pending.workflow_result.customer_id),
    }


# --------------------------------------------------------------------------- #
# Dashboard endpoints
# --------------------------------------------------------------------------- #
@router.get("/dashboard/metrics", response_model=DashboardMetrics)
def dashboard_metrics():
    orch = get_orchestrator()
    return orch.metrics()


@router.get("/dashboard/comparison", response_model=ComparisonResponse)
def dashboard_comparison():
    metrics = [
        ComparisonMetric(
            label="Campaign launch time", manual="4-7 days", agentic="< 2 minutes",
            manual_value=5.5 * 24 * 60, agentic_value=2.0,
            improvement="~99.99% faster",
        ),
        ComparisonMetric(
            label="Churn detection", manual="Reactive (post-churn)", agentic="14 days proactive",
            manual_value=0, agentic_value=14, improvement="Proactive intervention",
        ),
        ComparisonMetric(
            label="Offer personalization rate", manual="8%", agentic="85%+",
            manual_value=8, agentic_value=85, improvement="+77 pts",
        ),
        ComparisonMetric(
            label="Analyst hours per segment", manual="4-8 hours", agentic="< 5 minutes",
            manual_value=6, agentic_value=0.08, improvement="~98% reduction",
        ),
        ComparisonMetric(
            label="Projected annual churn", manual="28%", agentic="< 14%",
            manual_value=28, agentic_value=14, improvement="50% reduction",
        ),
    ]
    return ComparisonResponse(metrics=metrics)


@router.get("/dashboard/cost-optimization", response_model=CostOptimizationResponse)
def cost_optimization():
    orch = get_orchestrator()
    summary = orch.router.get_cost_summary()
    return CostOptimizationResponse(
        total_cost=summary["total_cost"],
        total_requests=summary["total_requests"],
        all_sonnet_baseline=summary["all_sonnet_baseline"],
        savings=summary["savings"],
        savings_percentage=summary["savings_percentage"],
        by_model=[CostByModel(**m) for m in summary["by_model"]],
        by_agent=[CostByAgent(**a) for a in summary.get("by_agent", [])],
    )


@router.get("/health")
def health():
    orch = get_orchestrator()
    return {
        "status": "ok",
        "mode": "degraded" if orch.degraded else "full",
        "bedrock_available": not orch.degraded,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# --------------------------------------------------------------------------- #
# KPI endpoints (exact CSV formulas, per navigation area)
# --------------------------------------------------------------------------- #
@router.get("/kpi/command-center")
def kpi_command_center():
    return get_orchestrator().kpi.command_center()


@router.get("/kpi/at-risk-queue")
def kpi_at_risk_queue():
    return get_orchestrator().kpi.at_risk_queue()


@router.get("/kpi/impact-roi")
def kpi_impact_roi():
    return get_orchestrator().kpi.impact_roi()


@router.get("/kpi/admin")
def kpi_admin():
    return get_orchestrator().kpi.admin()


@router.get("/kpi/cost-per-customer")
def kpi_cost_per_customer():
    orch = get_orchestrator()
    scored = orch.kpi._scored()
    return {"cost_per_customer": orch.kpi.cost_per_customer(scored)}


# --------------------------------------------------------------------------- #
# Command-center live widgets
# --------------------------------------------------------------------------- #
@router.get("/dashboard/signals-feed")
def signals_feed():
    return {"events": get_orchestrator().signals_feed()}


@router.get("/dashboard/system-health")
def system_health():
    connectors = get_orchestrator().system_health()
    healthy = sum(1 for c in connectors if c["status"] == "green")
    return {"connectors": connectors, "healthy": healthy, "total": len(connectors)}


# --------------------------------------------------------------------------- #
# At-Risk Queue — risk × value ranking
# --------------------------------------------------------------------------- #
@router.get("/queue/ranked")
def ranked_queue(threshold: float = Query(50, ge=0, le=100)):
    orch = get_orchestrator()
    orch.score_all()
    profiles = orch.data_loader.get_all_customers()
    summaries = [_summary(orch, p) for p in profiles]
    at = [s for s in summaries if s.composite_score > threshold]
    at.sort(key=lambda s: s.value_rank, reverse=True)  # risk × value
    return {"threshold": threshold, "count": len(at), "customers": at}


# --------------------------------------------------------------------------- #
# Campaigns
# --------------------------------------------------------------------------- #
@router.get("/campaigns")
def campaigns():
    """Campaigns derived from approvals. Performance is only simulated once the
    outreach has actually been SENT — approved-but-unsent briefs are staged."""
    orch = get_orchestrator()
    out = []
    for appr in orch.approvals.all():
        wf = appr.workflow_result
        status = appr.status.value
        score = wf.score.composite_score
        sent = status == "sent"
        approved = status in ("approved", "overridden")
        # Human-readable stage label.
        if sent:
            label = "Sent"
        elif approved:
            label = "Ready to send"
        elif status == "escalated":
            label = "Awaiting DRI approval"
        else:
            label = "Awaiting approval"
        out.append({
            "campaign_id": appr.approval_id,
            "customer_id": wf.customer_id,
            "customer_name": _name_for(orch, wf.customer_id),
            "offer": wf.offer.value,
            "offer_type": wf.offer.offer_type,
            "channel": " → ".join(c.upper() for c in appr.sent_channels) if sent
                       else ("SMS → Email" if score >= 76 else "Email"),
            "status": label,
            "sent": sent,
            "sendable": approved,  # approved but not yet sent → show Send button
            "sent_at": appr.sent_at,
            "approved_by": appr.approved_by,
            # Performance only exists after a real send.
            "open_rate": round(min(0.9, 0.35 + (100 - score) / 300), 2) if sent else None,
            "redeem_rate": round(min(0.6, 0.15 + (100 - score) / 500), 2) if sent else None,
            "confidence": wf.offer.confidence_score,
        })
    return {"campaigns": out, "count": len(out)}


# --------------------------------------------------------------------------- #
# Admin & Governance
# --------------------------------------------------------------------------- #
@router.get("/admin/config")
def admin_config():
    orch = get_orchestrator()
    return {
        "weights": orch.scoring.weights,
        "signal_sources": orch.scoring.SIGNAL_SOURCE,
        "signal_labels": orch.scoring.SIGNAL_LABEL,
        "thresholds": {
            "LOW": "0-25", "MEDIUM": "26-50", "HIGH": "51-75", "CRITICAL": "76-100",
        },
        "model_version": "v1.0",
    }


@router.get("/admin/audit")
def admin_audit(limit: int = Query(100, ge=1, le=1000)):
    orch = get_orchestrator()
    entries = orch.audit.all_entries()
    entries = sorted(entries, key=lambda e: e.timestamp, reverse=True)[:limit]
    out = []
    for e in entries:
        d = e.model_dump(mode="json")
        d["customer_name"] = _name_for(orch, e.customer_id)
        out.append(d)
    return {"entries": out, "count": len(out)}


# --------------------------------------------------------------------------- #
# Chatbot (context-aware, grounded, cited)
# --------------------------------------------------------------------------- #
@router.post("/chatbot")
def chatbot(payload: dict = Body(...)):
    orch = get_orchestrator()
    message = (payload or {}).get("message", "").strip()
    if not message:
        raise HTTPException(400, "message is required")
    context = (payload or {}).get("context", {})
    return orch.chatbot.answer(message, context)
