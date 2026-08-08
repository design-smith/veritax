import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.corpus import retrieve_documents
from app.embeddings import FakeEmbedder
from app.extraction_store import ExtractedFactInput, FactSourceInput, RunInput, add_extracted_fact, create_extraction_run
from app.jobs import enqueue_index_document_job, run_queued_pipeline_jobs_from_app
from app.main import app
from app.models import Document, DocumentChunk, ExtractedFact, ExtractionRun, FactSource, DocumentStatus, PipelineJob, PipelineJobStatus


async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


async def test_upload_stores_object_and_metadata(client):
    eid = await _engagement(client)
    content = b"Intercompany royalty agreement between parent and subsidiary. Rate 5 percent."

    r = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "agreements"},
        files={"files": ("royalty.txt", content, "text/plain")},
    )
    assert r.status_code == 201
    docs = r.json()
    assert len(docs) == 1
    doc = docs[0]
    assert doc["original_filename"] == "royalty.txt"
    assert doc["size_bytes"] == len(content)
    assert doc["content_hash"] == hashlib.sha256(content).hexdigest()

    # Bytes actually landed in object storage.
    stored = list(client.storage._objects.values())
    assert content in stored


async def test_upload_defers_indexing_until_requirements(client):
    eid = await _engagement(client)
    content = ("functional analysis " * 200).encode()

    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": ("transcript.txt", content, "text/plain")},
        )
    ).json()[0]

    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "uploaded"
    assert got["error"] is None
    async with app.state.session_factory() as session:
        jobs = (await session.execute(select(PipelineJob))).scalars().all()
    assert jobs == []


async def test_document_indexing_retries_transient_failure_in_background(client):
    class FlakyEmbedder(FakeEmbedder):
        def __init__(self) -> None:
            super().__init__()
            self.calls = 0

        def embed_documents(self, texts):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("temporary provider timeout")
            return super().embed_documents(texts)

    app.state.embedder = FlakyEmbedder()
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": ("transcript.txt", ("functional analysis " * 200).encode(), "text/plain")},
        )
    ).json()[0]

    async with app.state.session_factory() as session:
        stored_doc = await session.get(Document, doc["id"])
        await enqueue_index_document_job(session, stored_doc)
        await session.commit()

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1

    async with app.state.session_factory() as session:
        stored_doc = await session.get(Document, doc["id"])
        job = (await session.execute(select(PipelineJob))).scalar_one()
        assert stored_doc.status == DocumentStatus.uploaded
        assert "Retrying automatically" in (stored_doc.error or "")
        assert job.status == PipelineJobStatus.queued
        job.next_run_at = datetime.now(timezone.utc)
        await session.commit()

    assert await run_queued_pipeline_jobs_from_app(app, max_jobs=1) == 1
    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "embedded"
    assert got["error"] is None


async def test_starting_requirements_indexes_uploaded_documents(client):
    eid = await _engagement(client)
    await client.patch(
        f"/engagements/{eid}",
        json={"entity_name": "GlobalTech Netherlands BV", "jurisdictions": ["Netherlands"]},
    )
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": ("notes.txt", ("management structure " * 200).encode(), "text/plain")},
        )
    ).json()[0]

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201

    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "embedded"
    assert got["error"] is None


async def test_document_reads_include_aggregate_extraction_status(client):
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Services agreement markup 5 percent", "text/plain")},
        )
    ).json()[0]

    async with app.state.session_factory() as session:
        row = await session.get(Document, uuid.UUID(doc["id"]))
        row.extraction_status = "extracting"
        await session.commit()

    got = (await client.get(f"/documents/{doc['id']}")).json()
    aggregate = (await client.get(f"/engagements/{eid}")).json()
    engagement_doc = aggregate["sources"][0]["documents"][0]

    assert got["extraction_status"] == "extracting"
    assert engagement_doc["extraction_status"] == "extracting"


async def test_upload_appends_to_same_uploaded_source(client):
    eid = await _engagement(client)
    for name in ("a.txt", "b.txt"):
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={"files": (name, b"balance sheet figures", "text/plain")},
        )
    agg = (await client.get(f"/engagements/{eid}")).json()
    fin_sources = [s for s in agg["sources"] if s["kind"] == "financials"]
    assert len(fin_sources) == 1  # one uploaded source per kind
    assert len(fin_sources[0]["documents"]) == 2


async def test_upload_requires_files(client):
    eid = await _engagement(client)
    r = await client.post(f"/engagements/{eid}/documents", data={"kind": "financials"})
    assert r.status_code == 422


async def test_upload_over_size_cap_rejected_with_reason(client, monkeypatch):
    from app.routers import documents as docs_router

    monkeypatch.setattr(docs_router, "_MAX_BYTES", 1024)  # 1 KB cap for the test
    eid = await _engagement(client)
    r = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "financials"},
        files={"files": ("big.txt", b"x" * 2048, "text/plain")},
    )
    assert r.status_code == 413
    assert "big.txt" in r.json()["detail"]  # names the offending file, no silent failure


async def test_delete_tombstones_document_and_hides_it_from_project_reads(client):
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Services agreement", "text/plain")},
        )
    ).json()[0]

    deleted = await client.delete(f"/documents/{doc['id']}")

    assert deleted.status_code == 204
    aggregate = (await client.get(f"/engagements/{eid}")).json()
    visible_docs = [d for source in aggregate["sources"] for d in source["documents"]]
    assert visible_docs == []
    async with app.state.session_factory() as session:
        stored = await session.get(Document, uuid.UUID(doc["id"]))
    assert stored is not None
    assert stored.is_active is False
    assert stored.deleted_at is not None


async def test_delete_preserves_extraction_history_but_removes_active_retrieval(client):
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Services agreement markup 5 percent", "text/plain")},
        )
    ).json()[0]
    doc_id = uuid.UUID(doc["id"])
    async with app.state.session_factory() as session:
        stored = await session.get(Document, doc_id)
        stored.status = DocumentStatus.embedded
        session.add(
            DocumentChunk(
                document_id=doc_id,
                chunk_index=0,
                content="Services agreement markup 5 percent",
                embedding=app.state.embedder.embed_documents(["Services agreement markup 5 percent"])[0],
            )
        )
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=uuid.UUID(eid),
                document_id=doc_id,
                schema_key="agreement_core",
                schema_version="2026-08-07",
                classification_type="Service Agreement",
                classification_version="rules-v1",
                runner_version="extractor-v1",
                model_version="fake-model",
                fingerprint="fp1",
                status="extracted",
            ),
        )
        await add_extracted_fact(
            session,
            run.id,
            doc_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="markup",
                value_raw="5 percent",
                value_normalized="0.05",
                value_type="percentage",
                unit="%",
                scope_level="transaction",
            ),
            sources=[FactSourceInput(document_id=doc_id, page=1, locator="page 1", quote="markup 5 percent")],
        )
        await session.commit()

    before_delete = await client.delete(f"/documents/{doc['id']}")
    assert before_delete.status_code == 204

    async with app.state.session_factory() as session:
        contexts = await retrieve_documents(
            session,
            uuid.UUID(eid),
            app.state.embedder,
            "Services agreement markup",
            k=10,
        )
        runs = (await session.execute(select(ExtractionRun))).scalars().all()
        facts = (await session.execute(select(ExtractedFact))).scalars().all()
        sources = (await session.execute(select(FactSource))).scalars().all()

    assert contexts == []
    assert len(runs) == 1
    assert len(facts) == 1
    assert len(sources) == 1
