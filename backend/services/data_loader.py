"""Loads and consolidates mock data from the six simulated source systems.

Each system is a JSON file that is a list of records keyed by `customer_id`.
A master `customers.json` file holds the top-level identity/tier fields. The
loader stitches everything into `CustomerProfile` objects, tolerating missing
records in any individual system (those become `None` signals -> the scoring
engine re-normalizes weights).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from config import settings
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

logger = logging.getLogger(__name__)

_SYSTEM_MODELS = {
    "salesforce": SalesforceData,
    "shopify": ShopifyData,
    "yotpo": YotpoData,
    "klaviyo": KlaviyoData,
    "zendesk": ZendeskData,
    "google_analytics": GoogleAnalyticsData,
}


class DataLoaderService:
    def __init__(self, data_dir: Path | str | None = None):
        self.data_dir = Path(data_dir) if data_dir else settings.MOCK_DATA_DIR
        self._customers: dict[str, dict] = {}
        self._systems: dict[str, dict[str, dict]] = {}
        self.reload()

    # ------------------------------------------------------------------ #
    def _load_json(self, name: str) -> list[dict]:
        path = self.data_dir / f"{name}.json"
        if not path.exists():
            logger.warning("Mock data file missing: %s (system treated as absent)", path)
            return []
        try:
            with path.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Failed to load %s: %s (skipping system)", path, exc)
            return []

    def reload(self) -> None:
        """(Re)load all mock data files into memory-indexed lookups."""
        customers = self._load_json("customers")
        self._customers = {c["customer_id"]: c for c in customers}

        self._systems = {}
        for system in _SYSTEM_MODELS:
            records = self._load_json(system)
            self._systems[system] = {r["customer_id"]: r for r in records}

    # ------------------------------------------------------------------ #
    def _build_signals(self, customer_id: str) -> CustomerSignals:
        kwargs: dict = {}
        for system, model in _SYSTEM_MODELS.items():
            record = self._systems.get(system, {}).get(customer_id)
            if record is None:
                kwargs[system] = None
                continue
            try:
                kwargs[system] = model(**record)
            except Exception as exc:  # noqa: BLE001 - tolerate bad rows
                logger.error(
                    "Bad %s record for %s: %s (treating as missing)",
                    system,
                    customer_id,
                    exc,
                )
                kwargs[system] = None
        return CustomerSignals(**kwargs)

    def get_customer(self, customer_id: str) -> CustomerProfile | None:
        base = self._customers.get(customer_id)
        if base is None:
            return None
        return CustomerProfile(
            customer_id=base["customer_id"],
            name=base["name"],
            email=base["email"],
            tier=CustomerTier(base["tier"]),
            join_date=base["join_date"],
            ltv=base.get("ltv", 0.0),
            signals=self._build_signals(customer_id),
        )

    def get_all_customers(self) -> list[CustomerProfile]:
        profiles = [self.get_customer(cid) for cid in self._customers]
        return [p for p in profiles if p is not None]

    def get_customer_signals(self, customer_id: str) -> CustomerSignals | None:
        if customer_id not in self._customers:
            return None
        return self._build_signals(customer_id)

    def exists(self, customer_id: str) -> bool:
        return customer_id in self._customers
