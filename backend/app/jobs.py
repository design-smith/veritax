from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import FastAPI
from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Document,
    DocumentStatus,
    PipelineJob,
    PipelineJobKind,
    PipelineJobStatus,
    Source,
)

log = logging.getLogger("veritax")

JOB_STALE_AFTER = timedelta(minutes=10)
WORKER_IDLE_SECONDS = 2.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _job_error(exc: BaseException) -> str:
    return f"{type(exc).__name__}: {exc}"[:1000]


def _document_action_required(exc: BaseException) -> str | None:
    message = str(exc).lower()
    if "no extractable text" in message or "ocr" in message:
        return "Upload an OCR'd copy of this file."
    if "encrypted" in message or "locked" in message:
        return "Upload an unlocked copy of this file."
    if "corrupt" in message or "malformed" in message:
        return "Upload a clean replacement copy of this file."
    return None


async def enqueue_pipeline_job(
    session: AsyncSession,
    *,
    engagement_id: uuid.UUID,
    kind: PipelineJobKind,
    dedupe_key: str,
    payload: dict[str, Any] | None = None,
    restart: bool = False,
    max_attempts: int = 3,
) -> None:
    """Create one durable job. `restart=True` is for explicit user/system recovery."""
    values = {
        "id": uuid.uuid4(),
        "engagement_id": engagement_id,
        "kind": kind,
        "dedupe_key": dedupe_key,
        "payload": payload or {},
        "status": PipelineJobStatus.queued,
        "attempts": 0,
        "max_attempts": max_attempts,
        "next_run_at": _now(),
        "error": None,
        "action_required": None,
    }
    stmt = pg_insert(PipelineJob).values(values)
    if restart:
        stmt = stmt.on_conflict_do_update(
            index_elements=["dedupe_key"],
            set_={
                "payload": values["payload"],
                "status": PipelineJobStatus.queued,
                "attempts": 0,
                "max_attempts": max_attempts,
                "next_run_at": values["next_run_at"],
                "locked_at": None,
                "completed_at": None,
                "error": None,
                "action_required": None,
            },
        )
    else:
        stmt = stmt.on_conflict_do_nothing(index_elements=["dedupe_key"])
    await session.execute(stmt)


async def enqueue_index_document_job(session: AsyncSession, doc: Document, *, restart: bool = False) -> None:
    source = await session.get(Source, doc.source_id)
    if source is None:
        return
    await enqueue_pipeline_job(
        session,
        engagement_id=source.engagement_id,
        kind=PipelineJobKind.index_document,
        dedupe_key=f"index_document:{doc.id}",
        payload={"document_id": str(doc.id)},
        restart=restart,
    )


async def adopt_open_document_jobs(session: AsyncSession) -> int:
    """Queue orphaned pre-worker documents so a deploy can recover old uploaded/embedding rows."""
    rows = (
        await session.execute(
            select(Document)
            .join(Source, Source.id == Document.source_id)
            .where(Document.status.in_([DocumentStatus.uploaded, DocumentStatus.embedding]))
        )
    ).scalars().all()
    for doc in rows:
        await enqueue_index_document_job(session, doc)
    return len(rows)


async def _recover_stale_jobs(session: AsyncSession) -> int:
    now = _now()
    result = await session.execute(
        update(PipelineJob)
        .where(
            PipelineJob.status == PipelineJobStatus.running,
            or_(
                PipelineJob.locked_at.is_(None),
                PipelineJob.locked_at < now - JOB_STALE_AFTER,
            ),
        )
        .values(
            status=PipelineJobStatus.queued,
            next_run_at=now,
            locked_at=None,
            error="Recovered after backend restart or stale worker.",
        )
    )
    return result.rowcount or 0


async def _claim_job(session: AsyncSession) -> PipelineJob | None:
    now = _now()
    await _recover_stale_jobs(session)
    job = (
        await session.execute(
            select(PipelineJob)
            .where(
                PipelineJob.status == PipelineJobStatus.queued,
                PipelineJob.next_run_at <= now,
            )
            .order_by(PipelineJob.next_run_at, PipelineJob.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
    ).scalar_one_or_none()
    if job is None:
        await session.commit()
        return None
    job.status = PipelineJobStatus.running
    job.attempts += 1
    job.locked_at = now
    job.started_at = now
    job.error = None
    job.action_required = None
    await session.commit()
    return job


async def _mark_document_retrying(session: AsyncSession, job: PipelineJob, error: str) -> None:
    if job.kind != PipelineJobKind.index_document:
        return
    doc_id = job.payload.get("document_id")
    if not doc_id:
        return
    doc = await session.get(Document, uuid.UUID(str(doc_id)))
    if doc is None:
        return
    doc.status = DocumentStatus.uploaded
    doc.status_updated_at = _now()
    doc.error = f"Retrying automatically after {error}"[:1000]


async def _mark_extraction_failed(session: AsyncSession, job: PipelineJob, error: str) -> None:
    if job.kind != PipelineJobKind.extract_document:
        return
    doc_id = job.payload.get("document_id")
    if not doc_id:
        return
    doc = await session.get(Document, uuid.UUID(str(doc_id)))
    if doc is None:
        return
    doc.extraction_status = "failed"
    doc.status_updated_at = _now()
    doc.error = error[:1000]


async def _mark_job_succeeded(session: AsyncSession, job_id: uuid.UUID) -> None:
    job = await session.get(PipelineJob, job_id)
    if job is None:
        return
    job.status = PipelineJobStatus.succeeded
    job.completed_at = _now()
    job.locked_at = None
    job.error = None
    job.action_required = None
    await session.commit()


async def _mark_job_failed(session: AsyncSession, job_id: uuid.UUID, exc: BaseException) -> None:
    job = await session.get(PipelineJob, job_id)
    if job is None:
        return
    error = _job_error(exc)
    action_required = _document_action_required(exc) if job.kind == PipelineJobKind.index_document else None
    if action_required:
        job.status = PipelineJobStatus.blocked
        job.action_required = action_required
        job.completed_at = _now()
    elif job.attempts < job.max_attempts:
        job.status = PipelineJobStatus.queued
        job.next_run_at = _now() + timedelta(seconds=min(90, 10 * (2 ** max(0, job.attempts - 1))))
        await _mark_document_retrying(session, job, error)
    else:
        job.status = PipelineJobStatus.failed
        job.completed_at = _now()
        await _mark_extraction_failed(session, job, error)
    job.locked_at = None
    job.error = error
    await session.commit()


async def _run_job(app: FastAPI, job: PipelineJob) -> None:
    if job.kind == PipelineJobKind.index_document:
        from .ingest import embed_document

        await embed_document(
            app.state.session_factory,
            app.state.storage,
            app.state.embedder,
            uuid.UUID(str(job.payload["document_id"])),
            raise_on_failure=True,
        )
        return

    if job.kind == PipelineJobKind.extract_document:
        from .extraction_jobs import run_extraction_job

        await run_extraction_job(
            app.state.session_factory,
            app.state.storage,
            uuid.UUID(str(job.payload["document_id"])),
            str(job.payload["schema_key"]),
        )
        return

    if job.kind == PipelineJobKind.assess_requirements:
        from .routers.coverage import run_assessment

        await run_assessment(
            app.state.session_factory,
            app.state.assessor,
            app.state.embedder,
            job.engagement_id,
            str(job.payload["jurisdiction"]),
        )
        return

    if job.kind == PipelineJobKind.draft_jurisdiction:
        from .routers.draft import run_draft

        await run_draft(
            app.state.session_factory,
            app.state.drafter,
            app.state.embedder,
            job.engagement_id,
            str(job.payload["jurisdiction"]),
        )
        return

    if job.kind == PipelineJobKind.analyze_risks:
        from .routers.risks import run_analysis

        await run_analysis(
            app.state.session_factory,
            app.state.risk_analyzer,
            app.state.embedder,
            job.engagement_id,
            str(job.payload["jurisdiction"]),
        )
        return

    raise RuntimeError(f"unsupported pipeline job kind: {job.kind}")


async def run_queued_pipeline_jobs_from_app(app: FastAPI, *, max_jobs: int = 1) -> int:
    ran = 0
    for _ in range(max_jobs):
        async with app.state.session_factory() as session:
            job = await _claim_job(session)
        if job is None:
            break
        try:
            log.info("pipeline.job START id=%s kind=%s attempt=%d", job.id, job.kind.value, job.attempts)
            await _run_job(app, job)
        except Exception as exc:  # noqa: BLE001 - durable retry boundary
            log.exception("pipeline.job FAILED id=%s kind=%s attempt=%d", job.id, job.kind.value, job.attempts)
            async with app.state.session_factory() as session:
                await _mark_job_failed(session, job.id, exc)
        else:
            async with app.state.session_factory() as session:
                await _mark_job_succeeded(session, job.id)
            log.info("pipeline.job DONE id=%s kind=%s", job.id, job.kind.value)
        ran += 1
    return ran


def schedule_pipeline_drain(background, app: FastAPI, *, max_jobs: int = 1) -> None:
    # ponytail: BackgroundTasks is only a wake-up nudge. The durable source of truth is pipeline_jobs.
    background.add_task(run_queued_pipeline_jobs_from_app, app, max_jobs=max_jobs)


async def pipeline_worker_loop(app: FastAPI) -> None:
    async with app.state.session_factory() as session:
        adopted = await adopt_open_document_jobs(session)
        await session.commit()
        if adopted:
            log.info("pipeline.worker adopted %d open document job(s)", adopted)
    while True:
        ran = await run_queued_pipeline_jobs_from_app(app, max_jobs=1)
        if ran == 0:
            await asyncio.sleep(WORKER_IDLE_SECONDS)
