from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from .assessment import Assessor
from .drafting import Drafter
from .embeddings import Embedder
from .risks import RiskAnalyzer
from .storage import Storage


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session


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


def get_risk_analyzer(request: Request) -> RiskAnalyzer:
    return request.app.state.risk_analyzer
