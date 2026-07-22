"""Shared corpus access.

Requirements (coverage), Draft, and Risks read documents via `retrieve_documents` — semantic
retrieval of the chunks most relevant to each element. Whole-document context does not scale: real
annual-report PDFs run to millions of characters and blow past the model's context window, so we
pass in the matched passages, not the whole file. `gather_documents` (full text) is kept for small
corpora / tooling but is no longer the pipeline's primary path.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .embeddings import Embedder
from .models import Document, DocumentChunk, Source
from .processing import extract_text
from .storage import Storage

log = logging.getLogger("veritax")

# Chunks to pull per retrieval query. ~14 × 600-word chunks ≈ 14K tokens — comfortably inside the
# model window while covering an element from several angles. ponytail: bump if recall is thin.
RETRIEVE_K = 14


@dataclass
class DocContext:
    source_id: str
    document_id: str
    kind: str
    filename: str
    text: str


async def gather_documents(session: AsyncSession, engagement_id: uuid.UUID, storage: Storage) -> list[DocContext]:
    rows = (
        await session.execute(
            select(Document, Source.kind, Source.id)
            .join(Source, Source.id == Document.source_id)
            .where(Source.engagement_id == engagement_id)
        )
    ).all()
    log.info("gather_documents: engagement=%s found %d document(s)", engagement_id, len(rows))
    docs: list[DocContext] = []
    for doc, kind, source_id in rows:
        try:
            data = await asyncio.to_thread(storage.get, doc.storage_key)
        except Exception:
            log.exception("gather_documents: storage.get FAILED for %s (key=%s)", doc.original_filename, doc.storage_key)
            raise
        text = await asyncio.to_thread(extract_text, doc.original_filename, doc.content_type, data)
        log.info("  · %s (%s): %d bytes -> %d chars extracted", doc.original_filename, kind.value, len(data), len(text))
        docs.append(
            DocContext(
                source_id=str(source_id),
                document_id=str(doc.id),
                kind=kind.value,
                filename=doc.original_filename,
                text=text,
            )
        )
    total = sum(len(d.text) for d in docs)
    log.info("gather_documents: %d doc(s), %d total chars of context", len(docs), total)
    return docs


def element_query(element) -> str:
    """The retrieval query for a required element: its name, description, and sub-requirements."""
    subs = " ".join(getattr(element, "sub_requirements", []) or [])
    return f"{element.element_name}. {element.description} {subs}".strip()


async def document_filename_map(session: AsyncSession, engagement_id: uuid.UUID) -> dict[str, str]:
    """filename → document_id for the engagement (cheap; no storage read or text extraction).

    Used to turn a model's `source_filename` citation back into a clickable document_id.
    """
    rows = (
        await session.execute(
            select(Document.original_filename, Document.id)
            .join(Source, Source.id == Document.source_id)
            .where(Source.engagement_id == engagement_id)
        )
    ).all()
    return {fn: str(did) for fn, did in rows}


async def retrieve_documents(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    embedder: Embedder,
    query: str,
    *,
    k: int = RETRIEVE_K,
) -> list[DocContext]:
    """Return the `k` chunks most relevant to `query`, grouped into one DocContext per document.

    This is the pipeline's context source: it bounds what reaches the model (a handful of matched
    passages) regardless of how large the underlying files are. Reads pre-embedded chunk text, so no
    PDF re-extraction. Empty until documents have been embedded.
    """
    qvec = (await asyncio.to_thread(embedder.embed_documents, [query]))[0]
    return await _search_chunks(session, engagement_id, qvec, k)


async def retrieve_documents_batch(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    embedder: Embedder,
    queries: dict[str, str],
    *,
    k: int = RETRIEVE_K,
) -> dict[str, list[DocContext]]:
    """Retrieve context for many keyed queries with a SINGLE embedding call.

    Embedding is the rate-limited/paid step, so we batch every element's query into one request, then
    run the (free, local) pgvector search per query. Returns {key: docs}. Raises if embedding fails —
    the caller decides how to surface a provider outage (never silently returns empty context).
    """
    keys = list(queries)
    if not keys:
        return {}
    vecs = await asyncio.to_thread(embedder.embed_documents, [queries[key] for key in keys])
    out: dict[str, list[DocContext]] = {}
    for key, vec in zip(keys, vecs):
        out[key] = await _search_chunks(session, engagement_id, vec, k)
    log.info("retrieve_documents_batch: %d quer(y/ies) embedded in one call", len(keys))
    return out


async def _search_chunks(
    session: AsyncSession, engagement_id: uuid.UUID, qvec: list[float], k: int
) -> list[DocContext]:
    """Local pgvector kNN over the engagement's chunks for a precomputed query vector (no API call)."""
    rows = (
        await session.execute(
            select(
                DocumentChunk.document_id,
                DocumentChunk.chunk_index,
                DocumentChunk.content,
                Document.original_filename,
                Source.kind,
                Source.id.label("source_id"),
            )
            .join(Document, Document.id == DocumentChunk.document_id)
            .join(Source, Source.id == Document.source_id)
            .where(Source.engagement_id == engagement_id)
            .order_by(DocumentChunk.embedding.cosine_distance(qvec))
            .limit(k)
        )
    ).all()

    grouped: dict[str, dict] = {}
    for r in rows:
        g = grouped.setdefault(
            str(r.document_id),
            {"source_id": str(r.source_id), "kind": r.kind.value,
             "filename": r.original_filename, "chunks": []},
        )
        g["chunks"].append((r.chunk_index, r.content))

    docs: list[DocContext] = []
    for doc_id, g in grouped.items():
        g["chunks"].sort(key=lambda c: c[0])
        text = "\n…\n".join(content for _, content in g["chunks"])
        docs.append(DocContext(g["source_id"], doc_id, g["kind"], g["filename"], text))
    return docs
