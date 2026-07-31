"""Shared corpus access.

Requirements (coverage), Draft, and Risks read documents via `retrieve_documents` — semantic
retrieval of the chunks most relevant to each element. Whole-document context does not scale: real
annual-report PDFs run to millions of characters and blow past the model's context window, so we
pass in the matched passages, not the whole file.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .diagnostics import rss_mb
from .embeddings import Embedder
from .models import Document, DocumentChunk, DocumentStatus, Source

log = logging.getLogger("veritax")

# Chunks to pull per retrieval query. Draft needs the richer context (~14 × 600-word chunks ≈ 14K
# tokens); assessment is only a presence check, so it pulls fewer — and a batch sends the UNION of its
# elements' chunks, so recall holds. ponytail: bump if recall is thin.
RETRIEVE_K = 14
ASSESS_K = 8


@dataclass
class DocContext:
    source_id: str
    document_id: str
    kind: str
    filename: str
    text: str


_CHUNK_SEP = "\n…\n"  # how _search_chunks joins a document's matched passages


def context_chars(documents: Iterable[DocContext]) -> int:
    return sum(len(doc.text) for doc in documents)


def union_docs(doc_lists: list[list[DocContext]]) -> list[DocContext]:
    """Merge several elements' retrievals into one deduped context (batched assessment sends it once).

    Chunks overlap heavily across related elements; without dedup a batch re-sends the same passages.
    Keeps first-seen order, dedups passages per document.
    """
    by_doc: dict[str, dict] = {}
    order: list[str] = []
    for docs in doc_lists:
        for d in docs:
            entry = by_doc.get(d.document_id)
            if entry is None:
                entry = {"meta": d, "pieces": [], "seen": set()}
                by_doc[d.document_id] = entry
                order.append(d.document_id)
            for piece in d.text.split(_CHUNK_SEP):
                if piece not in entry["seen"]:
                    entry["seen"].add(piece)
                    entry["pieces"].append(piece)
    out: list[DocContext] = []
    for doc_id in order:
        e = by_doc[doc_id]
        m = e["meta"]
        out.append(DocContext(m.source_id, m.document_id, m.kind, m.filename, _CHUNK_SEP.join(e["pieces"])))
    return out


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


async def document_contexts_by_id(
    session: AsyncSession,
    document_ids: Iterable[uuid.UUID],
    *,
    max_chunks_per_doc: int = 10,
) -> list[DocContext]:
    """Load indexed chunks for specific documents already cited by the draft.

    Risk review needs recall more than novelty: if the draft cites an agreement or financial schedule,
    the risk pass should see that source even when a generic risk-search query would not retrieve it.
    """
    ids = list(dict.fromkeys(document_ids))
    if not ids:
        return []
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
            .where(
                Document.id.in_(ids),
                Document.status == DocumentStatus.embedded,
            )
            .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
        )
    ).all()

    grouped: dict[str, dict] = {}
    for r in rows:
        g = grouped.setdefault(
            str(r.document_id),
            {"source_id": str(r.source_id), "kind": r.kind.value,
             "filename": r.original_filename, "chunks": []},
        )
        if len(g["chunks"]) < max_chunks_per_doc:
            g["chunks"].append((r.chunk_index, r.content))

    docs: list[DocContext] = []
    for doc_id, g in grouped.items():
        text = _CHUNK_SEP.join(content for _, content in g["chunks"])
        docs.append(DocContext(g["source_id"], doc_id, g["kind"], g["filename"], text))
    return docs


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
    t0 = time.monotonic()
    qvec = (await asyncio.to_thread(embedder.embed_queries, [query]))[0]
    docs = await _search_chunks(session, engagement_id, qvec, k)
    log.info(
        "retrieve_documents: query_chars=%d k=%d docs=%d context_chars=%d elapsed=%.1fs rss=%s",
        len(query),
        k,
        len(docs),
        context_chars(docs),
        time.monotonic() - t0,
        rss_mb(),
    )
    return docs


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
    t0 = time.monotonic()
    vecs = await asyncio.to_thread(embedder.embed_queries, [queries[key] for key in keys])
    out: dict[str, list[DocContext]] = {}
    for key, vec in zip(keys, vecs):
        out[key] = await _search_chunks(session, engagement_id, vec, k)
    log.info(
        "retrieve_documents_batch: queries=%d k=%d docs=%d context_chars=%d elapsed=%.1fs rss=%s",
        len(keys),
        k,
        sum(len(docs) for docs in out.values()),
        sum(context_chars(docs) for docs in out.values()),
        time.monotonic() - t0,
        rss_mb(),
    )
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
            .where(
                Source.engagement_id == engagement_id,
                Document.status == DocumentStatus.embedded,
            )
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
