from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .extraction_schemas import schema_entry, validate_fact_scope
from .models import Document, EntityMention, ExtractedFact, ExtractionExpectedField, ExtractionRun, FactSource

COMPLETED_EXTRACTION_STATUSES = {
    "extracted",
    "partially_extracted",
    "needs_review",
    "failed",
    "skipped_not_supported",
    "skipped_out_of_scope",
}


@dataclass(frozen=True)
class RunResult:
    run: ExtractionRun
    reused: bool


class RunInput(BaseModel):
    engagement_id: uuid.UUID
    document_id: uuid.UUID | None = None   # None = interview-sourced (S5)
    schema_key: str
    schema_version: str
    classification_type: str
    classification_version: str
    runner_version: str
    model_version: str
    fingerprint: str
    status: str
    diagnostics: dict = {}
    active: bool = True


class ExtractedFactInput(BaseModel):
    schema_key: str
    schema_version: str
    fact_type: str
    value_raw: str
    value_normalized: str | None = None
    value_type: str
    unit: str | None = None
    period: str | None = None
    scope_level: str
    entity_mention_id: uuid.UUID | None = None
    resolution_status: str = "not_required"
    far_type: str | None = None            # Class 2 §7: function/asset/risk value (validated at promotion)
    transaction_id: str | None = None
    evidence_type: str | None = None
    interview_response_id: uuid.UUID | None = None   # S5: interview-sourced provenance (no document)


class FactSourceInput(BaseModel):
    document_id: uuid.UUID | None = None            # None = interview-sourced (S5)
    interview_response_id: uuid.UUID | None = None
    page: int | None = None
    locator: str
    quote: str


class EntityMentionInput(BaseModel):
    raw_name: str
    role: str
    locator: str
    quote: str
    normalized_name: str | None = None
    resolution_status: str = "unresolved"


class ExpectedFieldInput(BaseModel):
    field_name: str
    status: str
    reason: str | None = None


def extraction_fingerprint(
    *,
    document_hash: str,
    classification_type: str,
    classification_version: str,
    schema_version: str,
    runner_version: str,
    model_version: str,
    scope_values: dict | None = None,
    scope_dependencies: list[str] | None = None,
) -> str:
    payload = {
        "classification_type": classification_type,
        "classification_version": classification_version,
        "document_hash": document_hash,
        "model_version": model_version,
        "runner_version": runner_version,
        "schema_version": schema_version,
    }
    if scope_dependencies:
        values = scope_values or {}
        payload["scope"] = {key: values.get(key) for key in sorted(scope_dependencies)}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


async def create_extraction_run(session: AsyncSession, data: RunInput) -> ExtractionRun:
    schema_entry(data.schema_key)
    run = ExtractionRun(**data.model_dump())
    session.add(run)
    if data.document_id is not None:
        doc = await session.get(Document, data.document_id)
        if doc is not None:
            doc.extraction_status = data.status
    await session.flush()
    return run


async def get_or_create_extraction_run(session: AsyncSession, data: RunInput) -> RunResult:
    existing = (
        await session.execute(
            select(ExtractionRun).where(
                ExtractionRun.document_id == data.document_id,
                ExtractionRun.schema_key == data.schema_key,
                ExtractionRun.fingerprint == data.fingerprint,
                ExtractionRun.active.is_(True),
                ExtractionRun.status.in_(COMPLETED_EXTRACTION_STATUSES),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return RunResult(existing, True)

    old_runs = (
        await session.execute(
            select(ExtractionRun).where(
                ExtractionRun.document_id == data.document_id,
                ExtractionRun.schema_key == data.schema_key,
                ExtractionRun.active.is_(True),
            )
        )
    ).scalars().all()
    now = datetime.now(timezone.utc)
    for old in old_runs:
        old.active = False
        old.superseded_at = now
    return RunResult(await create_extraction_run(session, data), False)


async def add_extracted_fact(
    session: AsyncSession,
    extraction_run_id: uuid.UUID,
    document_id: uuid.UUID | None,   # None = interview-sourced (S5)
    data: ExtractedFactInput,
    *,
    sources: list[FactSourceInput],
) -> ExtractedFact:
    run = await session.get(ExtractionRun, extraction_run_id)
    if run is None:
        raise ValueError(f"extraction run not found: {extraction_run_id}")
    validate_fact_scope(data.schema_key, data.fact_type, data.scope_level)
    fact = ExtractedFact(
        engagement_id=run.engagement_id,
        extraction_run_id=extraction_run_id,
        document_id=document_id,
        **data.model_dump(),
    )
    session.add(fact)
    await session.flush()
    for source in sources:
        session.add(FactSource(fact_id=fact.id, **source.model_dump()))
    return fact


async def add_entity_mention(
    session: AsyncSession,
    extraction_run_id: uuid.UUID,
    document_id: uuid.UUID,
    extracted_fact_id: uuid.UUID,
    data: EntityMentionInput,
) -> EntityMention:
    run = await session.get(ExtractionRun, extraction_run_id)
    if run is None:
        raise ValueError(f"extraction run not found: {extraction_run_id}")
    fact = await session.get(ExtractedFact, extracted_fact_id)
    if fact is None:
        raise ValueError(f"extracted fact not found: {extracted_fact_id}")
    mention = EntityMention(
        engagement_id=run.engagement_id,
        document_id=document_id,
        extraction_run_id=extraction_run_id,
        extracted_fact_id=extracted_fact_id,
        raw_name=data.raw_name,
        normalized_name=data.normalized_name or _normalize_name(data.raw_name),
        role=data.role,
        locator=data.locator,
        quote=data.quote,
        resolution_status=data.resolution_status,
    )
    session.add(mention)
    await session.flush()
    fact.entity_mention_id = mention.id
    fact.resolution_status = data.resolution_status
    return mention


def extracted_fact_promotable(fact: ExtractedFact) -> bool:
    if fact.value_type == "entity_ref" and fact.resolution_status != "resolved":
        return False
    return fact.resolution_status not in {"unresolved", "failed"}


async def add_expected_field(
    session: AsyncSession,
    extraction_run_id: uuid.UUID,
    data: ExpectedFieldInput,
) -> ExtractionExpectedField:
    run = await session.get(ExtractionRun, extraction_run_id)
    if run is None:
        raise ValueError(f"extraction run not found: {extraction_run_id}")
    row = ExtractionExpectedField(extraction_run_id=extraction_run_id, **data.model_dump())
    session.add(row)
    doc = await session.get(Document, run.document_id)
    if doc is not None:
        doc.extraction_status = run.status
    await session.flush()
    return row


async def load_extraction_run(session: AsyncSession, run_id: uuid.UUID) -> ExtractionRun | None:
    return await session.get(ExtractionRun, run_id)


def _normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold()).strip()
