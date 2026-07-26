from __future__ import annotations

import os
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.assessment import FakeAssessor
from app.auth import AuthUser
from app.db import init_db
from app.deps import get_current_user
from app.drafting import FakeDrafter
from app.embeddings import FakeEmbedder
from app.main import app
from app.models import Base
from app.risks import FakeRiskAnalyzer
from app.storage import InMemoryStorage

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://veritax:veritax@localhost:5433/veritax_test",
)

# Fixed fake user for the auth-overridden fixture so all engagements it creates share one owner.
TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000aa")


async def _wire(engine, *, override_auth: bool) -> None:
    """Point the app at the test engine + fake doubles. ASGITransport skips lifespan, so we wire
    app.state by hand. `override_auth` bypasses the Supabase JWT gate with a fixed fake user."""
    await init_db(engine)
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    app.state.storage = InMemoryStorage()
    app.state.embedder = FakeEmbedder()
    app.state.assessor = FakeAssessor()
    app.state.drafter = FakeDrafter()
    app.state.risk_analyzer = FakeRiskAnalyzer()
    if override_auth:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(id=TEST_USER_ID, email="test@example.com")


async def _teardown(engine) -> None:
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client():
    """Auth-bypassed client (fixed fake user) — what the existing suite uses."""
    engine = create_async_engine(TEST_DATABASE_URL)
    await _wire(engine, override_auth=True)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c.storage = app.state.storage  # exposed so tests can assert bytes landed in object storage
        yield c
    await _teardown(engine)


@pytest_asyncio.fixture
async def raw_client():
    """No auth override — exercises the real Supabase JWT gate (tests sign HS256 tokens)."""
    engine = create_async_engine(TEST_DATABASE_URL)
    await _wire(engine, override_auth=False)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await _teardown(engine)
