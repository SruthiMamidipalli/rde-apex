"""Property tests for offer generation and multi-channel outreach.

Feature: apex-loyalty-ai-retention
Properties 4, 5, 6, 8, 9, 10, 11.

These exercise the DETERMINISTIC agent path (ModelRouter with no Bedrock
client), which is engineered to satisfy the same correctness properties as the
AI path.
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from models.domain import CustomerTier
from services.model_router import ModelRouter
from services.scoring_engine import ChurnScoreEngine
from services.retention_agent import RetentionAgentService
from tests.properties.strategies import customer_profile

agent = RetentionAgentService(ModelRouter(client=None), ChurnScoreEngine())
scoring = ChurnScoreEngine()

_TRANSACTION_TYPES = {"discount", "bonus_points"}
_ENGAGEMENT_TYPES = {"exclusive_access"}
_SUPPORT_TYPES = {"service_recovery"}


def _workflow(profile):
    score = scoring.calculate_score(profile.customer_id, profile.signals)
    analysis = agent.analyze_churn_drivers(profile, score)
    offer = agent.generate_offer(profile, analysis, score)
    outreach = agent.generate_outreach(profile, offer, score)
    return score, analysis, offer, outreach


# Property 4: Signal-to-Offer Type Mapping
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_4_signal_to_offer_mapping(profile):
    _, analysis, offer, _ = _workflow(profile)
    cat = analysis.dominant_category
    if cat == "transaction":
        assert offer.offer_type in _TRANSACTION_TYPES
    elif cat == "engagement":
        assert offer.offer_type in _ENGAGEMENT_TYPES
    elif cat == "support":
        assert offer.offer_type in _SUPPORT_TYPES


# Property 5: Offer Value Monotonic with Customer Tier
@given(data=st.data())
@settings(max_examples=100, deadline=None)
def test_property_5_offer_value_monotonic_with_tier(data):
    # Same signals, vary only tier — value_score must be non-decreasing in tier.
    base = data.draw(customer_profile(tier=CustomerTier.BRONZE))
    tiers = [CustomerTier.BRONZE, CustomerTier.SILVER, CustomerTier.GOLD, CustomerTier.PLATINUM]
    prev = -1.0
    for tier in tiers:
        p = base.model_copy(update={"tier": tier})
        _, analysis, offer, _ = _workflow(p)
        assert offer.value_score >= prev
        prev = offer.value_score


# Property 6: Confidence Score Bounded
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_6_confidence_bounded(profile):
    _, _, offer, _ = _workflow(profile)
    assert 0.0 <= offer.confidence_score <= 100.0


# Property 8: Outreach Channel Structure Validity
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_8_outreach_structure(profile):
    _, _, _, outreach = _workflow(profile)
    assert set(outreach.keys()) == {"email", "sms", "push"}
    email = outreach["email"]
    assert email.subject and email.subject.strip()
    assert email.body and email.body.strip()
    assert email.call_to_action and email.call_to_action.strip()


# Property 9: SMS Character Limit
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_9_sms_limit(profile):
    _, _, _, outreach = _workflow(profile)
    assert len(outreach["sms"].body) <= 160


# Property 10: Push Notification Character Limits
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_10_push_limits(profile):
    _, _, _, outreach = _workflow(profile)
    push = outreach["push"]
    assert len(push.title) <= 50
    assert len(push.body) <= 100


# Property 11: Outreach Content Personalization
@given(profile=customer_profile())
@settings(max_examples=150, deadline=None)
def test_property_11_personalization(profile):
    _, _, offer, outreach = _workflow(profile)
    first = profile.name.split()[0]
    for channel in ("email", "sms", "push"):
        c = outreach[channel]
        haystack = " ".join(filter(None, [c.subject, c.title, c.body]))
        assert first in haystack, f"{channel} missing name"
        # Offer value referenced somewhere in the channel content.
        assert offer.value in haystack, f"{channel} missing offer value"
