"""FastAPI application entry point for Apex Loyalty AI Retention."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("apex")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed mock data on startup (idempotent — skips if present).
    from data.seed import seed

    seed(force=False)

    from services.orchestrator import get_orchestrator

    orch = get_orchestrator()
    orch.data_loader.reload()
    orch.score_all()
    logger.info(
        "Apex Retention API ready — %d customers loaded, mode=%s",
        len(orch.data_loader.get_all_customers()),
        "degraded" if orch.degraded else "full",
    )
    yield


app = FastAPI(
    title="Apex Loyalty AI Retention API",
    version="1.0.0",
    description="AI-powered customer retention system for Apex Retail.",
    lifespan=lifespan,
)

from config import settings  # noqa: E402

_cors_origins = settings.cors_origins
_allow_all = _cors_origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    # Credentialed requests can't be combined with a "*" origin (browsers reject
    # it), so only enable credentials when origins are explicitly listed.
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes import router  # noqa: E402

app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "Apex Loyalty AI Retention",
        "docs": "/docs",
        "health": "/api/health",
    }
