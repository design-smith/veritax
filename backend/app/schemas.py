from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .models import (
    CitationKind,
    Confidence,
    ConnectorCategory,
    ConnectorStatus,
    CoverageStatus,
    DocumentStatus,
    DraftStatus,
    RiskKind,
    RiskSeverity,
    SourceKind,
    SourceOrigin,
)


class IdResponse(BaseModel):
    id: uuid.UUID


class EngagementPatch(BaseModel):
    entity_name: str | None = None
    jurisdictions: list[str] | None = None
    website_url: str | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    original_filename: str
    content_type: str | None
    size_bytes: int
    content_hash: str
    status: DocumentStatus
    error: str | None
    created_at: datetime


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: SourceKind
    origin: SourceOrigin
    connector_provider: str | None
    url: str | None
    documents: list[DocumentRead] = []


class EngagementRead(BaseModel):
    id: uuid.UUID
    entity_name: str | None
    jurisdictions: list[str]
    website_url: str | None
    sources: list[SourceRead]


class SourceCreate(BaseModel):
    kind: SourceKind
    origin: SourceOrigin
    connector_provider: str | None = None
    url: str | None = None


class ConnectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    provider: str
    display_name: str
    category: ConnectorCategory
    status: ConnectorStatus


class SearchHit(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    chunk_index: int
    snippet: str
    distance: float


class CoverageEvidenceRead(BaseModel):
    document_id: uuid.UUID | None
    source_label: str
    locator: str  # section / page / quoted passage where the requirement is satisfied


class CoverageRead(BaseModel):
    id: uuid.UUID
    requirement_key: str
    element_order: int
    element_name: str
    element_description: str
    is_conditional: bool
    verified: bool
    status: CoverageStatus
    whats_present: str | None
    whats_missing: str | None
    confidence: Confidence | None
    sources_used: list[str]  # source kinds that fed the assessment
    evidence: list[CoverageEvidenceRead]  # which document + where (provenance pointers)
    draft_section_id: uuid.UUID | None  # the drafted section that fulfils this requirement, if drafted


class CoverageSummary(BaseModel):
    total: int
    required_total: int   # excludes conditional
    present: int
    partial: int
    missing: int
    conditional: int
    pending: int
    need_attention: int   # partial + missing


class CoverageResponse(BaseModel):
    jurisdiction: str
    summary: CoverageSummary
    requirements: list[CoverageRead]


class DraftCitationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    marker: int
    kind: CitationKind
    document_id: uuid.UUID | None
    url: str | None
    source_label: str
    quote: str


class DraftSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    requirement_key: str
    element_order: int
    element_name: str
    status: DraftStatus
    content: str | None
    error: str | None
    citations: list[DraftCitationRead]


class DraftSummary(BaseModel):
    total: int
    drafted: int
    pending: int
    failed: int


class DraftResponse(BaseModel):
    jurisdiction: str
    summary: DraftSummary
    sections: list[DraftSectionRead]


class RiskEvidenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    kind: str
    reference: str
    detail: str
    document_id: uuid.UUID | None


class RiskFindingRead(BaseModel):
    id: uuid.UUID
    kind: RiskKind
    title: str
    description: str
    severity: RiskSeverity
    exposure_label: str | None
    exposure_estimated: bool
    exposure_amount: float | None
    exposure_currency: str | None
    confidence: Confidence
    evidence: list[RiskEvidenceRead]
    recommendations: list[str]


class RiskSummary(BaseModel):
    total: int
    by_severity: dict[str, int]
    by_kind: dict[str, int]


class RiskResponse(BaseModel):
    jurisdiction: str
    status: str        # not_started | pending | analyzing | done | failed
    error: str | None
    summary: RiskSummary
    findings: list[RiskFindingRead]
