"""Property tests for the churn scoring engine.

Feature: apex-loyalty-ai-retention
Properties 1, 2, 3.
"""

from __future__ import annotations

from hypothesis import given, settings

from models.domain import RiskLevel
from services.scoring_engine import ChurnScoreEngine
from tests.properties.strategies import customer_signals

engine = ChurnScoreEngine()


# Property 1: Composite Score Bounded Invariant
@given(signals=customer_signals())
@settings(max_examples=200, deadline=None)
def test_property_1_score_bounded_and_weights_normalize(signals):
    result = engine.calculate_score("T001", signals)
    assert 0.0 <= result.composite_score <= 100.0
    # Weights over present signals normalize to 1.0 (weights are stored rounded
    # to 4 dp for display, so allow tolerance for that rounding across 6 signals).
    total_weight = sum(c.weight for c in result.signal_contributions)
    if result.signal_contributions:
        assert abs(total_weight - 1.0) < 1e-3


# Property 2: Signal Contributions Sum to Composite Score
@given(signals=customer_signals())
@settings(max_examples=200, deadline=None)
def test_property_2_contributions_sum_to_score(signals):
    result = engine.calculate_score("T001", signals)
    summed = sum(c.weighted_contribution for c in result.signal_contributions)
    # Contributions sum to the BASE score; composite may add an interaction boost.
    assert abs(summed - result.base_score) < 0.5  # rounding tolerance
    # composite = clamp(base + boost); boost is non-negative.
    assert result.composite_score >= result.base_score - 0.5
    assert 0.0 <= result.composite_score <= 100.0
    valid_sources = {"salesforce", "shopify", "yotpo", "klaviyo", "zendesk", "google_analytics"}
    for c in result.signal_contributions:
        assert c.source in valid_sources


# Property 3: Risk Level Classification Boundaries
@given(score=__import__("hypothesis").strategies.floats(0, 100))
@settings(max_examples=300, deadline=None)
def test_property_3_risk_classification(score):
    level = engine.classify_risk(score)
    if score <= 25:
        assert level is RiskLevel.LOW
    elif score <= 50:
        assert level is RiskLevel.MEDIUM
    elif score <= 75:
        assert level is RiskLevel.HIGH
    else:
        assert level is RiskLevel.CRITICAL


def test_risk_boundary_values():
    assert engine.classify_risk(0) is RiskLevel.LOW
    assert engine.classify_risk(25) is RiskLevel.LOW
    assert engine.classify_risk(26) is RiskLevel.MEDIUM
    assert engine.classify_risk(50) is RiskLevel.MEDIUM
    assert engine.classify_risk(51) is RiskLevel.HIGH
    assert engine.classify_risk(75) is RiskLevel.HIGH
    assert engine.classify_risk(76) is RiskLevel.CRITICAL
    assert engine.classify_risk(100) is RiskLevel.CRITICAL
