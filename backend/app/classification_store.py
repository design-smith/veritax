from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .evidence_taxonomy import load_taxonomy, require_document_type
from .models import (
    ClassificationState,
    DocumentClassification,
    DocumentRelevance,
    DocumentScope,
    DocumentTag,
)


class ClassificationInput(BaseModel):
    document_type: str
    classification_score: int
    classification_state: str
    relevance: str
    tags: list[str] = []
    entity: str | None = None
    jurisdiction: str | None = None
    fiscal_year: str | None = None
    language: str | None = None
    document_status: str | None = None
    version: str | None = None
    source_validation_result: dict = {}
    deterministic_signals: list[str] = []
    llm_supporting_quotes: list[str] = []
    candidate_requirements: list[str] = []
    candidate_extractors: list[str] = []
    scope_fingerprint: str
    classifier_version: str
    diagnostics: dict = {}
    taxonomy_version: str | None = None


class ScopeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    entity: str | None
    jurisdiction: str | None
    fiscal_year: str | None
    language: str | None
    document_status: str | None
    version: str | None
    source_validation_result: dict


class ClassificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    document_id: uuid.UUID
    taxonomy_version: str
    document_type: str
    classification_score: int
    classification_state: ClassificationState
    relevance: DocumentRelevance
    deterministic_signals: list
    llm_supporting_quotes: list
    candidate_requirements: list
    candidate_extractors: list
    scope_fingerprint: str
    classifier_version: str
    diagnostics: dict
    classified_at: datetime
    tags: list[str]
    scope: ScopeRead


def scope_fingerprint(
    *,
    document_hash: str,
    entity_name: str | None,
    jurisdictions: list[str],
    fiscal_year: str | None,
    classifier_version: str,
) -> str:
    payload = {
        "classifier_version": classifier_version,
        "document_hash": document_hash,
        "entity_name": (entity_name or "").strip().casefold(),
        "fiscal_year": (fiscal_year or "").strip().casefold(),
        "jurisdictions": sorted(j.strip().casefold() for j in jurisdictions if j.strip()),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


async def store_classification(session: AsyncSession, document_id: uuid.UUID, data: ClassificationInput) -> None:
    require_document_type(data.document_type)
    taxonomy_version = data.taxonomy_version or str(load_taxonomy()["taxonomy_version"])

    row = await session.get(DocumentClassification, document_id)
    if row is None:
        row = DocumentClassification(document_id=document_id)
        session.add(row)
    row.taxonomy_version = taxonomy_version
    row.document_type = data.document_type
    row.classification_score = data.classification_score
    row.classification_state = ClassificationState(data.classification_state)
    row.relevance = DocumentRelevance(data.relevance)
    row.deterministic_signals = data.deterministic_signals
    row.llm_supporting_quotes = data.llm_supporting_quotes
    row.candidate_requirements = data.candidate_requirements
    row.candidate_extractors = data.candidate_extractors
    row.scope_fingerprint = data.scope_fingerprint
    row.classifier_version = data.classifier_version
    row.diagnostics = data.diagnostics
    row.classified_at = datetime.now(timezone.utc)

    scope = await session.get(DocumentScope, document_id)
    if scope is None:
        scope = DocumentScope(document_id=document_id)
        session.add(scope)
    scope.entity = data.entity
    scope.jurisdiction = data.jurisdiction
    scope.fiscal_year = data.fiscal_year
    scope.language = data.language
    scope.document_status = data.document_status
    scope.version = data.version
    scope.source_validation_result = data.source_validation_result

    await session.execute(delete(DocumentTag).where(DocumentTag.document_id == document_id))
    for tag in dict.fromkeys(data.tags):
        session.add(DocumentTag(document_id=document_id, tag=tag))


async def load_classification(session: AsyncSession, document_id: uuid.UUID) -> ClassificationRead | None:
    row = await session.get(DocumentClassification, document_id)
    scope = await session.get(DocumentScope, document_id)
    if row is None or scope is None:
        return None
    tags = (
        await session.execute(select(DocumentTag.tag).where(DocumentTag.document_id == document_id).order_by(DocumentTag.tag))
    ).scalars().all()
    return ClassificationRead(
        **{
            "document_id": row.document_id,
            "taxonomy_version": row.taxonomy_version,
            "document_type": row.document_type,
            "classification_score": row.classification_score,
            "classification_state": row.classification_state,
            "relevance": row.relevance,
            "deterministic_signals": row.deterministic_signals,
            "llm_supporting_quotes": row.llm_supporting_quotes,
            "candidate_requirements": row.candidate_requirements,
            "candidate_extractors": row.candidate_extractors,
            "scope_fingerprint": row.scope_fingerprint,
            "classifier_version": row.classifier_version,
            "diagnostics": row.diagnostics,
            "classified_at": row.classified_at,
            "tags": list(tags),
            "scope": ScopeRead.model_validate(scope),
        }
    )
