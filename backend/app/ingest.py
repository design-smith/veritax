from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from .embeddings import Embedder
from .models import Document, DocumentChunk, DocumentStatus
from .processing import chunk, extract_text
from .storage import Storage, build_key

log = logging.getLogger("veritax")


def _rss_mb() -> str:
    """Peak resident memory in MB (Linux) — best-effort, to spot OOM pressure in the logs."""
    try:
        import resource

        return f"{resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024}MB"
    except Exception:  # noqa: BLE001 - not available on Windows; diagnostics only
        return "n/a"


async def store_upload(
    session,
    storage: Storage,
    engagement_id: uuid.UUID,
    source_id: uuid.UUID,
    filename: str,
    content_type: str | None,
    data: bytes,
) -> Document:
    """Path 1: hash, put bytes in object storage, insert the relational metadata row."""
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
    """Path 2 (background): extract text, chunk, embed into pgvector for later semantic search.

    Findability only — NOT the primary path for reading documents in later stages.
    """
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
            twin = (
                await session.execute(
                    select(Document)
                    .where(
                        Document.id != doc.id,
                        Document.content_hash == doc.content_hash,
                        Document.status == DocumentStatus.embedded,
                    )
                    .options(selectinload(Document.chunks))
                    .limit(1)
                )
            ).scalar_one_or_none()
            if twin is not None and twin.chunks:
                await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
                for c in sorted(twin.chunks, key=lambda item: item.chunk_index):
                    session.add(
                        DocumentChunk(
                            document_id=doc.id,
                            chunk_index=c.chunk_index,
                            content=c.content,
                            embedding=c.embedding,
                            token_count=c.token_count,
                        )
                    )
                doc.status = DocumentStatus.embedded
                doc.status_updated_at = datetime.now(timezone.utc)
                doc.error = None
                await session.commit()
                log.info("embed REUSED doc=%s file=%s from twin=%s chunks=%d",
                         doc.id, fname, twin.id, len(twin.chunks))
                return

            # Offload the blocking work (storage read, PDF extraction, embedding HTTP) to threads so
            # the single web worker stays responsive — otherwise a big PDF blocks the event loop long
            # enough for the platform health check to fail and restart the worker mid-embed.
            data = await asyncio.to_thread(storage.get, doc.storage_key)
            log.info("embed: read %d bytes for %s (rss=%s)", len(data), fname, _rss_mb())
            text = await asyncio.to_thread(extract_text, doc.original_filename, doc.content_type, data)
            log.info("embed: extracted %d chars from %s (rss=%s)", len(text), fname, _rss_mb())
            pieces = chunk(text)
            if not pieces:
                raise RuntimeError("no extractable text; OCR may be required")
            log.info("embed: %d chunk(s) for %s — embedding now (rss=%s)", len(pieces), fname, _rss_mb())
            vectors = await asyncio.to_thread(embedder.embed_documents, pieces)
            log.info("embed: got %d vector(s) for %s (rss=%s)", len(vectors), fname, _rss_mb())
            await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
            for i, (piece, vec) in enumerate(zip(pieces, vectors)):
                session.add(
                    DocumentChunk(
                        document_id=doc.id,
                        chunk_index=i,
                        content=piece,
                        embedding=vec,
                        token_count=len(piece.split()),
                    )
                )
            doc.status = DocumentStatus.embedded
            doc.status_updated_at = datetime.now(timezone.utc)
            doc.error = None
            await session.commit()
            log.info("embed DONE doc=%s file=%s -> embedded (rss=%s)", doc.id, fname, _rss_mb())
        except Exception as exc:  # noqa: BLE001 - record failure, don't crash the worker
            log.exception("embed FAILED doc=%s file=%s: %s", document_id, fname, exc)
            await session.rollback()
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = DocumentStatus.failed
                doc.status_updated_at = datetime.now(timezone.utc)
                doc.error = str(exc)[:1000]
                await session.commit()


async def get_or_create_uploaded_source(session, engagement_id: uuid.UUID, kind):
    """One reusable 'uploaded' source per (engagement, kind) that accumulates documents."""
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
