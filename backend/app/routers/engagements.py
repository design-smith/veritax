from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session
from ..models import Engagement, EngagementJurisdiction, Entity
from ..schemas import DocumentRead, EngagementPatch, EngagementRead, IdResponse, SourceRead

router = APIRouter(prefix="/engagements", tags=["engagements"])


def _to_read(eng: Engagement) -> EngagementRead:
    return EngagementRead(
        id=eng.id,
        entity_name=eng.entity.name if eng.entity else None,
        jurisdictions=sorted(j.jurisdiction for j in eng.jurisdictions),
        website_url=eng.website_url,
        sources=[
            SourceRead(
                id=s.id,
                kind=s.kind,
                origin=s.origin,
                connector_provider=s.connector_provider,
                url=s.url,
                documents=[DocumentRead.model_validate(d) for d in s.documents],
            )
            for s in eng.sources
        ],
    )


async def _load(session: AsyncSession, engagement_id: uuid.UUID) -> Engagement:
    eng = await session.get(Engagement, engagement_id)
    if eng is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    return eng


@router.post("", response_model=IdResponse, status_code=201)
async def create_engagement(session: AsyncSession = Depends(get_session)) -> IdResponse:
    eng = Engagement()
    session.add(eng)
    await session.commit()
    return IdResponse(id=eng.id)


@router.get("/{engagement_id}", response_model=EngagementRead)
async def get_engagement(
    engagement_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> EngagementRead:
    return _to_read(await _load(session, engagement_id))


@router.patch("/{engagement_id}", response_model=EngagementRead)
async def patch_engagement(
    engagement_id: uuid.UUID,
    body: EngagementPatch,
    session: AsyncSession = Depends(get_session),
) -> EngagementRead:
    eng = await _load(session, engagement_id)

    if body.entity_name is not None:
        name = body.entity_name.strip()
        if name:
            entity = (
                await session.execute(select(Entity).where(Entity.name == name))
            ).scalar_one_or_none()
            if entity is None:
                entity = Entity(name=name)
                session.add(entity)
                await session.flush()
            eng.entity = entity  # set the relationship so the response reflects it without a reload
        else:
            eng.entity = None

    if body.jurisdictions is not None:
        eng.jurisdictions.clear()  # delete-orphan cascade removes old rows
        seen: set[str] = set()
        for raw in body.jurisdictions:
            val = raw.strip()
            if val and val not in seen:
                seen.add(val)
                eng.jurisdictions.append(EngagementJurisdiction(jurisdiction=val))

    if body.website_url is not None:
        eng.website_url = body.website_url.strip() or None

    await session.commit()
    return _to_read(eng)
