"""Seed script — generates realistic mock data for 25 customers across all six
source systems and all four risk levels.

Run directly (`python data/seed.py`) or import `seed()` and call it at startup.
Data is deterministic (no randomness) so demos are reproducible. Each customer
is authored to land in a target risk band once run through the scoring engine,
with a couple of customers intentionally missing signals from some systems to
exercise weight re-normalization.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

_DIR = Path(__file__).resolve().parent
_MOCK = _DIR / "mock"
_AUDIT = _DIR / "audit"

NOW = datetime(2026, 7, 15, tzinfo=timezone.utc)


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat()


# --------------------------------------------------------------------------- #
# Customer roster: (id, name, email, tier, join_days_ago, risk_target)
# risk_target drives the signal profile below.
# --------------------------------------------------------------------------- #
ROSTER = [
    # CRITICAL (76-100)
    ("C001", "Marcus Chen", "marcus.chen@example.com", "Platinum", 1120, "critical"),
    ("C002", "Priya Nair", "priya.nair@example.com", "Gold", 890, "critical"),
    ("C003", "David Okafor", "david.okafor@example.com", "Silver", 640, "critical"),
    ("C004", "Elena Volkova", "elena.volkova@example.com", "Platinum", 1450, "critical"),
    ("C005", "James Sullivan", "james.sullivan@example.com", "Bronze", 210, "critical"),
    # HIGH (51-75)
    ("C006", "Aisha Rahman", "aisha.rahman@example.com", "Gold", 720, "high"),
    ("C007", "Tom Baker", "tom.baker@example.com", "Silver", 540, "high"),
    ("C008", "Sofia Rossi", "sofia.rossi@example.com", "Platinum", 980, "high"),
    ("C009", "Liam Murphy", "liam.murphy@example.com", "Bronze", 300, "high"),
    ("C010", "Yuki Tanaka", "yuki.tanaka@example.com", "Gold", 660, "high"),
    ("C011", "Fatima Al-Sayed", "fatima.alsayed@example.com", "Silver", 480, "high"),
    ("C012", "Carlos Mendez", "carlos.mendez@example.com", "Bronze", 190, "high"),
    # MEDIUM (26-50)
    ("C013", "Nina Kowalski", "nina.kowalski@example.com", "Gold", 610, "medium"),
    ("C014", "Raj Patel", "raj.patel@example.com", "Silver", 430, "medium"),
    ("C015", "Grace Kim", "grace.kim@example.com", "Platinum", 1030, "medium"),
    ("C016", "Omar Farouk", "omar.farouk@example.com", "Bronze", 260, "medium"),
    ("C017", "Isabella Santos", "isabella.santos@example.com", "Silver", 500, "medium"),
    ("C018", "Wei Zhang", "wei.zhang@example.com", "Gold", 700, "medium"),
    # LOW (0-25)
    ("C019", "Hannah Schmidt", "hannah.schmidt@example.com", "Platinum", 1200, "low"),
    ("C020", "Leo Ferreira", "leo.ferreira@example.com", "Gold", 750, "low"),
    ("C021", "Maya Johnson", "maya.johnson@example.com", "Silver", 520, "low"),
    ("C022", "Ahmed Hassan", "ahmed.hassan@example.com", "Bronze", 340, "low"),
    ("C023", "Chloe Dubois", "chloe.dubois@example.com", "Platinum", 1340, "low"),
    ("C024", "Noah Williams", "noah.williams@example.com", "Gold", 820, "low"),
    ("C025", "Sara Lindqvist", "sara.lindqvist@example.com", "Silver", 470, "low"),
    # The case-study exemplar: CRM rates her 72/100 "healthy", but five other
    # systems say she is churning => composite ~91 CRITICAL. Uses a custom
    # signal profile (see ELEANOR_PROFILE) rather than a band template.
    ("C026", "Eleanor Voss", "eleanor.voss@example.com", "Gold", 760, "eleanor"),
]

# Base lifetime value ($) per tier — the "value" half of risk x value ranking.
TIER_LTV = {"Bronze": 620.0, "Silver": 1450.0, "Gold": 3200.0, "Platinum": 6800.0}

# Eleanor Voss: the divergence exemplar. Salesforce health 72 (looks healthy!)
# and decent engagement, yet every behavioural + loyalty + support signal is
# collapsing. Interaction boost (GA collapse + zero redemption + unresolved
# ticket + AOV erosion) lifts her into the low-90s composite.
ELEANOR_PROFILE = {
    # CRM still rates her "healthy" (72) with decent engagement — the illusion.
    "sf": {"engagement": 70, "health": 72, "stage": "Engaged", "interaction_days": 21},
    # ...but every behavioural, loyalty and support signal is collapsing.
    "shopify": {"aov": 78.0, "orders": 0, "discount": 0.71, "purchase_days": 88, "aov_change": -60},
    "yotpo": {"balance": 4100, "earned": 0, "redemptions": 0, "last_redeem_days": 122},
    "klaviyo": {"open": 0.05, "click": 0.01, "sms": 0.0, "unsub": False, "open_days": 56},
    "zendesk": {"open": 2, "sentiment": -0.85, "unresolved": 2, "res_time": 168.0, "ticket_days": 6},
    "ga": {"sessions": 4, "prev": 10, "duration": 41.0, "ppv": 1.4, "bounce": 0.85, "change": -60},
}

# Per-risk-band signal profiles. Values are chosen so the scoring engine lands
# each customer in the intended band.
PROFILES = {
    "critical": {
        "sf": {"engagement": 12, "health": 15, "stage": "At Risk", "interaction_days": 55},
        "shopify": {"aov": 41.0, "orders": 0, "discount": 0.72, "purchase_days": 88, "aov_change": -68},
        "yotpo": {"balance": 3200, "earned": 0, "redemptions": 0, "last_redeem_days": 140},
        "klaviyo": {"open": 0.04, "click": 0.01, "sms": 0.0, "unsub": False, "open_days": 60},
        "zendesk": {"open": 3, "sentiment": -0.75, "unresolved": 3, "res_time": 96.0, "ticket_days": 5},
        "ga": {"sessions": 1, "prev": 22, "duration": 38.0, "ppv": 1.2, "bounce": 0.88, "change": -95},
    },
    "high": {
        "sf": {"engagement": 34, "health": 38, "stage": "Declining", "interaction_days": 32},
        "shopify": {"aov": 62.0, "orders": 1, "discount": 0.55, "purchase_days": 47, "aov_change": -42},
        "yotpo": {"balance": 1800, "earned": 120, "redemptions": 0, "last_redeem_days": 85},
        "klaviyo": {"open": 0.14, "click": 0.04, "sms": 0.08, "unsub": False, "open_days": 28},
        "zendesk": {"open": 1, "sentiment": -0.3, "unresolved": 1, "res_time": 52.0, "ticket_days": 14},
        "ga": {"sessions": 5, "prev": 18, "duration": 74.0, "ppv": 2.1, "bounce": 0.66, "change": -60},
    },
    "medium": {
        "sf": {"engagement": 55, "health": 58, "stage": "Engaged", "interaction_days": 18},
        "shopify": {"aov": 88.0, "orders": 2, "discount": 0.34, "purchase_days": 26, "aov_change": -18},
        "yotpo": {"balance": 950, "earned": 320, "redemptions": 1, "last_redeem_days": 48},
        "klaviyo": {"open": 0.31, "click": 0.11, "sms": 0.22, "unsub": False, "open_days": 12},
        "zendesk": {"open": 0, "sentiment": 0.1, "unresolved": 0, "res_time": 26.0, "ticket_days": 40},
        "ga": {"sessions": 11, "prev": 16, "duration": 132.0, "ppv": 3.4, "bounce": 0.44, "change": -28},
    },
    "low": {
        "sf": {"engagement": 82, "health": 86, "stage": "Champion", "interaction_days": 4},
        "shopify": {"aov": 142.0, "orders": 4, "discount": 0.12, "purchase_days": 6, "aov_change": 12},
        "yotpo": {"balance": 240, "earned": 780, "redemptions": 3, "last_redeem_days": 9},
        "klaviyo": {"open": 0.62, "click": 0.34, "sms": 0.48, "unsub": False, "open_days": 2},
        "zendesk": {"open": 0, "sentiment": 0.7, "unresolved": 0, "res_time": 8.0, "ticket_days": 120},
        "ga": {"sessions": 24, "prev": 21, "duration": 268.0, "ppv": 5.8, "bounce": 0.22, "change": 14},
    },
}

# Tier scales AOV / points a little for realism (higher tier => bigger numbers).
TIER_MULT = {"Bronze": 0.7, "Silver": 1.0, "Gold": 1.5, "Platinum": 2.2}

# Customers that intentionally miss some systems (exercise weight re-normalization).
MISSING = {
    "C011": {"zendesk"},          # no support history
    "C016": {"zendesk", "google_analytics"},  # sparse data customer
}


def _jitter(cid: str, spread: float) -> float:
    """Deterministic per-customer offset in [-spread, +spread]."""
    seed = sum(ord(ch) for ch in cid)
    # Map the last digit deterministically into [-1, 1].
    frac = ((seed * 37) % 21 - 10) / 10.0
    return frac * spread


def _build() -> dict[str, list]:
    customers, salesforce, shopify, yotpo, klaviyo, zendesk, ga = [], [], [], [], [], [], []

    for cid, name, email, tier, join_days, risk in ROSTER:
        p = ELEANOR_PROFILE if risk == "eleanor" else PROFILES[risk]
        mult = TIER_MULT[tier]
        missing = MISSING.get(cid, set())
        # Small deterministic variation so customers in a band aren't identical.
        # Eleanor is authored precisely — no jitter so the exemplar is stable.
        j = 0.0 if risk == "eleanor" else _jitter(cid, 1.0)

        # LTV: tier base x recency multiplier + deterministic per-customer spread.
        ltv = round(TIER_LTV[tier] * (1.0 + 0.35 * _jitter(cid, 1.0)), 2)

        customers.append({
            "customer_id": cid, "name": name, "email": email,
            "tier": tier, "join_date": _iso(join_days), "ltv": ltv,
        })

        if "salesforce" not in missing:
            sf = p["sf"]
            salesforce.append({
                "customer_id": cid,
                "engagement_score": round(min(100, max(0, sf["engagement"] + j * 6)), 1),
                "last_interaction_date": _iso(max(1, sf["interaction_days"] + j * 5)),
                "health_score": round(min(100, max(0, sf["health"] + j * 6)), 1),
                "lifecycle_stage": sf["stage"],
            })

        if "shopify" not in missing:
            sh = p["shopify"]
            shopify.append({
                "customer_id": cid,
                "average_order_value": round(sh["aov"] * mult, 2),
                "order_count_30d": sh["orders"],
                "discount_usage_rate": sh["discount"],
                "last_purchase_date": _iso(max(1, sh["purchase_days"] + j * 6)),
                "aov_change_pct": round(sh["aov_change"] + j * 8, 1),
            })

        if "yotpo" not in missing:
            yp = p["yotpo"]
            yotpo.append({
                "customer_id": cid,
                "points_balance": int(yp["balance"] * mult),
                "points_earned_30d": int(yp["earned"] * mult),
                "redemptions_30d": yp["redemptions"],
                "tier": tier,
                "days_since_last_redemption": int(max(0, yp["last_redeem_days"] + j * 8)),
            })

        if "klaviyo" not in missing:
            kv = p["klaviyo"]
            klaviyo.append({
                "customer_id": cid,
                "email_open_rate": round(min(1, max(0, kv["open"] + j * 0.05)), 3),
                "email_click_rate": round(min(1, max(0, kv["click"] + j * 0.03)), 3),
                "sms_response_rate": round(min(1, max(0, kv["sms"] + j * 0.04)), 3),
                "unsubscribed": kv["unsub"],
                "last_email_open_date": _iso(kv["open_days"]),
            })

        if "zendesk" not in missing:
            zd = p["zendesk"]
            zendesk.append({
                "customer_id": cid,
                "open_tickets": zd["open"],
                "avg_sentiment_score": round(min(1, max(-1, zd["sentiment"] + j * 0.08)), 2),
                "unresolved_tickets": zd["unresolved"],
                "avg_resolution_time_hours": zd["res_time"],
                "last_ticket_date": _iso(zd["ticket_days"]),
            })

        if "google_analytics" not in missing:
            g = p["ga"]
            ga.append({
                "customer_id": cid,
                "sessions_30d": g["sessions"],
                "sessions_prev_30d": g["prev"],
                "avg_session_duration_sec": g["duration"],
                "pages_per_session": g["ppv"],
                "bounce_rate": round(min(1, max(0, g["bounce"] + j * 0.04)), 2),
                "session_change_pct": round(g["change"] + j * 6, 1),
            })

    return {
        "customers": customers,
        "salesforce": salesforce,
        "shopify": shopify,
        "yotpo": yotpo,
        "klaviyo": klaviyo,
        "zendesk": zendesk,
        "google_analytics": ga,
    }


def seed(force: bool = False) -> None:
    """Write mock JSON files. If `force` is False, skip when data already exists."""
    _MOCK.mkdir(parents=True, exist_ok=True)
    _AUDIT.mkdir(parents=True, exist_ok=True)

    marker = _MOCK / "customers.json"
    if marker.exists() and not force:
        return

    data = _build()
    for name, records in data.items():
        with (_MOCK / f"{name}.json").open("w", encoding="utf-8") as fh:
            json.dump(records, fh, indent=2)

    audit_file = _AUDIT / "audit_log.json"
    if not audit_file.exists():
        with audit_file.open("w", encoding="utf-8") as fh:
            json.dump([], fh)

    print(f"Seeded {len(data['customers'])} customers into {_MOCK}")


if __name__ == "__main__":
    seed(force=True)
