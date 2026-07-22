from __future__ import annotations

import os

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.assessment import FakeAssessor
from app.db import init_db
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


@pytest_asyncio.fixture
async def client():
    """Fresh schema per test against a pgvector Postgres; fake storage + embedder injected.

    ASGITransport does not run lifespan, so app.state defaults from main.py never fire here —
    we wire the test doubles explicitly. Background embedding tasks run within the request via
    this same transport, so document status is 'embedded' by the time the POST returns.
    """
    engine = create_async_engine(TEST_DATABASE_URL)
    await init_db(engine)

    app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
    app.state.storage = InMemoryStorage()
    app.state.embedder = FakeEmbedder()
    app.state.assessor = FakeAssessor()
    app.state.drafter = FakeDrafter()
    app.state.risk_analyzer = FakeRiskAnalyzer()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c.storage = app.state.storage  # exposed so tests can assert bytes landed in object storage
        yield c

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
