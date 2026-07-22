from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session
from ..models import Connector, Engagement, Source, SourceOrigin
from ..schemas import IdResponse, SourceCreate

router = APIRouter(tags=["sources"])


@router.post("/engagements/{engagement_id}/sources", response_model=IdResponse, status_code=201)
async def create_source(
    engagement_id: uuid.UUID,
    body: SourceCreate,
    session: AsyncSession = Depends(get_session),
) -> IdResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")

    if body.origin == SourceOrigin.connected:
        if not body.connector_provider:
            raise HTTPException(status_code=422, detail="connector_provider required when connected")
        if await session.get(Connector, body.connector_provider) is None:
            raise HTTPException(status_code=422, detail="unknown connector_provider")
    if body.origin == SourceOrigin.reference and not body.url:
        raise HTTPException(status_code=422, detail="url required for a reference source")

    src = Source(
        engagement_id=engagement_id,
        kind=body.kind,
        origin=body.origin,
        connector_provider=body.connector_provider,
        url=body.url,
    )
    session.add(src)
    await session.commit()
    return IdResponse(id=src.id)
