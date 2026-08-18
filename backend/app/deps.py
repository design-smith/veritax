from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .assessment import Assessor
from .auth import AuthError, AuthUser, verify_token
from .drafting import Drafter, ResearchDrafter
from .embeddings import Embedder
from .interview_extraction import InterviewExtractor
from .models import Engagement
from .risks import RiskAnalyzer
from .storage import Storage


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session


# ── Auth ─────────────────────────────────────────────────────────────────────
def get_current_user(request: Request) -> AuthUser:
    """Require a valid Supabase access token. Sync (runs in FastAPI's threadpool) since JWKS lookup
    may block on the first fetch. 401 on any missing/invalid token."""
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        return verify_token(header.split(" ", 1)[1].strip())
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=f"invalid token: {exc}") from exc


async def assert_owner(session: AsyncSession, engagement_id: uuid.UUID, user: AuthUser) -> Engagement:
    """Load an engagement and confirm the caller owns it. 404 (not 403) so ids don't leak existence."""
    eng = await session.get(Engagement, engagement_id)
    if eng is None or eng.user_id != user.id:
        raise HTTPException(status_code=404, detail="engagement not found")
    return eng


async def require_engagement_owner(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> Engagement:
    """Route dependency for endpoints with an `engagement_id` path param: 404 unless the caller owns it."""
    return await assert_owner(session, engagement_id, user)


def get_session_factory(request: Request) -> async_sessionmaker:
    return request.app.state.session_factory


def get_storage(request: Request) -> Storage:
    return request.app.state.storage


def get_embedder(request: Request) -> Embedder:
    return request.app.state.embedder


def get_assessor(request: Request) -> Assessor:
    return request.app.state.assessor


def get_drafter(request: Request) -> Drafter:
    return request.app.state.drafter


def get_research_drafter(request: Request) -> ResearchDrafter:
    return request.app.state.research_drafter


def get_interview_extractor(request: Request) -> InterviewExtractor:
    return request.app.state.interview_extractor


def get_column_mapping_suggester(request: Request):
    return request.app.state.column_mapping_suggester


def get_classification_suggester(request: Request):
    return request.app.state.classification_suggester


def get_risk_analyzer(request: Request) -> RiskAnalyzer:
    return request.app.state.risk_analyzer


def get_classified_docs_provider(request: Request):
    """The classified-documents source for requirement matching (real stub in prod, fake in tests)."""
    return request.app.state.classified_docs_provider
