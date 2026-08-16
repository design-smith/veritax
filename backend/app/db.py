from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings
from .models import CONNECTOR_SEED, Base, Connector

# ponytail: create_all + a seed helper instead of Alembic. Greenfield, single schema, no data to
# migrate yet. Add Alembic when the Requirements stage starts evolving the schema.

log = logging.getLogger("veritax")


def _normalize_db_url(url: str) -> str:
    """Force the asyncpg driver. A bare `postgres://` or `postgresql://` URL (what Supabase/Render
    hand you) routes SQLAlchemy to the sync psycopg2 driver, which we don't install."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    for scheme in ("postgresql://", "postgres://"):
        if url.startswith(scheme):
            return "postgresql+asyncpg://" + url[len(scheme):]
    return url


_url = _normalize_db_url(settings.database_url)
# Managed Postgres (Supabase) requires SSL; its pooler (pgbouncer) rejects cached prepared
# statements. Apply both for any non-local database; skip for localhost.
_is_local = "localhost" in _url or "127.0.0.1" in _url
_connect_args: dict = {"timeout": settings.database_connect_timeout}
if not _is_local:
    _connect_args.update({"ssl": "require", "statement_cache_size": 0})

engine = create_async_engine(_url, pool_pre_ping=True, connect_args=_connect_args)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


async def init_db(eng=engine) -> None:
    """Create the pgvector extension, all tables, and seed the connector registry."""
    t0 = time.monotonic()
    log.info("db init: starting against %s database", "local" if _is_local else "managed")
    try:
        async with eng.begin() as conn:
            log.info("db init: connected in %.1fs", time.monotonic() - t0)
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            log.info("db init: pgvector extension ready")
            await conn.run_sync(Base.metadata.create_all)
            log.info("db init: metadata schema ready")
            # No Alembic: add newer columns idempotently so an already-created prod table gets them too.
            await conn.execute(text(
                "DO $$ BEGIN "
                "IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pipeline_job_kind') THEN "
                "ALTER TYPE pipeline_job_kind ADD VALUE IF NOT EXISTS 'extract_document'; "
                "END IF; END $$;"
            ))
            await conn.execute(text("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS user_id uuid"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_engagements_user_id ON engagements (user_id)"))
            await conn.execute(text(
                "ALTER TABLE engagements ADD COLUMN IF NOT EXISTS selected_source_kinds "
                "jsonb NOT NULL DEFAULT '[]'::jsonb"
            ))
            await conn.execute(text("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS fiscal_year text"))
            await conn.execute(text(
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS status_updated_at "
                "timestamp with time zone DEFAULT now()"
            ))
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_status text"))
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true"))
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone"))
            await conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_by uuid"))
            await conn.execute(text(
                "ALTER TABLE requirement_coverage ADD COLUMN IF NOT EXISTS status_updated_at "
                "timestamp with time zone DEFAULT now()"
            ))
            await conn.execute(text(
                "ALTER TABLE draft_sections ADD COLUMN IF NOT EXISTS status_updated_at "
                "timestamp with time zone DEFAULT now()"
            ))
            await conn.execute(text(
                "ALTER TABLE draft_sections ADD COLUMN IF NOT EXISTS tables jsonb NOT NULL DEFAULT '[]'::jsonb"
            ))
            await conn.execute(text(
                "ALTER TABLE draft_sections ADD COLUMN IF NOT EXISTS charts jsonb NOT NULL DEFAULT '[]'::jsonb"
            ))
            await conn.execute(text(
                "ALTER TABLE draft_sections ADD COLUMN IF NOT EXISTS research jsonb"
            ))
            # Class 2 functional evidence: functional dimensions on the shared fact tables (nullable, additive).
            for _tbl in ("extracted_facts", "canonical_facts"):
                await conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS far_type text"))
                await conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS transaction_id text"))
                await conn.execute(text(f"ALTER TABLE {_tbl} ADD COLUMN IF NOT EXISTS evidence_type text"))
            await conn.execute(text(
                "ALTER TABLE risk_runs ADD COLUMN IF NOT EXISTS status_updated_at "
                "timestamp with time zone DEFAULT now()"
            ))
            await conn.execute(text(
                "ALTER TABLE risk_evidence ADD COLUMN IF NOT EXISTS source_label text"
            ))
            await conn.execute(text(
                "ALTER TABLE risk_evidence ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false"
            ))
            await conn.execute(text(
                "ALTER TABLE coverage_supplements ADD COLUMN IF NOT EXISTS source_context "
                "text NOT NULL DEFAULT 'supplement'"
            ))
            await conn.execute(text(
                "ALTER TABLE coverage_supplements ADD COLUMN IF NOT EXISTS target_requirement_id uuid"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_coverage_supplements_target_requirement_id "
                "ON coverage_supplements (target_requirement_id)"
            ))
            log.info("db init: idempotent column updates ready")

        async with async_sessionmaker(eng, expire_on_commit=False)() as session:
            existing = set((await session.execute(select(Connector.provider))).scalars())
            for row in CONNECTOR_SEED:
                if row["provider"] not in existing:
                    session.add(Connector(**row))
            await session.commit()
        log.info("db init: complete in %.1fs", time.monotonic() - t0)
    except Exception:
        log.exception("db init: failed after %.1fs", time.monotonic() - t0)
        raise
