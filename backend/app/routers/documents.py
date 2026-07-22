from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..deps import get_embedder, get_session, get_session_factory, get_storage
from ..embeddings import Embedder
from ..ingest import embed_document, get_or_create_uploaded_source, store_upload
from ..models import Document, Engagement, SourceKind
from ..schemas import DocumentRead
from ..storage import Storage

router = APIRouter(tags=["documents"])

MAX_UPLOAD_MB = 50
_MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024


@router.post("/engagements/{engagement_id}/documents", response_model=list[DocumentRead], status_code=201)
async def upload_documents(
    engagement_id: uuid.UUID,
    background: BackgroundTasks,
    kind: SourceKind = Form(...),
    files: list[UploadFile] = File(default=[]),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    embedder: Embedder = Depends(get_embedder),
    session_factory: async_sessionmaker = Depends(get_session_factory),
) -> list[Document]:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
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
    await session.commit()

    # Path 2 runs after the response (findability embedding); each in its own session.
    for doc in created:
        background.add_task(embed_document, session_factory, storage, embedder, doc.id)

    return created


@router.get("/documents/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Document:
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    return doc


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> None:
    doc = await session.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="document not found")
    await session.delete(doc)
    await session.commit()
