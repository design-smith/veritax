from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .extraction_schemas import validate_fact_scope
from .extraction_store import extracted_fact_promotable
from .functional import functional_fact_ok
from .models import (
    CanonicalFact,
    CanonicalFactSource,
    Document,
    EntityMention,
    ExtractedFact,
    ExtractionRun,
    FactSource,
)

PROMOTABLE_RUN_STATUSES = {"extracted", "partially_extracted", "needs_review"}


@dataclass(frozen=True)
class PromotionResult:
    promoted: int = 0
    linked: int = 0
    skipped: int = 0


async def promote_canonical_facts(session: AsyncSession, engagement_id: uuid.UUID) -> PromotionResult:
    facts = (
        await session.execute(
            select(ExtractedFact)
            .where(ExtractedFact.engagement_id == engagement_id)
            .order_by(ExtractedFact.created_at, ExtractedFact.id)
        )
    ).scalars().all()

    promoted = 0
    linked = 0
    skipped = 0
    for fact in facts:
        key = await _canonical_key(session, fact)
        if key is None:
            skipped += 1
            continue

        canonical = (
            await session.execute(
                select(CanonicalFact).where(
                    CanonicalFact.engagement_id == engagement_id,
                    CanonicalFact.canonical_key == key,
                    CanonicalFact.active.is_(True),
                )
            )
        ).scalar_one_or_none()
        if canonical is None:
            canonical = CanonicalFact(
                engagement_id=engagement_id,
                fact_type=fact.fact_type,
                value_normalized=_fact_value(fact),
                value_type=fact.value_type,
                unit=fact.unit,
                period=fact.period,
                scope_level=fact.scope_level,
                far_type=fact.far_type,
                transaction_id=fact.transaction_id,
                evidence_type=fact.evidence_type,
                canonical_key=key,
            )
            session.add(canonical)
            await session.flush()
            promoted += 1

        if await _link_source(session, canonical.id, fact.id):
            linked += 1

    return PromotionResult(promoted=promoted, linked=linked, skipped=skipped)


async def _canonical_key(session: AsyncSession, fact: ExtractedFact) -> str | None:
    run = await session.get(ExtractionRun, fact.extraction_run_id)
    if run is None or not run.active or run.status not in PROMOTABLE_RUN_STATUSES:
        return None
    # Document-sourced facts require an active document; interview-sourced facts (document_id None) skip that.
    if fact.document_id is not None:
        doc = await session.get(Document, fact.document_id)
        if doc is None or not doc.is_active:
            return None
    if not await _has_valid_provenance(session, fact):
        return None
    try:
        validate_fact_scope(fact.schema_key, fact.fact_type, fact.scope_level)
    except ValueError:
        return None
    if not extracted_fact_promotable(fact):
        return None
    # Functional facts (§7): the far_type must be a known ontology value, else it's not a supported conclusion (§46).
    if not functional_fact_ok(fact.fact_type, fact.far_type):
        return None

    entity_id = None
    if fact.entity_mention_id is not None:
        mention = await session.get(EntityMention, fact.entity_mention_id)
        if mention is None or mention.resolution_status != "resolved" or mention.resolved_entity_id is None:
            return None
        entity_id = str(mention.resolved_entity_id)

    payload = {
        "entity_id": entity_id,
        "fact_type": fact.fact_type,
        "period": fact.period,
        "scope_level": fact.scope_level,
        "unit": fact.unit,
        "value": _fact_value(fact),
    }
    # Functional dimensions distinguish e.g. "sales for txn1" from "marketing for txn1" / "sales for txn2".
    # Added only when present, so non-functional facts keep byte-identical keys (behaviour-preserving).
    if fact.far_type is not None:
        payload["far_type"] = fact.far_type
    if fact.transaction_id is not None:
        payload["transaction_id"] = fact.transaction_id
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


async def _has_valid_provenance(session: AsyncSession, fact: ExtractedFact) -> bool:
    sources = (
        await session.execute(select(FactSource).where(FactSource.fact_id == fact.id))
    ).scalars().all()
    for source in sources:
        if not (source.locator.strip() and source.quote.strip()):
            continue
        # Document facts: the source must point at the fact's document (unchanged). Interview facts
        # (document_id None): the source must point at an interview response (§19).
        if fact.document_id is not None and source.document_id == fact.document_id:
            return True
        if fact.document_id is None and source.interview_response_id is not None:
            return True
    return False


async def _link_source(session: AsyncSession, canonical_fact_id: uuid.UUID, extracted_fact_id: uuid.UUID) -> bool:
    existing = await session.get(
        CanonicalFactSource,
        {"canonical_fact_id": canonical_fact_id, "extracted_fact_id": extracted_fact_id},
    )
    if existing is not None:
        return False
    session.add(CanonicalFactSource(canonical_fact_id=canonical_fact_id, extracted_fact_id=extracted_fact_id))
    await session.flush()
    return True


def _fact_value(fact: ExtractedFact) -> str:
    if fact.value_normalized:
        return fact.value_normalized
    return re.sub(r"\s+", " ", fact.value_raw.casefold()).strip()
