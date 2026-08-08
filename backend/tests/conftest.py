from __future__ import annotations

import os
import threading
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.assessment import FakeAssessor
from app.auth import AuthUser
from app.db import init_db
from app.deps import get_current_user
from app.drafting import FakeDrafter
from app.embeddings import FakeEmbedder
from app.main import app
from app.matching import FakeClassifiedDocumentsProvider
from app.models import Base
from app.risks import FakeRiskAnalyzer
from app.storage import InMemoryStorage

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://veritax:veritax@localhost:5433/veritax_test",
)

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000aa")
TEST_DB_LOCK = threading.Lock()
TEST_DB_ADVISORY_LOCK_KEY = 724116108
ENUM_TYPES = (
    "source_kind",
    "source_origin",
    "document_status",
    "classification_state",
    "document_relevance",
    "connector_category",
    "connector_status",
    "coverage_status",
    "confidence",
    "supplement_kind",
    "draft_status",
    "requirement_status",
    "citation_kind",
    "risk_kind",
    "risk_severity",
    "risk_run_status",
    "pipeline_job_kind",
    "pipeline_job_status",
)


async def _drop_test_state(engine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        for enum_type in ENUM_TYPES:
            await conn.execute(text(f"DROP TYPE IF EXISTS {enum_type} CASCADE"))


async def _wire(engine, *, override_auth: bool) -> None:
    """Point the app at the test engine and fake doubles. ASGITransport skips lifespan."""
    try:
        await _drop_test_state(engine)
        await init_db(engine)
    except Exception:
        await _drop_test_state(engine)
        await init_db(engine)
    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    app.state.storage = InMemoryStorage()
    app.state.embedder = FakeEmbedder()
    app.state.assessor = FakeAssessor()
    app.state.drafter = FakeDrafter()
    app.state.risk_analyzer = FakeRiskAnalyzer()
    app.state.classification_fallback = None
    app.state.classified_docs_provider = FakeClassifiedDocumentsProvider({})
    if override_auth:
        app.dependency_overrides[get_current_user] = lambda: AuthUser(
            id=TEST_USER_ID, email="test@example.com"
        )


async def _teardown(engine) -> None:
    app.dependency_overrides.clear()
    await _drop_test_state(engine)


@pytest_asyncio.fixture
async def client():
    """Auth-bypassed client with a fixed fake user."""
    TEST_DB_LOCK.acquire()
    engine = create_async_engine(TEST_DATABASE_URL)
    lock_conn = await engine.connect()
    await lock_conn.execute(text(f"SELECT pg_advisory_lock({TEST_DB_ADVISORY_LOCK_KEY})"))
    try:
        await _wire(engine, override_auth=True)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            c.storage = app.state.storage
            yield c
        await _teardown(engine)
    finally:
        await lock_conn.execute(text(f"SELECT pg_advisory_unlock({TEST_DB_ADVISORY_LOCK_KEY})"))
        await lock_conn.close()
        await engine.dispose()
        TEST_DB_LOCK.release()


@pytest_asyncio.fixture
async def raw_client():
    """Client without auth override; tests provide real JWTs."""
    TEST_DB_LOCK.acquire()
    engine = create_async_engine(TEST_DATABASE_URL)
    lock_conn = await engine.connect()
    await lock_conn.execute(text(f"SELECT pg_advisory_lock({TEST_DB_ADVISORY_LOCK_KEY})"))
    try:
        await _wire(engine, override_auth=False)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        await _teardown(engine)
    finally:
        await lock_conn.execute(text(f"SELECT pg_advisory_unlock({TEST_DB_ADVISORY_LOCK_KEY})"))
        await lock_conn.close()
        await engine.dispose()
        TEST_DB_LOCK.release()
