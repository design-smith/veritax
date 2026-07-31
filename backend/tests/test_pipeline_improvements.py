from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app import corpus
from app.drafting import FakeDrafter
from app.embeddings import FakeEmbedder
from app.ingest import INDEX_CHUNK_BATCH
from app.main import app
from app.models import Document, DocumentChunk, DocumentStatus, RequirementCoverage, CoverageStatus
from app.processing import iter_chunks
from app.requirements import resolve_requirements
from sqlalchemy import select


class CountingEmbedder(FakeEmbedder):
    def __init__(self) -> None:
        super().__init__()
        self.document_batches = 0
        self.query_batches = 0

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.document_batches += 1
        return super().embed_documents(texts)

    def embed_queries(self, texts: list[str]) -> list[list[float]]:
        self.query_batches += 1
        return super().embed_queries(texts)


class CountingDrafter(FakeDrafter):
    def __init__(self) -> None:
        self.batch_calls = 0

    def draft_batch(self, elements, register, documents, coverage_notes):
        self.batch_calls += 1
        return super().draft_batch(elements, register, documents, coverage_notes)


async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


def _ready_text(jurisdiction: str, text: bytes) -> bytes:
    required = " ".join(f"{e.element_name} {e.description}" for e in resolve_requirements(jurisdiction))
    return text + b" " + required.encode()


async def test_duplicate_upload_reuses_existing_chunks(client):
    app.state.embedder = CountingEmbedder()
    eid = await _engagement(client)
    content = ("functional analysis " * 200).encode()

    first = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("first.txt", content, "text/plain")},
    )
    assert first.status_code == 201
    assert app.state.embedder.document_batches == 1

    second = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("second.txt", content, "text/plain")},
    )
    assert second.status_code == 201
    assert app.state.embedder.document_batches == 1
    assert second.json()[0]["status"] == "uploaded"

    got = (await client.get(f"/documents/{second.json()[0]['id']}")).json()
    assert got["status"] == "embedded"


async def test_large_upload_embeds_in_bounded_batches(client):
    app.state.embedder = CountingEmbedder()
    eid = await _engagement(client)
    text = " ".join(f"word{i}" for i in range(600 + 520 * 25))
    expected_batches = (len(list(iter_chunks(text))) + INDEX_CHUNK_BATCH - 1) // INDEX_CHUNK_BATCH

    response = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("large.txt", text.encode(), "text/plain")},
    )

    assert response.status_code == 201
    assert expected_batches > 1
    assert app.state.embedder.document_batches == expected_batches


async def test_zero_text_document_fails_visibly(client):
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("scan.bin", b"\x00\x01\x02", "application/octet-stream")},
        )
    ).json()[0]

    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "failed"
    assert "no extractable text" in got["error"]


async def test_retrieve_batch_uses_query_embeddings(monkeypatch):
    class SpyEmbedder(FakeEmbedder):
        def __init__(self) -> None:
            super().__init__()
            self.query_texts: list[list[str]] = []
            self.document_texts: list[list[str]] = []

        def embed_documents(self, texts: list[str]) -> list[list[float]]:
            self.document_texts.append(texts)
            return super().embed_documents(texts)

        def embed_queries(self, texts: list[str]) -> list[list[float]]:
            self.query_texts.append(texts)
            return [[0.1, 0.2, 0.3, 0.4] for _ in texts]

    async def fake_search(_session, _engagement_id, _qvec, _k):
        return []

    spy = SpyEmbedder()
    monkeypatch.setattr(corpus, "_search_chunks", fake_search)

    await corpus.retrieve_documents_batch(object(), uuid.uuid4(), spy, {"a": "management", "b": "royalty"})

    assert spy.query_texts == [["management", "royalty"]]
    assert spy.document_texts == []


async def test_recover_pipeline_restarts_stale_document(client):
    eid = await _engagement(client)
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": ("notes.txt", b"management structure " * 80, "text/plain")},
        )
    ).json()[0]

    async with app.state.session_factory() as session:
        row = await session.get(Document, uuid.UUID(doc["id"]))
        row.status = DocumentStatus.embedding
        row.status_updated_at = datetime.now(timezone.utc) - timedelta(minutes=30)
        await session.execute(DocumentChunk.__table__.delete().where(DocumentChunk.document_id == row.id))
        await session.commit()

    recovered = await client.post(f"/engagements/{eid}/pipeline/recover")
    assert recovered.status_code == 200
    assert recovered.json()["documents_restarted"] == 1

    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "embedded"


async def test_draft_blocked_while_coverage_pending(client):
    eid = await _engagement(client)
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", _ready_text("Netherlands", b"management structure and reporting lines"), "text/plain")},
    )
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})

    async with app.state.session_factory() as session:
        cov = (
            await session.execute(
                select(RequirementCoverage).where(
                    RequirementCoverage.engagement_id == uuid.UUID(eid),
                    RequirementCoverage.jurisdiction == "Netherlands",
                ).limit(1)
            )
        ).scalar_one()
        cov.status = CoverageStatus.pending
        cov.status_updated_at = datetime.now(timezone.utc)
        await session.commit()

    blocked = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    assert blocked.status_code == 409


async def test_supplement_redrafts_existing_section(client):
    app.state.drafter = CountingDrafter()
    eid = await _engagement(client)
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", b"management structure and reporting lines", "text/plain")},
    )
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    before = app.state.drafter.batch_calls

    rows = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()["requirements"]
    target = rows[0]
    await client.post(
        f"/coverage/{target['id']}/supplements",
        data={"kind": "text", "text": "Supplemental management structure detail."},
    )

    assert app.state.drafter.batch_calls > before
