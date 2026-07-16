"""Weighted composite churn-score calculator.

The engine converts each source system's raw signals into a normalized
0-100 "churn risk" sub-score (higher = more likely to churn), then combines
them with configurable weights. Missing systems are handled by re-normalizing
the remaining weights so they always sum to 1.0 — keeping the composite score
in [0, 100] for any subset of present signals.
"""

from __future__ import annotations

from datetime import datetime, timezone

from models.domain import (
    ChurnScoreResult,
    CustomerSignals,
    RiskLevel,
    SignalContribution,
)


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


class ChurnScoreEngine:
    """Computes composite churn scores from multi-system signals."""

    # Signal key -> (weight, source system, human-readable signal name)
    DEFAULT_WEIGHTS: dict[str, float] = {
        "transaction_recency": 0.25,
        "engagement_drop": 0.20,
        "support_sentiment": 0.15,
        "session_decline": 0.15,
        "loyalty_inactivity": 0.15,
        "email_disengagement": 0.10,
    }

    # Which source system produces each weighted signal.
    SIGNAL_SOURCE: dict[str, str] = {
        "transaction_recency": "shopify",
        "engagement_drop": "salesforce",
        "support_sentiment": "zendesk",
        "session_decline": "google_analytics",
        "loyalty_inactivity": "yotpo",
        "email_disengagement": "klaviyo",
    }

    SIGNAL_LABEL: dict[str, str] = {
        "transaction_recency": "Transaction recency & AOV decline",
        "engagement_drop": "CRM engagement / health drop",
        "support_sentiment": "Support sentiment & unresolved tickets",
        "session_decline": "Web session frequency decline",
        "loyalty_inactivity": "Loyalty redemption inactivity",
        "email_disengagement": "Email / SMS disengagement",
    }

    def __init__(self, weights: dict[str, float] | None = None):
        self.weights = dict(weights) if weights else dict(self.DEFAULT_WEIGHTS)

    # ------------------------------------------------------------------ #
    # Per-signal normalization: raw signals -> 0-100 churn-risk sub-score
    # ------------------------------------------------------------------ #
    def _transaction_recency_score(self, sf) -> float:
        """Shopify: declining AOV + purchase recency => higher risk."""
        # AOV change: -100% => 100 risk, +100% => 0 risk.
        aov_risk = _clamp(-sf.aov_change_pct)  # aov_change_pct is a percentage
        # Recency: days since last purchase, 90+ days => max risk.
        days = (datetime.now(timezone.utc) - _aware(sf.last_purchase_date)).days
        recency_risk = _clamp(days / 90 * 100)
        # Order volume: 0 orders in 30d => high risk.
        volume_risk = _clamp((1 - min(sf.order_count_30d, 5) / 5) * 100)
        return _clamp(0.45 * aov_risk + 0.35 * recency_risk + 0.20 * volume_risk)

    def _engagement_drop_score(self, sf) -> float:
        """Salesforce: low engagement & health => higher risk."""
        engagement_risk = _clamp(100 - sf.engagement_score)
        health_risk = _clamp(100 - sf.health_score)
        return _clamp(0.5 * engagement_risk + 0.5 * health_risk)

    def _support_sentiment_score(self, zd) -> float:
        """Zendesk: negative sentiment + unresolved tickets => higher risk."""
        # Sentiment -1..+1 -> risk 100..0.
        sentiment_risk = _clamp((1 - zd.avg_sentiment_score) / 2 * 100)
        unresolved_risk = _clamp(min(zd.unresolved_tickets, 5) / 5 * 100)
        return _clamp(0.7 * sentiment_risk + 0.3 * unresolved_risk)

    def _session_decline_score(self, ga) -> float:
        """Google Analytics: session frequency decline + bounce => higher risk."""
        decline_risk = _clamp(-ga.session_change_pct)
        bounce_risk = _clamp(ga.bounce_rate * 100)
        return _clamp(0.7 * decline_risk + 0.3 * bounce_risk)

    def _loyalty_inactivity_score(self, yp) -> float:
        """Yotpo: no recent redemptions => higher risk."""
        # 120+ days since redemption => max risk.
        recency_risk = _clamp(yp.days_since_last_redemption / 120 * 100)
        redemption_risk = 100.0 if yp.redemptions_30d == 0 else _clamp(
            (1 - min(yp.redemptions_30d, 3) / 3) * 100
        )
        return _clamp(0.6 * recency_risk + 0.4 * redemption_risk)

    def _email_disengagement_score(self, kv) -> float:
        """Klaviyo: low open/click, unsubscribe => higher risk."""
        if kv.unsubscribed:
            return 100.0
        open_risk = _clamp((1 - kv.email_open_rate) * 100)
        click_risk = _clamp((1 - kv.email_click_rate) * 100)
        sms_risk = _clamp((1 - kv.sms_response_rate) * 100)
        return _clamp(0.5 * open_risk + 0.3 * click_risk + 0.2 * sms_risk)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def _raw_signal_scores(self, signals: CustomerSignals) -> dict[str, float]:
        """Return {signal_key: normalized_score} for every present system."""
        scores: dict[str, float] = {}
        if signals.shopify is not None:
            scores["transaction_recency"] = self._transaction_recency_score(
                signals.shopify
            )
        if signals.salesforce is not None:
            scores["engagement_drop"] = self._engagement_drop_score(signals.salesforce)
        if signals.zendesk is not None:
            scores["support_sentiment"] = self._support_sentiment_score(signals.zendesk)
        if signals.google_analytics is not None:
            scores["session_decline"] = self._session_decline_score(
                signals.google_analytics
            )
        if signals.yotpo is not None:
            scores["loyalty_inactivity"] = self._loyalty_inactivity_score(signals.yotpo)
        if signals.klaviyo is not None:
            scores["email_disengagement"] = self._email_disengagement_score(
                signals.klaviyo
            )
        return scores

    def normalize_weights(self, available_signals: list[str]) -> dict[str, float]:
        """Re-normalize configured weights across only the available signals."""
        available = [s for s in available_signals if s in self.weights]
        total = sum(self.weights[s] for s in available)
        if total <= 0:
            return {}
        return {s: self.weights[s] / total for s in available}

    def classify_risk(self, score: float) -> RiskLevel:
        """Total function: map any score in [0, 100] to a RiskLevel."""
        if score <= 25:
            return RiskLevel.LOW
        if score <= 50:
            return RiskLevel.MEDIUM
        if score <= 75:
            return RiskLevel.HIGH
        return RiskLevel.CRITICAL

    # ------------------------------------------------------------------ #
    # Interaction boost (§4): when the earliest + strongest churn signals
    # co-occur, the true risk is greater than the linear blend suggests.
    # This is what lifts the case-study exemplar into the CRITICAL band.
    # ------------------------------------------------------------------ #
    def _interaction_boost(
        self, raw_scores: dict[str, float], signals: CustomerSignals
    ) -> tuple[float, bool]:
        """Return (boost_points, applied). Boost is additive on the base score."""
        ga_collapse = raw_scores.get("session_decline", 0) >= 60
        zero_redemption = (
            signals.yotpo is not None and signals.yotpo.redemptions_30d == 0
        )
        unresolved_ticket = (
            signals.zendesk is not None and signals.zendesk.unresolved_tickets >= 1
        )
        aov_erosion = raw_scores.get("transaction_recency", 0) >= 60

        co_occurring = sum(
            [ga_collapse, zero_redemption, unresolved_ticket, aov_erosion]
        )
        if co_occurring >= 3:
            # 3 signals => +8, all 4 => +12. Bounded so it never dominates.
            return (4.0 + 4.0 * (co_occurring - 2), True)
        return (0.0, False)

    def _confidence(
        self, present: list[str], contributions: list[SignalContribution]
    ) -> float:
        """Confidence 0-100 from data completeness + signal agreement."""
        completeness = len(present) / len(self.weights)  # fraction of systems present
        if contributions:
            scores = [c.normalized_score for c in contributions]
            mean = sum(scores) / len(scores)
            spread = sum(abs(s - mean) for s in scores) / len(scores)
            agreement = max(0.0, 1.0 - spread / 50.0)  # lower spread => higher agreement
        else:
            agreement = 0.0
        return round(_clamp((0.6 * completeness + 0.4 * agreement) * 100), 1)

    def calculate_score(self, customer_id: str, signals: CustomerSignals) -> ChurnScoreResult:
        raw_scores = self._raw_signal_scores(signals)
        present = list(raw_scores.keys())
        norm_weights = self.normalize_weights(present)

        contributions: list[SignalContribution] = []
        base = 0.0
        for key in present:
            weight = norm_weights.get(key, 0.0)
            normalized = raw_scores[key]
            weighted = normalized * weight
            base += weighted
            contributions.append(
                SignalContribution(
                    source=self.SIGNAL_SOURCE[key],
                    signal_name=self.SIGNAL_LABEL[key],
                    raw_value=round(normalized, 2),
                    normalized_score=round(normalized, 2),
                    weight=round(weight, 4),
                    weighted_contribution=round(weighted, 2),
                )
            )

        base = round(_clamp(base), 2)
        boost, boost_applied = self._interaction_boost(raw_scores, signals)
        composite = round(_clamp(base + boost), 2)
        missing = [k for k in self.weights if k not in present]

        # CRM-vs-composite divergence: CRM says healthy but composite says risky.
        crm_health = signals.salesforce.health_score if signals.salesforce else None
        crm_divergence = (
            crm_health is not None and crm_health >= 70 and composite >= 71
        )

        return ChurnScoreResult(
            customer_id=customer_id,
            composite_score=composite,
            risk_level=self.classify_risk(composite),
            signal_contributions=contributions,
            computed_at=datetime.now(timezone.utc),
            missing_signals=[self.SIGNAL_SOURCE[m] for m in missing],
            base_score=base,
            interaction_boost=round(boost, 2),
            interaction_boost_applied=boost_applied,
            confidence=self._confidence(present, contributions),
            crm_divergence=crm_divergence,
            crm_health_score=crm_health,
            model_version="v1.0",
        )


def _aware(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware (assume UTC if naive)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
