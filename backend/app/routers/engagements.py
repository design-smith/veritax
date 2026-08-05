from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..deps import assert_owner, get_current_user, get_session
from ..models import Document, Engagement, EngagementJurisdiction, Entity, Source
from ..schemas import DocumentRead, EngagementPatch, EngagementRead, EngagementSummary, IdResponse, SourceRead

router = APIRouter(prefix="/engagements", tags=["engagements"])


async def _to_read(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    entity_id: uuid.UUID | None,
    website_url: str | None,
) -> EngagementRead:
    entity_name = None
    if entity_id:
        entity_name = (
            await session.execute(select(Entity.name).where(Entity.id == entity_id))
        ).scalar_one_or_none()

    jurisdictions = (
        await session.execute(
            select(EngagementJurisdiction.jurisdiction)
            .where(EngagementJurisdiction.engagement_id == engagement_id)
        )
    ).scalars().all()

    source_rows = (
        await session.execute(
            select(
                Source.id,
                Source.kind,
                Source.origin,
                Source.connector_provider,
                Source.url,
            )
            .where(Source.engagement_id == engagement_id)
            .order_by(Source.created_at)
        )
    ).all()
    source_ids = [row.id for row in source_rows]
    docs_by_source: dict[uuid.UUID, list[DocumentRead]] = {source_id: [] for source_id in source_ids}
    if source_ids:
        doc_rows = (
            await session.execute(
                select(
                    Document.id,
                    Document.source_id,
                    Document.original_filename,
                    Document.content_type,
                    Document.size_bytes,
                    Document.content_hash,
                    Document.status,
                    Document.error,
                    Document.created_at,
                )
                .where(Document.source_id.in_(source_ids))
                .order_by(Document.created_at)
            )
        ).all()
        for doc in doc_rows:
            docs_by_source.setdefault(doc.source_id, []).append(
                DocumentRead(
                    id=doc.id,
                    original_filename=doc.original_filename,
                    content_type=doc.content_type,
                    size_bytes=doc.size_bytes,
                    content_hash=doc.content_hash,
                    status=doc.status,
                    error=doc.error,
                    created_at=doc.created_at,
                )
            )

    return EngagementRead(
        id=engagement_id,
        entity_name=entity_name,
        jurisdictions=sorted(jurisdictions),
        website_url=website_url,
        sources=[
            SourceRead(
                id=s.id,
                kind=s.kind,
                origin=s.origin,
                connector_provider=s.connector_provider,
                url=s.url,
                documents=docs_by_source.get(s.id, []),
            )
            for s in source_rows
        ],
    )


@router.post("", response_model=IdResponse, status_code=201)
async def create_engagement(
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> IdResponse:
    eng = Engagement(user_id=user.id)  # stamp the owner
    session.add(eng)
    await session.commit()
    return IdResponse(id=eng.id)


@router.get("", response_model=list[EngagementSummary])
async def list_engagements(
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> list[EngagementSummary]:
    """The caller's files, newest first. Only named engagements — unnamed shells stay hidden."""
    rows = (
        await session.execute(
            select(Engagement.id, Entity.name, Engagement.updated_at)
            .join(Entity, Entity.id == Engagement.entity_id)
            .where(Engagement.user_id == user.id, Engagement.entity_id.is_not(None))
            .order_by(Engagement.updated_at.desc())
        )
    ).all()
    engagement_ids = [row.id for row in rows]
    jurisdictions_by_engagement: dict[uuid.UUID, list[str]] = {engagement_id: [] for engagement_id in engagement_ids}
    if engagement_ids:
        jurisdiction_rows = (
            await session.execute(
                select(EngagementJurisdiction.engagement_id, EngagementJurisdiction.jurisdiction)
                .where(EngagementJurisdiction.engagement_id.in_(engagement_ids))
            )
        ).all()
        for row in jurisdiction_rows:
            jurisdictions_by_engagement.setdefault(row.engagement_id, []).append(row.jurisdiction)
    return [
        EngagementSummary(
            id=e.id,
            entity_name=e.name,
            jurisdictions=sorted(jurisdictions_by_engagement.get(e.id, [])),
            updated_at=e.updated_at,
        )
        for e in rows
    ]


@router.get("/{engagement_id}", response_model=EngagementRead)
async def get_engagement(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> EngagementRead:
    row = (
        await session.execute(
            select(Engagement.id, Engagement.entity_id, Engagement.website_url, Engagement.user_id)
            .where(Engagement.id == engagement_id)
        )
    ).one_or_none()
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=404, detail="engagement not found")
    return await _to_read(session, row.id, row.entity_id, row.website_url)


@router.patch("/{engagement_id}", response_model=EngagementRead)
async def patch_engagement(
    engagement_id: uuid.UUID,
    body: EngagementPatch,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> EngagementRead:
    eng = await assert_owner(session, engagement_id, user)

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
    return await _to_read(session, eng.id, eng.entity_id, eng.website_url)
