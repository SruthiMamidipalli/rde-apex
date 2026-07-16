"""Request / response schemas for the REST API layer."""

from __future__ import annotations

from pydantic import BaseModel

from models.domain import (
    ApprovalStatus,
    CustomerProfile,
    CustomerSignals,
    OutreachContent,
    RetentionBrief,
    RiskLevel,
)


# --------------------------------------------------------------------------- #
# Customer / scoring responses
# --------------------------------------------------------------------------- #
class CustomerSummary(BaseModel):
    """Lightweight customer row for the dashboard list."""

    customer_id: str
    name: str
    email: str
    tier: str
    composite_score: float
    risk_level: RiskLevel
    has_workflow: bool = False
    approval_status: ApprovalStatus | None = None
    ltv: float = 0.0
    value_rank: float = 0.0  # composite_score × ltv (risk × value)
    confidence: float = 0.0
    interaction_boost_applied: bool = False
    crm_divergence: bool = False
    top_signal: str | None = None


class AtRiskResponse(BaseModel):
    threshold: float
    count: int
    customers: list[CustomerSummary]


# --------------------------------------------------------------------------- #
# Approval requests
# --------------------------------------------------------------------------- #
class ApproveRequest(BaseModel):
    approver: str = "crm_analyst"
    role: str | None = None  # "crm" | "dri" — the acting persona


class OverrideRequest(BaseModel):
    approver: str = "crm_analyst"
    role: str | None = None
    modifications: dict


class EscalateRequest(BaseModel):
    approver: str = "crm_analyst"
    role: str | None = None
    reason: str = "CRITICAL risk exceeds value threshold"
    escalated_to: str = "DRI"


# --------------------------------------------------------------------------- #
# Dashboard responses
# --------------------------------------------------------------------------- #
class DashboardMetrics(BaseModel):
    total_customers: int
    total_at_risk: int
    average_churn_score: float
    campaigns_pending: int
    campaigns_launched: int
    risk_distribution: dict[str, int]


class ComparisonMetric(BaseModel):
    label: str
    manual: str
    agentic: str
    manual_value: float
    agentic_value: float
    improvement: str


class ComparisonResponse(BaseModel):
    metrics: list[ComparisonMetric]


class CostByModel(BaseModel):
    model: str
    requests: int
    input_tokens: int
    output_tokens: int
    cost: float


class CostByAgent(BaseModel):
    agent: str
    model: str
    requests: int
    input_tokens: int
    output_tokens: int
    cost: float


class CostOptimizationResponse(BaseModel):
    total_cost: float
    total_requests: int
    all_sonnet_baseline: float
    savings: float
    savings_percentage: float
    by_model: list[CostByModel]
    by_agent: list[CostByAgent] = []


# --------------------------------------------------------------------------- #
# MCP-style tool responses (also reused by the agent endpoints)
# --------------------------------------------------------------------------- #
class OutreachResponse(BaseModel):
    customer_id: str
    channel: str
    content: OutreachContent


class SignalsResponse(BaseModel):
    customer_id: str
    signals: CustomerSignals


class BriefResponse(BaseModel):
    customer_id: str
    brief: RetentionBrief | None = None
    available: bool = True
