from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import logging

from .assessment import AnthropicAssessor, DeepSeekAssessor, FakeAssessor
from .config import settings
from .deps import get_current_user
from .db import SessionFactory, init_db
from .document_classifier import AnthropicClassificationFallback, DeepSeekClassificationFallback
from .drafting import (
    AnthropicDrafter,
    AnthropicResearchDrafter,
    DeepSeekDrafter,
    FakeDrafter,
    FakeResearchDrafter,
)
from .embeddings import FakeEmbedder, VoyageEmbedder
from .jobs import pipeline_worker_loop
from .risks import AnthropicRiskAnalyzer, DeepSeekRiskAnalyzer, FakeRiskAnalyzer
from .matching import ClassificationBackedProvider
from .routers import (
    connectors,
    coverage,
    documents,
    draft,
    engagements,
    facts,
    pipeline,
    requirements,
    risks,
    search,
    sources,
    waitlist,
)
from .storage import LocalStorage, S3Storage

log = logging.getLogger("veritax")
# Emit veritax logs at INFO regardless of uvicorn's --log-level, so the pipeline is observable.
if not log.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s veritax: %(message)s", "%H:%M:%S"))
    log.addHandler(_h)
    log.setLevel(logging.INFO)
    log.propagate = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.monotonic()
    log.info("startup: init_db starting")
    await init_db()
    log.info("startup: init_db complete in %.1fs", time.monotonic() - t0)
    app.state.session_factory = SessionFactory
    # S3/MinIO when configured; otherwise local filesystem (no external bucket needed).
    if settings.s3_endpoint_url:
        storage = S3Storage()
    else:
        log.warning("No S3 endpoint set — using local filesystem storage at %s", settings.storage_dir)
        storage = LocalStorage()
    storage_t0 = time.monotonic()
    log.info("startup: storage init starting (%s)", type(storage).__name__)
    try:
        storage.ensure_bucket()
        log.info("startup: storage ready in %.1fs", time.monotonic() - storage_t0)
    except Exception as exc:  # noqa: BLE001 - app should still boot if storage isn't ready yet
        log.warning("could not initialise object storage yet after %.1fs: %s",
                    time.monotonic() - storage_t0, exc)
        if settings.s3_endpoint_url and (
            "localhost" in settings.s3_endpoint_url or "127.0.0.1" in settings.s3_endpoint_url
        ):
            log.warning("startup: local S3 endpoint is unavailable; falling back to filesystem storage at %s",
                        settings.storage_dir)
            storage = LocalStorage()
            storage.ensure_bucket()
    app.state.storage = storage
    if settings.voyage_api_key:
        app.state.embedder = VoyageEmbedder()
    else:
        # ponytail: dev fallback so the full pipeline runs without a key. Set VOYAGE_API_KEY for
        # real embeddings. Never masks config in prod silently — this warning is loud.
        log.warning("VOYAGE_API_KEY not set — using FakeEmbedder (dev only, embeddings are not real)")
        app.state.embedder = FakeEmbedder()
    # Provider is an explicit choice via LLM_PROVIDER (deepseek|anthropic|fake). Blank = auto-detect
    # from whichever API key is set. This lets you flip providers with one env var without having to
    # remove another provider's key.
    provider = settings.llm_provider.strip().lower()
    if not provider:
        provider = ("deepseek" if settings.deepseek_api_key
                    else "anthropic" if settings.anthropic_api_key
                    else "fake")

    if provider == "deepseek":
        log.warning("Using DeepSeek (%s) for assessment + drafting + risks", settings.deepseek_model)
        app.state.assessor = DeepSeekAssessor()
        app.state.drafter = DeepSeekDrafter()
        app.state.risk_analyzer = DeepSeekRiskAnalyzer()
        app.state.classification_fallback = DeepSeekClassificationFallback()
    elif provider == "anthropic":
        log.warning("Using Anthropic (%s / %s) for assessment + drafting + risks",
                    settings.assessment_model, settings.draft_model)
        app.state.assessor = AnthropicAssessor()
        app.state.drafter = AnthropicDrafter()
        app.state.risk_analyzer = AnthropicRiskAnalyzer()
        app.state.classification_fallback = AnthropicClassificationFallback()
    else:
        log.warning("Using Fake assessor/drafter/risk-analyzer (LLM_PROVIDER=%r; dev only, not real)", provider)
        app.state.assessor = FakeAssessor()
        app.state.drafter = FakeDrafter()
        app.state.risk_analyzer = FakeRiskAnalyzer()
        app.state.classification_fallback = None
    # Industry Analysis is web-sourced via Anthropic web_search regardless of the general provider above;
    # falls back to the deterministic offline drafter when no Anthropic key is configured.
    app.state.research_drafter = (
        AnthropicResearchDrafter() if settings.anthropic_api_key else FakeResearchDrafter()
    )
    # Requirement matching reads classified documents from the classification store.
    app.state.classified_docs_provider = ClassificationBackedProvider()
    worker = asyncio.create_task(pipeline_worker_loop(app))
    app.state.pipeline_worker = worker
    log.info("startup: pipeline worker started")
    try:
        yield
    finally:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        log.info("shutdown: pipeline worker stopped")


app = FastAPI(title="Veritax Sources API", lifespan=lifespan)


# Registered BEFORE CORS so CORS stays the outermost user middleware and adds its headers to this
# 500 too — otherwise an unhandled error reaches the browser as an opaque "Failed to fetch".
@app.middleware("http")
async def surface_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:  # noqa: BLE001 - log the traceback, return a CORS-visible 500
        log.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every data router requires a valid Supabase token — no anonymous access. /health stays public
# (defined directly on `app`, below). Per-user ownership is enforced inside the routes.
for _router in (
    engagements.router,
    connectors.router,
    documents.router,
    facts.router,
    sources.router,
    search.router,
    coverage.router,
    draft.router,
    pipeline.router,
    requirements.router,
    risks.router,
):
    app.include_router(_router, dependencies=[Depends(get_current_user)])

# Public: the demo request-access form posts here with no account/token.
app.include_router(waitlist.router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"ok": True}


async def _db_health():
    try:
        async with SessionFactory() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=3)
        return {"ok": True, "db": True}
    except Exception as exc:  # noqa: BLE001 - diagnostics endpoint, no traceback needed for every poll
        log.warning("health/db failed: %s: %s", type(exc).__name__, exc)
        return JSONResponse(
            status_code=503,
            content={"ok": False, "db": False, "error": type(exc).__name__},
        )


@app.get("/ready", tags=["health"])
async def ready():
    return await _db_health()


@app.get("/health/db", tags=["health"])
async def health_db():
    return await _db_health()
