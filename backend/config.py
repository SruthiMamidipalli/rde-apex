"""Application configuration.

Settings are read from environment variables (optionally via a `.env` file).
Sensible defaults let the prototype boot without any AWS credentials — in that
case the Retention Agent runs in *degraded mode* and produces deterministic,
non-AI output so the dashboard is still fully populated for a demo.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory if present.
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")


class Settings:
    # --- Paths ---
    BACKEND_DIR: Path = _BACKEND_DIR
    DATA_DIR: Path = _BACKEND_DIR / "data"
    MOCK_DATA_DIR: Path = _BACKEND_DIR / "data" / "mock"
    AUDIT_DIR: Path = _BACKEND_DIR / "data" / "audit"
    PROMPTS_DIR: Path = _BACKEND_DIR / "prompts"

    # --- AWS Bedrock ---
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID: str | None = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: str | None = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_SESSION_TOKEN: str | None = os.getenv("AWS_SESSION_TOKEN")

    # Bedrock on-demand requires cross-region *inference profile* IDs for Claude 4
    # models (a bare model ID like "anthropic.claude-sonnet-4-..." is rejected).
    # These "global." profiles are validated as invokable in this account/region.
    BEDROCK_MODEL_HEAVY: str = os.getenv(
        "BEDROCK_MODEL_HEAVY", "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
    )
    BEDROCK_MODEL_LIGHT: str = os.getenv(
        "BEDROCK_MODEL_LIGHT", "global.anthropic.claude-haiku-4-5-20251001-v1:0"
    )

    # --- Agent / scoring thresholds ---
    CHURN_THRESHOLD: float = float(os.getenv("CHURN_THRESHOLD", "50"))
    ESCALATION_VALUE_THRESHOLD: float = float(
        os.getenv("ESCALATION_VALUE_THRESHOLD", "50")
    )
    WORKFLOW_TIMEOUT_SECONDS: int = int(os.getenv("WORKFLOW_TIMEOUT_SECONDS", "30"))

    # --- Behaviour ---
    # When True, force deterministic (no-Bedrock) generation regardless of creds.
    FORCE_DEGRADED: bool = os.getenv("FORCE_DEGRADED", "false").lower() == "true"

    # Comma-separated allowed CORS origins. Defaults to the Vite dev server.
    # Set CORS_ORIGINS="*" to allow all (disables credentialed requests).
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def bedrock_available(self) -> bool:
        """True only if credentials are present and degraded mode is not forced."""
        if self.FORCE_DEGRADED:
            return False
        return bool(self.AWS_ACCESS_KEY_ID and self.AWS_SECRET_ACCESS_KEY)


settings = Settings()
