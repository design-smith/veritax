from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_embedder, get_session
from ..embeddings import Embedder
from ..models import Document, DocumentChunk, Engagement, Source
from ..schemas import SearchHit

router = APIRouter(tags=["search"])

# ponytail: minimal findability proof — cosine kNN over chunks, returns document refs + snippet.
# This is NOT RAG and is not wired into any stage; later stages read documents directly.


@router.get("/search", response_model=list[SearchHit])
async def search(
    q: str = Query(..., min_length=1),
    engagement_id: uuid.UUID | None = None,
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    embedder: Embedder = Depends(get_embedder),
) -> list[SearchHit]:
    query_vec = embedder.embed_documents([q])[0]

    stmt = (
        select(
            DocumentChunk.document_id,
            Document.original_filename,
            DocumentChunk.chunk_index,
            DocumentChunk.content,
            DocumentChunk.embedding.cosine_distance(query_vec).label("distance"),
        )
        .join(Document, Document.id == DocumentChunk.document_id)
    )
    if engagement_id is not None:
        stmt = stmt.join(Source, Source.id == Document.source_id).where(
            Source.engagement_id == engagement_id
        )
    stmt = stmt.order_by("distance").limit(limit)

    rows = (await session.execute(stmt)).all()
    return [
        SearchHit(
            document_id=r.document_id,
            original_filename=r.original_filename,
            chunk_index=r.chunk_index,
            snippet=(r.content[:280] + ("…" if len(r.content) > 280 else "")),
            distance=float(r.distance),
        )
        for r in rows
    ]
