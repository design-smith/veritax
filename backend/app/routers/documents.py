from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..deps import (
    assert_owner,
    get_current_user,
    get_session,
    get_storage,
    require_engagement_owner,
)
from ..ingest import get_or_create_uploaded_source, store_upload
from ..jobs import enqueue_index_document_job, schedule_pipeline_drain
from ..models import Document, DocumentChunk, Engagement, Source, SourceKind
from ..schemas import DocumentRead, DocumentTextRead
from ..storage import Storage

router = APIRouter(tags=["documents"])

MAX_UPLOAD_MB = 50
_MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024


@router.post("/engagements/{engagement_id}/documents", response_model=list[DocumentRead], status_code=201)
async def upload_documents(
    engagement_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    kind: SourceKind = Form(...),
    files: list[UploadFile] = File(default=[]),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[Document]:
    if not files:
        raise HTTPException(status_code=422, detail="no files provided")

    source = await get_or_create_uploaded_source(session, engagement_id, kind)

    created: list[Document] = []
    for f in files:
        data = await f.read()
        if len(data) > _MAX_BYTES:
            # Fail loudly with the reason — never silently drop a large file.
            raise HTTPException(
                status_code=413,
                detail=f"'{f.filename}' is {len(data) // (1024 * 1024)} MB — the limit is {MAX_UPLOAD_MB} MB per file.",
            )
        doc = await store_upload(
            session, storage, engagement_id, source.id, f.filename or "upload", f.content_type, data
        )
        created.append(doc)
    for doc in created:
        await enqueue_index_document_job(session, doc)
    await session.commit()

    schedule_pipeline_drain(background, request.app, max_jobs=len(created))

    return created


async def _owned_document(session: AsyncSession, document_id: uuid.UUID, user: AuthUser) -> Document:
    """Load a document only if the caller owns its engagement (document → source → engagement)."""
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    src = await session.get(Source, doc.source_id)
    if src is None:
        raise HTTPException(status_code=404, detail="document not found")
    await assert_owner(session, src.engagement_id, user)
    return doc


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> Document:
    return await _owned_document(session, document_id, user)


@router.get("/documents/{document_id}/text", response_model=DocumentTextRead)
async def get_document_text(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> DocumentTextRead:
    doc = await _owned_document(session, document_id, user)
    chunks = (
        await session.execute(
            select(DocumentChunk.content)
            .where(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index)
        )
    ).scalars().all()
    if not chunks:
        raise HTTPException(status_code=409, detail="document text is not indexed yet")
    return DocumentTextRead(
        id=doc.id,
        original_filename=doc.original_filename,
        status=doc.status,
        text="\n\n".join(chunks),
    )


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    doc = await _owned_document(session, document_id, user)
    await session.delete(doc)
    await session.commit()
