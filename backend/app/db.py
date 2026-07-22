from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings
from .models import CONNECTOR_SEED, Base, Connector

# ponytail: create_all + a seed helper instead of Alembic. Greenfield, single schema, no data to
# migrate yet. Add Alembic when the Requirements stage starts evolving the schema.

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


async def init_db(eng=engine) -> None:
    """Create the pgvector extension, all tables, and seed the connector registry."""
    async with eng.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)

    async with async_sessionmaker(eng, expire_on_commit=False)() as session:
        existing = set((await session.execute(select(Connector.provider))).scalars())
        for row in CONNECTOR_SEED:
            if row["provider"] not in existing:
                session.add(Connector(**row))
        await session.commit()
