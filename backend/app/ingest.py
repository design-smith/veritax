from __future__ import annotations

import asyncio
import gc
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from .embeddings import Embedder
from .models import Document, DocumentChunk, DocumentStatus
from .processing import extract_text, iter_chunks
from .storage import Storage, build_key

log = logging.getLogger("veritax")

INDEX_CHUNK_BATCH = 24
COPY_CHUNK_BATCH = 100


def _rss_mb() -> str:
    """Current resident memory in MB on Linux, with a peak-RSS fallback."""
    try:
        with open("/proc/self/status", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    kb = int(line.split()[1])
                    return f"{kb // 1024}MB"
    except Exception:  # noqa: BLE001 - diagnostics only
        pass
    try:
        import resource

        return f"{resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024}MB peak"
    except Exception:  # noqa: BLE001 - not available on Windows; diagnostics only
        return "n/a"


async def _copy_embedded_chunks(
    session,
    source_doc_id: uuid.UUID,
    target_doc_id: uuid.UUID,
) -> int:
    copied = 0
    last_index = -1
    while True:
        rows = (
            await session.execute(
                select(DocumentChunk)
                .where(
                    DocumentChunk.document_id == source_doc_id,
                    DocumentChunk.chunk_index > last_index,
                )
                .order_by(DocumentChunk.chunk_index)
                .limit(COPY_CHUNK_BATCH)
            )
        ).scalars().all()
        if not rows:
            break
        for c in rows:
            session.add(
                DocumentChunk(
                    document_id=target_doc_id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    embedding=c.embedding,
                    token_count=c.token_count,
                )
            )
            last_index = c.chunk_index
            copied += 1
        await session.commit()
        log.info("embed REUSE copied=%d target=%s rss=%s", copied, target_doc_id, _rss_mb())
    return copied


async def _embed_and_store_batch(
    session,
    embedder: Embedder,
    document_id: uuid.UUID,
    start_index: int,
    pieces: list[str],
) -> int:
    vectors = await asyncio.to_thread(embedder.embed_documents, pieces)
    if len(vectors) != len(pieces):
        raise RuntimeError(f"embedding provider returned {len(vectors)} vector(s) for {len(pieces)} chunk(s)")
    for offset, (piece, vec) in enumerate(zip(pieces, vectors)):
        session.add(
            DocumentChunk(
                document_id=document_id,
                chunk_index=start_index + offset,
                content=piece,
                embedding=vec,
                token_count=len(piece.split()),
            )
        )
    await session.commit()
    return len(vectors)


async def store_upload(
    session,
    storage: Storage,
    engagement_id: uuid.UUID,
    source_id: uuid.UUID,
    filename: str,
    content_type: str | None,
    data: bytes,
) -> Document:
    """Hash, store bytes in object storage, and insert document metadata."""
    content_hash = hashlib.sha256(data).hexdigest()
    key = build_key(engagement_id, source_id, filename)
    storage.put(key, data, content_type)

    doc = Document(
        source_id=source_id,
        original_filename=filename,
        content_type=content_type,
        size_bytes=len(data),
        content_hash=content_hash,
        storage_bucket=storage.bucket,
        storage_key=key,
        status=DocumentStatus.uploaded,
        status_updated_at=datetime.now(timezone.utc),
    )
    session.add(doc)
    await session.flush()
    return doc


async def embed_document(
    session_factory: async_sessionmaker,
    storage: Storage,
    embedder: Embedder,
    document_id: uuid.UUID,
) -> None:
    """Extract text, chunk, embed, and store pgvector rows for semantic search."""
    async with session_factory() as session:
        doc = await session.get(Document, document_id)
        if doc is None:
            log.warning("embed_document: doc %s not found", document_id)
            return

        fname = doc.original_filename
        log.info("embed START doc=%s file=%s size=%d rss=%s", doc.id, fname, doc.size_bytes, _rss_mb())
        doc.status = DocumentStatus.embedding
        doc.status_updated_at = datetime.now(timezone.utc)
        doc.error = None
        await session.commit()

        try:
            twin_id = (
                await session.execute(
                    select(Document.id)
                    .where(
                        Document.id != document_id,
                        Document.content_hash == doc.content_hash,
                        Document.status == DocumentStatus.embedded,
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if twin_id is not None:
                await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
                await session.commit()
                copied = await _copy_embedded_chunks(session, twin_id, document_id)
                if copied:
                    doc = await session.get(Document, document_id)
                    if doc is not None:
                        doc.status = DocumentStatus.embedded
                        doc.status_updated_at = datetime.now(timezone.utc)
                        doc.error = None
                        await session.commit()
                    log.info(
                        "embed REUSED doc=%s file=%s from twin=%s chunks=%d rss=%s",
                        document_id,
                        fname,
                        twin_id,
                        copied,
                        _rss_mb(),
                    )
                    return

            data = await asyncio.to_thread(storage.get, doc.storage_key)
            log.info("embed: read %d bytes for %s (rss=%s)", len(data), fname, _rss_mb())
            text = await asyncio.to_thread(extract_text, doc.original_filename, doc.content_type, data)
            log.info("embed: extracted %d chars from %s (rss=%s)", len(text), fname, _rss_mb())
            del data
            gc.collect()

            await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
            await session.commit()

            batch: list[str] = []
            chunk_index = 0
            for piece in iter_chunks(text):
                batch.append(piece)
                if len(batch) < INDEX_CHUNK_BATCH:
                    continue
                stored = await _embed_and_store_batch(session, embedder, document_id, chunk_index, batch)
                chunk_index += stored
                log.info("embed: stored %d chunk(s) for %s (rss=%s)", chunk_index, fname, _rss_mb())
                batch.clear()
                gc.collect()
            if batch:
                stored = await _embed_and_store_batch(session, embedder, document_id, chunk_index, batch)
                chunk_index += stored
                log.info("embed: stored %d chunk(s) for %s (rss=%s)", chunk_index, fname, _rss_mb())
                batch.clear()
                gc.collect()
            del text
            gc.collect()

            if chunk_index == 0:
                raise RuntimeError("no extractable text; OCR may be required")

            doc = await session.get(Document, document_id)
            if doc is None:
                log.warning("embed_document: doc %s disappeared before completion", document_id)
                return
            doc.status = DocumentStatus.embedded
            doc.status_updated_at = datetime.now(timezone.utc)
            doc.error = None
            await session.commit()
            log.info(
                "embed DONE doc=%s file=%s chunks=%d -> embedded (rss=%s)",
                doc.id,
                fname,
                chunk_index,
                _rss_mb(),
            )
        except Exception as exc:  # noqa: BLE001 - record failure, don't crash the worker
            log.exception("embed FAILED doc=%s file=%s: %s", document_id, fname, exc)
            await session.rollback()
            await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = DocumentStatus.failed
                doc.status_updated_at = datetime.now(timezone.utc)
                doc.error = str(exc)[:1000]
                await session.commit()


async def get_or_create_uploaded_source(session, engagement_id: uuid.UUID, kind):
    """One reusable uploaded source per (engagement, kind) that accumulates documents."""
    from .models import Source, SourceOrigin

    existing = (
        await session.execute(
            select(Source).where(
                Source.engagement_id == engagement_id,
                Source.kind == kind,
                Source.origin == SourceOrigin.uploaded,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    src = Source(engagement_id=engagement_id, kind=kind, origin=SourceOrigin.uploaded)
    session.add(src)
    await session.flush()
    return src
