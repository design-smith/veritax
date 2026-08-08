from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import CanonicalEntity, EntityAlias, EntityMention, ExtractedFact

LEGAL_SUFFIX_RE = re.compile(r"\b(bv|gmbh|limited|ltd|llc|inc|corp|plc|ag|sa|sarl|pte|kk)\b")
STRONG_ROLES = {
    "provider",
    "recipient",
    "lender",
    "borrower",
    "licensor",
    "licensee",
    "legal_entity",
    "entity",
    "counterparty",
}
VAGUE_NAMES = {"the group", "group", "local entity", "affiliate", "company"}


@dataclass(frozen=True)
class EntityResolution:
    resolved: bool
    entity_id: uuid.UUID | None = None
    reason: str = ""


async def add_entity_alias(
    session: AsyncSession,
    canonical_entity_id: uuid.UUID,
    alias: str,
    *,
    source_entity_mention_id: uuid.UUID | None = None,
) -> EntityAlias:
    entity = await session.get(CanonicalEntity, canonical_entity_id)
    if entity is None:
        raise ValueError(f"canonical entity not found: {canonical_entity_id}")
    normalized = normalize_name(alias)
    existing = (
        await session.execute(
            select(EntityAlias).where(
                EntityAlias.engagement_id == entity.engagement_id,
                EntityAlias.normalized_alias == normalized,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    row = EntityAlias(
        engagement_id=entity.engagement_id,
        canonical_entity_id=canonical_entity_id,
        alias=alias,
        normalized_alias=normalized,
        source_entity_mention_id=source_entity_mention_id,
    )
    session.add(row)
    await session.flush()
    return row


async def resolve_entity_mention(
    session: AsyncSession,
    entity_mention_id: uuid.UUID,
    *,
    suggested_entity_id: uuid.UUID | None = None,
) -> EntityResolution:
    mention = await session.get(EntityMention, entity_mention_id)
    if mention is None:
        raise ValueError(f"entity mention not found: {entity_mention_id}")
    mention.normalized_name = normalize_name(mention.raw_name)
    if _is_vague(mention.normalized_name):
        await _mark_unresolved(session, mention)
        return EntityResolution(False, reason="vague mention")

    exact = await _entity_by_name(session, mention.engagement_id, mention.normalized_name)
    if exact is not None:
        await _mark_resolved(session, mention, exact.id)
        return EntityResolution(True, exact.id, "exact legal name")

    alias = await _entity_by_alias(session, mention.engagement_id, mention.normalized_name)
    if alias is not None:
        await _mark_resolved(session, mention, alias.canonical_entity_id)
        return EntityResolution(True, alias.canonical_entity_id, "alias")

    if _can_create_entity(mention):
        entity = CanonicalEntity(
            engagement_id=mention.engagement_id,
            legal_name=mention.raw_name,
            normalized_name=mention.normalized_name,
        )
        session.add(entity)
        await session.flush()
        await _mark_resolved(session, mention, entity.id)
        return EntityResolution(True, entity.id, "strong legal name")

    await _mark_unresolved(session, mention)
    return EntityResolution(False, reason="no deterministic match")


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip()


async def _entity_by_name(session: AsyncSession, engagement_id: uuid.UUID, normalized: str) -> CanonicalEntity | None:
    return (
        await session.execute(
            select(CanonicalEntity).where(
                CanonicalEntity.engagement_id == engagement_id,
                CanonicalEntity.normalized_name == normalized,
            )
        )
    ).scalar_one_or_none()


async def _entity_by_alias(session: AsyncSession, engagement_id: uuid.UUID, normalized: str) -> EntityAlias | None:
    return (
        await session.execute(
            select(EntityAlias).where(
                EntityAlias.engagement_id == engagement_id,
                EntityAlias.normalized_alias == normalized,
            )
        )
    ).scalar_one_or_none()


def _can_create_entity(mention: EntityMention) -> bool:
    return mention.role in STRONG_ROLES and bool(LEGAL_SUFFIX_RE.search(mention.raw_name.casefold().replace(".", "")))


def _is_vague(normalized: str) -> bool:
    return normalized in VAGUE_NAMES


async def _mark_resolved(session: AsyncSession, mention: EntityMention, entity_id: uuid.UUID) -> None:
    mention.resolved_entity_id = entity_id
    mention.resolution_status = "resolved"
    fact = await session.get(ExtractedFact, mention.extracted_fact_id)
    if fact is not None:
        fact.resolution_status = "resolved"


async def _mark_unresolved(session: AsyncSession, mention: EntityMention) -> None:
    mention.resolved_entity_id = None
    mention.resolution_status = "unresolved"
    fact = await session.get(ExtractedFact, mention.extracted_fact_id)
    if fact is not None:
        fact.resolution_status = "unresolved"
