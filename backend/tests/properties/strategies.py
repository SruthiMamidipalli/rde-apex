"""Shared Hypothesis strategies for building customer signals and profiles."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from hypothesis import strategies as st

from models.domain import (
    CustomerProfile,
    CustomerSignals,
    CustomerTier,
    GoogleAnalyticsData,
    KlaviyoData,
    SalesforceData,
    ShopifyData,
    YotpoData,
    ZendeskData,
)

NOW = datetime(2026, 7, 15, tzinfo=timezone.utc)


def _days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


salesforce_st = st.builds(
    SalesforceData,
    customer_id=st.just("T001"),
    engagement_score=st.floats(0, 100),
    last_interaction_date=st.integers(0, 120).map(_days_ago),
    health_score=st.floats(0, 100),
    lifecycle_stage=st.sampled_from(["Champion", "Engaged", "Declining", "At Risk"]),
)

shopify_st = st.builds(
    ShopifyData,
    customer_id=st.just("T001"),
    average_order_value=st.floats(10, 500),
    order_count_30d=st.integers(0, 10),
    discount_usage_rate=st.floats(0, 1),
    last_purchase_date=st.integers(0, 120).map(_days_ago),
    aov_change_pct=st.floats(-100, 100),
)

yotpo_st = st.builds(
    YotpoData,
    customer_id=st.just("T001"),
    points_balance=st.integers(0, 10000),
    points_earned_30d=st.integers(0, 2000),
    redemptions_30d=st.integers(0, 5),
    tier=st.sampled_from(list(CustomerTier)),
    days_since_last_redemption=st.integers(0, 200),
)

klaviyo_st = st.builds(
    KlaviyoData,
    customer_id=st.just("T001"),
    email_open_rate=st.floats(0, 1),
    email_click_rate=st.floats(0, 1),
    sms_response_rate=st.floats(0, 1),
    unsubscribed=st.booleans(),
    last_email_open_date=st.integers(0, 120).map(_days_ago),
)

zendesk_st = st.builds(
    ZendeskData,
    customer_id=st.just("T001"),
    open_tickets=st.integers(0, 5),
    avg_sentiment_score=st.floats(-1, 1),
    unresolved_tickets=st.integers(0, 5),
    avg_resolution_time_hours=st.floats(0, 200),
    last_ticket_date=st.integers(0, 120).map(_days_ago),
)

ga_st = st.builds(
    GoogleAnalyticsData,
    customer_id=st.just("T001"),
    sessions_30d=st.integers(0, 40),
    sessions_prev_30d=st.integers(0, 40),
    avg_session_duration_sec=st.floats(0, 600),
    pages_per_session=st.floats(0, 10),
    bounce_rate=st.floats(0, 1),
    session_change_pct=st.floats(-100, 100),
)


@st.composite
def customer_signals(draw, allow_missing: bool = True):
    """Build CustomerSignals with an arbitrary subset of systems present.

    At least one system is always present so scoring is well-defined.
    """
    def maybe(strategy):
        if allow_missing and draw(st.booleans()):
            return None
        return draw(strategy)

    sig = CustomerSignals(
        salesforce=maybe(salesforce_st),
        shopify=maybe(shopify_st),
        yotpo=maybe(yotpo_st),
        klaviyo=maybe(klaviyo_st),
        zendesk=maybe(zendesk_st),
        google_analytics=maybe(ga_st),
    )
    # Guarantee at least one present.
    if all(
        getattr(sig, s) is None
        for s in ("salesforce", "shopify", "yotpo", "klaviyo", "zendesk", "google_analytics")
    ):
        sig.shopify = draw(shopify_st)
    return sig


@st.composite
def customer_profile(draw, tier: CustomerTier | None = None):
    signals = draw(customer_signals())
    return CustomerProfile(
        customer_id="T001",
        name=draw(st.sampled_from(["Alex Kim", "Sam Lee", "Jordan Fox", "Robin Diaz"])),
        email="test@example.com",
        tier=tier if tier is not None else draw(st.sampled_from(list(CustomerTier))),
        join_date=_days_ago(draw(st.integers(30, 1500))),
        signals=signals,
    )
