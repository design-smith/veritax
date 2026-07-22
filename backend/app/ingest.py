from __future__ import annotations

import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from .embeddings import Embedder
from .models import Document, DocumentChunk, DocumentStatus
from .processing import chunk, extract_text
from .storage import Storage, build_key


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
            return
        doc.status = DocumentStatus.embedding
        await session.commit()

        try:
            data = storage.get(doc.storage_key)
            text = extract_text(doc.original_filename, doc.content_type, data)
            pieces = chunk(text)
            vectors = embedder.embed_documents(pieces)
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
            doc.error = None
            await session.commit()
        except Exception as exc:  # noqa: BLE001 - record failure, don't crash the worker
            await session.rollback()
            doc = await session.get(Document, document_id)
            if doc is not None:
                doc.status = DocumentStatus.failed
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
