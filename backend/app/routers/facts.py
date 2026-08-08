from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..deps import assert_owner, get_current_user, get_session
from ..models import (
    CanonicalEntity,
    CanonicalFact,
    CanonicalFactSource,
    Document,
    EntityAlias,
    EntityMention,
    ExtractedFact,
    ExtractionRun,
    FactSource,
    Source,
)
from ..schemas import (
    CanonicalEntityRead,
    DocumentFactsResponse,
    FactEntityMentionRead,
    FactRead,
    FactSourceRead,
)

router = APIRouter(tags=["facts"])


@router.get("/documents/{document_id}/facts", response_model=DocumentFactsResponse)
async def document_facts(
    document_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> DocumentFactsResponse:
    doc = await _owned_active_document(session, document_id, user)
    facts = await _active_facts_for_document(session, doc.id)
    return DocumentFactsResponse(document_id=doc.id, facts=await _fact_reads(session, facts))


@router.get("/facts/{fact_id}", response_model=FactRead)
async def fact_detail(
    fact_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> FactRead:
    fact = await session.get(ExtractedFact, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="fact not found")
    await _owned_active_document(session, fact.document_id, user)
    run = await session.get(ExtractionRun, fact.extraction_run_id)
    if run is None or not run.active:
        raise HTTPException(status_code=404, detail="fact not found")
    return (await _fact_reads(session, [fact]))[0]


@router.get("/entities", response_model=list[CanonicalEntityRead])
async def entities(
    engagement_id: uuid.UUID = Query(...),
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> list[CanonicalEntityRead]:
    await assert_owner(session, engagement_id, user)
    rows = (
        await session.execute(
            select(CanonicalEntity)
            .where(CanonicalEntity.engagement_id == engagement_id)
            .order_by(CanonicalEntity.legal_name, CanonicalEntity.id)
        )
    ).scalars().all()
    return [await _entity_read(session, row) for row in rows]


@router.get("/entities/{entity_id}", response_model=CanonicalEntityRead)
async def entity_detail(
    entity_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> CanonicalEntityRead:
    entity = await session.get(CanonicalEntity, entity_id)
    if entity is None:
        raise HTTPException(status_code=404, detail="entity not found")
    await assert_owner(session, entity.engagement_id, user)
    return await _entity_read(session, entity)


async def _owned_active_document(session: AsyncSession, document_id: uuid.UUID, user: AuthUser) -> Document:
    doc = await session.get(Document, document_id)
    if doc is None or not doc.is_active:
        raise HTTPException(status_code=404, detail="document not found")
    source = await session.get(Source, doc.source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="document not found")
    await assert_owner(session, source.engagement_id, user)
    return doc


async def _active_facts_for_document(session: AsyncSession, document_id: uuid.UUID) -> list[ExtractedFact]:
    return (
        await session.execute(
            select(ExtractedFact)
            .join(ExtractionRun, ExtractionRun.id == ExtractedFact.extraction_run_id)
            .join(Document, Document.id == ExtractedFact.document_id)
            .where(
                ExtractedFact.document_id == document_id,
                Document.is_active.is_(True),
                ExtractionRun.active.is_(True),
            )
            .order_by(ExtractedFact.created_at, ExtractedFact.id)
        )
    ).scalars().all()


async def _fact_reads(session: AsyncSession, facts: list[ExtractedFact]) -> list[FactRead]:
    if not facts:
        return []
    fact_ids = [fact.id for fact in facts]
    source_rows = (
        await session.execute(
            select(FactSource)
            .where(FactSource.fact_id.in_(fact_ids))
            .order_by(FactSource.created_at, FactSource.id)
        )
    ).scalars().all()
    sources_by_fact: dict[uuid.UUID, list[FactSourceRead]] = {}
    for row in source_rows:
        sources_by_fact.setdefault(row.fact_id, []).append(
            FactSourceRead(document_id=row.document_id, page=row.page, locator=row.locator, quote=row.quote)
        )

    canonical_ids = {
        extracted_id: canonical_id
        for extracted_id, canonical_id in (
            await session.execute(
                select(CanonicalFactSource.extracted_fact_id, CanonicalFactSource.canonical_fact_id)
                .join(CanonicalFact, CanonicalFact.id == CanonicalFactSource.canonical_fact_id)
                .where(
                    CanonicalFactSource.extracted_fact_id.in_(fact_ids),
                    CanonicalFact.active.is_(True),
                )
            )
        ).all()
    }

    mentions = await _mentions_by_id(session, [fact.entity_mention_id for fact in facts if fact.entity_mention_id])
    entities_by_id = await _entities_by_id(
        session,
        [mention.resolved_entity_id for mention in mentions.values() if mention.resolved_entity_id],
    )

    return [
        FactRead(
            id=fact.id,
            canonical_fact_id=canonical_ids.get(fact.id),
            document_id=fact.document_id,
            fact_type=fact.fact_type,
            value_raw=fact.value_raw,
            value_normalized=fact.value_normalized,
            value_type=fact.value_type,
            unit=fact.unit,
            period=fact.period,
            scope_level=fact.scope_level,
            resolution_status=fact.resolution_status,
            entity_mention=_entity_mention_read(mentions.get(fact.entity_mention_id), entities_by_id),
            sources=sources_by_fact.get(fact.id, []),
        )
        for fact in facts
    ]


async def _mentions_by_id(session: AsyncSession, ids: list[uuid.UUID | None]) -> dict[uuid.UUID, EntityMention]:
    clean = [id_ for id_ in ids if id_ is not None]
    if not clean:
        return {}
    rows = (await session.execute(select(EntityMention).where(EntityMention.id.in_(clean)))).scalars().all()
    return {row.id: row for row in rows}


async def _entities_by_id(session: AsyncSession, ids: list[uuid.UUID | None]) -> dict[uuid.UUID, CanonicalEntity]:
    clean = [id_ for id_ in ids if id_ is not None]
    if not clean:
        return {}
    rows = (await session.execute(select(CanonicalEntity).where(CanonicalEntity.id.in_(clean)))).scalars().all()
    return {row.id: row for row in rows}


def _entity_mention_read(
    mention: EntityMention | None,
    entities_by_id: dict[uuid.UUID, CanonicalEntity],
) -> FactEntityMentionRead | None:
    if mention is None:
        return None
    entity = entities_by_id.get(mention.resolved_entity_id)
    return FactEntityMentionRead(
        id=mention.id,
        raw_name=mention.raw_name,
        role=mention.role,
        resolution_status=mention.resolution_status,
        canonical_entity_id=mention.resolved_entity_id,
        canonical_entity_name=entity.legal_name if entity else None,
    )


async def _entity_read(session: AsyncSession, entity: CanonicalEntity) -> CanonicalEntityRead:
    aliases = (
        await session.execute(
            select(EntityAlias.alias)
            .where(EntityAlias.canonical_entity_id == entity.id)
            .order_by(EntityAlias.alias)
        )
    ).scalars().all()
    return CanonicalEntityRead(
        id=entity.id,
        engagement_id=entity.engagement_id,
        legal_name=entity.legal_name,
        jurisdiction=entity.jurisdiction,
        entity_type=entity.entity_type,
        aliases=list(aliases),
    )
