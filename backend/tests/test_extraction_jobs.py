from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.classification_store import ClassificationInput, store_classification
from app.config import settings
from app.jobs import enqueue_pipeline_job, run_queued_pipeline_jobs_from_app
from app.main import app
from app.models import Document, ExtractionRun, PipelineJob, PipelineJobKind, PipelineJobStatus


async def _engagement(client) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands"],
            "fiscal_year": "FY2025",
        },
    )
    return eid


async def _upload(client, engagement_id: str, *, kind: str, filename: str, data: bytes, content_type: str) -> str:
    return (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": kind},
            files={"files": (filename, data, content_type)},
        )
    ).json()[0]["id"]


async def _classify_and_queue(
    *,
    engagement_id: str,
    document_id: str,
    document_type: str,
    schema_key: str,
    relevance: str = "relevant",
    max_attempts: int = 3,
) -> None:
    async with app.state.session_factory() as session:
        await store_classification(
            session,
            uuid.UUID(document_id),
            ClassificationInput(
                document_type=document_type,
                classification_score=90,
                classification_state="accepted",
                relevance=relevance,
                tags=[],
                entity="GlobalTech Netherlands BV",
                jurisdiction="Netherlands",
                fiscal_year="FY2025",
                source_validation_result={"entity": "pass", "jurisdiction": "pass", "fiscal_year": "pass"},
                scope_fingerprint=f"test-{document_id}",
                classifier_version="rules-v1",
            ),
        )
        await enqueue_pipeline_job(
            session,
            engagement_id=uuid.UUID(engagement_id),
            kind=PipelineJobKind.extract_document,
            dedupe_key=f"extract_document:{document_id}:{schema_key}",
            payload={"document_id": document_id, "schema_key": schema_key},
            max_attempts=max_attempts,
        )
        await session.commit()


async def test_extract_document_retries_transient_storage_read_and_succeeds(client, monkeypatch):
    eid = await _engagement(client)
    doc_id = await _upload(
        client,
        eid,
        kind="financials",
        filename="trial-balance-fy2025.csv",
        data=b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Netherlands BV\n",
        content_type="text/csv",
    )
    await _classify_and_queue(
        engagement_id=eid,
        document_id=doc_id,
        document_type="Trial Balance",
        schema_key="financial_table",
    )

    original_get = app.state.storage.get
    calls = 0

    def flaky_get(key: str) -> bytes:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("transient storage read failure")
        return original_get(key)

    monkeypatch.setattr(app.state.storage, "get", flaky_get)

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1
    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        assert job.status == PipelineJobStatus.queued
        assert job.attempts == 1
        assert "transient storage read failure" in (job.error or "")
        job.next_run_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await session.commit()

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1
    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        doc = await session.get(Document, uuid.UUID(doc_id))
        runs = (await session.execute(select(ExtractionRun))).scalars().all()

    assert calls == 2
    assert job.status == PipelineJobStatus.succeeded
    assert doc.extraction_status == "extracted"
    assert [run.status for run in runs] == ["extracted"]


async def test_extract_document_no_text_records_terminal_failure_without_retry(client):
    eid = await _engagement(client)
    doc_id = await _upload(
        client,
        eid,
        kind="agreements",
        filename="scanned-agreement.bin",
        data=b"\x00\x01\x02",
        content_type="application/octet-stream",
    )
    await _classify_and_queue(
        engagement_id=eid,
        document_id=doc_id,
        document_type="Service Agreement",
        schema_key="agreement_core",
    )

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1

    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        doc = await session.get(Document, uuid.UUID(doc_id))
        run = (await session.execute(select(ExtractionRun))).scalar_one()

    assert job.status == PipelineJobStatus.succeeded
    assert job.attempts == 1
    assert doc.extraction_status == "failed"
    assert run.status == "failed"
    assert run.diagnostics["terminal"] is True
    assert "no extractable text" in run.diagnostics["reason"]


async def test_extract_document_persistent_transient_failure_marks_document_failed(client, monkeypatch):
    eid = await _engagement(client)
    doc_id = await _upload(
        client,
        eid,
        kind="financials",
        filename="trial-balance-fy2025.csv",
        data=b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity\n4000,Revenue,0,1200,FY2025,GlobalTech Netherlands BV\n",
        content_type="text/csv",
    )
    await _classify_and_queue(
        engagement_id=eid,
        document_id=doc_id,
        document_type="Trial Balance",
        schema_key="financial_table",
        max_attempts=2,
    )

    def unavailable_get(_key: str) -> bytes:
        raise RuntimeError("provider timeout")

    monkeypatch.setattr(app.state.storage, "get", unavailable_get)

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1
    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        job.next_run_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await session.commit()

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1
    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        doc = await session.get(Document, uuid.UUID(doc_id))

    assert job.status == PipelineJobStatus.failed
    assert job.attempts == 2
    assert doc.extraction_status == "failed"
    assert "provider timeout" in (doc.error or "")


async def test_extract_document_out_of_scope_job_does_not_loop(client):
    eid = await _engagement(client)
    doc_id = await _upload(
        client,
        eid,
        kind="agreements",
        filename="wrong-year-services.txt",
        data=b"Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2024.",
        content_type="text/plain",
    )
    await _classify_and_queue(
        engagement_id=eid,
        document_id=doc_id,
        document_type="Service Agreement",
        schema_key="agreement_core",
        relevance="out_of_scope",
    )

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1

    async with app.state.session_factory() as session:
        job = (await session.execute(select(PipelineJob))).scalar_one()
        doc = await session.get(Document, uuid.UUID(doc_id))
        runs = (await session.execute(select(ExtractionRun))).scalars().all()

    assert job.status == PipelineJobStatus.succeeded
    assert job.attempts == 1
    assert doc.extraction_status == "skipped_out_of_scope"
    assert runs == []


async def test_not_configured_extractor_records_resolved_extraction_config(client, monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "anthropic")
    monkeypatch.setattr(settings, "assessment_model", "claude-assess-test")
    monkeypatch.setattr(settings, "extraction_provider", "")
    monkeypatch.setattr(settings, "extraction_model", "")
    eid = await _engagement(client)
    doc_id = await _upload(
        client,
        eid,
        kind="agreements",
        filename="services.txt",
        data=b"Service agreement for GlobalTech Netherlands BV. Territory Netherlands. FY2025.",
        content_type="text/plain",
    )
    await _classify_and_queue(
        engagement_id=eid,
        document_id=doc_id,
        document_type="Service Agreement",
        schema_key="agreement_core",
    )

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1

    async with app.state.session_factory() as session:
        run = (await session.execute(select(ExtractionRun))).scalar_one()

    assert run.status == "needs_review"
    assert run.model_version == "claude-assess-test"
    assert run.diagnostics["provider"] == "anthropic"
