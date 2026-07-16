"""Core domain models for the Apex Loyalty AI Retention system.

All Pydantic models representing the six source systems, composite customer
profiles, churn scoring results, AI-agent outputs, approval workflow state,
and audit trail entries.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Enumerations
# --------------------------------------------------------------------------- #
class RiskLevel(str, Enum):
    """Categorical churn-risk classification derived from the composite score."""

    LOW = "LOW"            # 0-25
    MEDIUM = "MEDIUM"      # 26-50
    HIGH = "HIGH"          # 51-75
    CRITICAL = "CRITICAL"  # 76-100

    @property
    def rank(self) -> int:
        """Priority rank — higher means processed first (CRITICAL = 3)."""
        return {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}[self.value]


class CustomerTier(str, Enum):
    """Loyalty tier from Yotpo. Higher tier => higher-value offers."""

    BRONZE = "Bronze"
    SILVER = "Silver"
    GOLD = "Gold"
    PLATINUM = "Platinum"

    @property
    def rank(self) -> int:
        return {"Bronze": 0, "Silver": 1, "Gold": 2, "Platinum": 3}[self.value]


# --------------------------------------------------------------------------- #
# Source-system signal models
# --------------------------------------------------------------------------- #
class SalesforceData(BaseModel):
    customer_id: str
    engagement_score: float = Field(ge=0, le=100)
    last_interaction_date: datetime
    health_score: float = Field(ge=0, le=100)
    lifecycle_stage: str


class ShopifyData(BaseModel):
    customer_id: str
    average_order_value: float
    order_count_30d: int
    discount_usage_rate: float = Field(ge=0, le=1)
    last_purchase_date: datetime
    aov_change_pct: float  # negative = decline


class YotpoData(BaseModel):
    customer_id: str
    points_balance: int
    points_earned_30d: int
    redemptions_30d: int
    tier: CustomerTier
    days_since_last_redemption: int


class KlaviyoData(BaseModel):
    customer_id: str
    email_open_rate: float = Field(ge=0, le=1)
    email_click_rate: float = Field(ge=0, le=1)
    sms_response_rate: float = Field(ge=0, le=1)
    unsubscribed: bool
    last_email_open_date: datetime | None = None


class ZendeskData(BaseModel):
    customer_id: str
    open_tickets: int
    avg_sentiment_score: float = Field(ge=-1, le=1)  # -1 negative, +1 positive
    unresolved_tickets: int
    avg_resolution_time_hours: float
    last_ticket_date: datetime | None = None


class GoogleAnalyticsData(BaseModel):
    customer_id: str
    sessions_30d: int
    sessions_prev_30d: int
    avg_session_duration_sec: float
    pages_per_session: float
    bounce_rate: float = Field(ge=0, le=1)
    session_change_pct: float  # negative = decline


# --------------------------------------------------------------------------- #
# Composite signal / scoring models
# --------------------------------------------------------------------------- #
class CustomerSignals(BaseModel):
    salesforce: SalesforceData | None = None
    shopify: ShopifyData | None = None
    yotpo: YotpoData | None = None
    klaviyo: KlaviyoData | None = None
    zendesk: ZendeskData | None = None
    google_analytics: GoogleAnalyticsData | None = None


class SignalContribution(BaseModel):
    source: str
    signal_name: str
    raw_value: float
    normalized_score: float  # 0-100 (higher = more churn risk)
    weight: float
    weighted_contribution: float


class ChurnScoreResult(BaseModel):
    customer_id: str
    composite_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    signal_contributions: list[SignalContribution]
    computed_at: datetime
    missing_signals: list[str] = Field(default_factory=list)
    # Base weighted score before interaction boost (contributions sum to this).
    base_score: float = 0.0
    # Additive lift when high-risk signals co-occur (GA collapse + zero
    # redemption + unresolved ticket). composite_score = clamp(base + boost).
    interaction_boost: float = 0.0
    interaction_boost_applied: bool = False
    # Model confidence 0-100 (data completeness + signal agreement).
    confidence: float = 0.0
    # True when CRM rates the customer healthy (health >= 70) yet the composite
    # says high-risk (>= 71) — the core "trust the composite, not the CRM" case.
    crm_divergence: bool = False
    crm_health_score: float | None = None
    model_version: str = "v1.0"


class CustomerProfile(BaseModel):
    customer_id: str
    name: str
    email: str
    tier: CustomerTier
    join_date: datetime
    ltv: float = 0.0  # lifetime value ($) — the "value" half of risk x value
    signals: CustomerSignals
    churn_score: ChurnScoreResult | None = None


# --------------------------------------------------------------------------- #
# AI-agent output models
# --------------------------------------------------------------------------- #
class ChurnDriver(BaseModel):
    driver: str
    source_system: str
    evidence: str
    severity: str  # "high" | "medium" | "low"


class ChurnAnalysis(BaseModel):
    customer_id: str
    drivers: list[ChurnDriver]
    summary: str
    dominant_category: str = "transaction"  # transaction | engagement | support
    generated_at: datetime


class RetentionOffer(BaseModel):
    offer_id: str
    customer_id: str
    offer_type: str  # discount | bonus_points | exclusive_access | service_recovery
    description: str
    value: str
    value_score: float = 0.0  # numeric magnitude used for tier-monotonicity checks
    matched_signal: str
    confidence_score: float = Field(ge=0, le=100)
    tier_justification: str


class OutreachContent(BaseModel):
    channel: str  # email | sms | push
    subject: str | None = None  # email only
    title: str | None = None    # push only
    body: str
    call_to_action: str | None = None
    character_count: int | None = None


class RetentionBrief(BaseModel):
    brief_id: str
    customer_id: str
    customer_summary: str
    risk_classification: RiskLevel
    churn_score: float
    signal_breakdown: list[SignalContribution]
    historical_comparison: str
    recommended_offer: RetentionOffer
    outreach_strategy: str
    generated_at: datetime


class RetentionWorkflowResult(BaseModel):
    workflow_id: str
    customer_id: str
    score: ChurnScoreResult
    analysis: ChurnAnalysis
    offer: RetentionOffer
    brief: RetentionBrief
    outreach: dict[str, OutreachContent]
    elapsed_seconds: float
    completed_at: datetime
    degraded: bool = False  # True if AI generation fell back to deterministic output


# --------------------------------------------------------------------------- #
# Approval-workflow models
# --------------------------------------------------------------------------- #
class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    OVERRIDDEN = "overridden"
    ESCALATED = "escalated"


class PendingApproval(BaseModel):
    approval_id: str
    workflow_result: RetentionWorkflowResult
    status: ApprovalStatus = ApprovalStatus.PENDING
    submitted_at: datetime
    time_since_signal_seconds: float
    escalated: bool = False
    escalation_reason: str | None = None


class ApprovalDecision(BaseModel):
    approval_id: str
    customer_id: str
    approver: str
    decision: ApprovalStatus
    modifications: dict | None = None
    decided_at: datetime


class EscalationRecord(BaseModel):
    approval_id: str
    customer_id: str
    reason: str
    escalated_to: str
    escalated_at: datetime


# --------------------------------------------------------------------------- #
# Audit models
# --------------------------------------------------------------------------- #
class AuditEntry(BaseModel):
    entry_id: str
    customer_id: str
    timestamp: datetime
    event_type: str  # recommendation | approval | escalation
    churn_score: float | None = None
    risk_level: RiskLevel | None = None
    sources_consulted: list[str] = Field(default_factory=list)
    offer_type: str | None = None
    offer_value: str | None = None
    confidence_score: float | None = None
    approver: str | None = None
    decision: str | None = None
    modifications: dict | None = None
