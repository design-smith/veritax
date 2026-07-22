from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import logging

from .assessment import AnthropicAssessor, DeepSeekAssessor, FakeAssessor
from .config import settings
from .db import SessionFactory, init_db
from .drafting import AnthropicDrafter, DeepSeekDrafter, FakeDrafter
from .embeddings import FakeEmbedder, VoyageEmbedder
from .risks import AnthropicRiskAnalyzer, DeepSeekRiskAnalyzer, FakeRiskAnalyzer
from .routers import connectors, coverage, documents, draft, engagements, risks, search, sources
from .storage import S3Storage

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
    await init_db()
    app.state.session_factory = SessionFactory
    storage = S3Storage()
    try:
        storage.ensure_bucket()
    except Exception:  # noqa: BLE001 - app should still boot if MinIO isn't up yet
        log.warning("could not reach object storage at %s yet", settings.s3_endpoint_url)
    app.state.storage = storage
    if settings.voyage_api_key:
        app.state.embedder = VoyageEmbedder()
    else:
        # ponytail: dev fallback so the full pipeline runs without a key. Set VOYAGE_API_KEY for
        # real embeddings. Never masks config in prod silently — this warning is loud.
        log.warning("VOYAGE_API_KEY not set — using FakeEmbedder (dev only, embeddings are not real)")
        app.state.embedder = FakeEmbedder()
    if settings.deepseek_api_key:
        log.warning("Using DeepSeek (%s) for assessment + drafting + risks", settings.deepseek_model)
        app.state.assessor = DeepSeekAssessor()
        app.state.drafter = DeepSeekDrafter()
        app.state.risk_analyzer = DeepSeekRiskAnalyzer()
    elif settings.anthropic_api_key:
        app.state.assessor = AnthropicAssessor()
        app.state.drafter = AnthropicDrafter()
        app.state.risk_analyzer = AnthropicRiskAnalyzer()
    else:
        log.warning("No LLM key set — using Fake assessor/drafter/risk-analyzer (dev only, not real)")
        app.state.assessor = FakeAssessor()
        app.state.drafter = FakeDrafter()
        app.state.risk_analyzer = FakeRiskAnalyzer()
    yield


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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for _router in (
    engagements.router,
    connectors.router,
    documents.router,
    sources.router,
    search.router,
    coverage.router,
    draft.router,
    risks.router,
):
    app.include_router(_router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"ok": True}
