from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

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


class WaitlistRequestCreate(BaseModel):
    name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    email: str = Field(min_length=1)
    company: str = Field(min_length=1)
    lead_id: str | None = None
    attribution: dict[str, str] | None = None


class WaitlistResponse(BaseModel):
    waitlist_user_id: str


class EngagementPatch(BaseModel):
    entity_name: str | None = None
    jurisdictions: list[str] | None = None
    fiscal_year: str | None = None
    website_url: str | None = None
    selected_source_kinds: list[SourceKind] | None = None


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    original_filename: str
    content_type: str | None
    size_bytes: int
    content_hash: str
    status: DocumentStatus
    extraction_status: str | None = None
    error: str | None
    created_at: datetime


class DocumentTextRead(BaseModel):
    id: uuid.UUID
    original_filename: str
    status: DocumentStatus
    text: str


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
    fiscal_year: str | None
    website_url: str | None
    selected_source_kinds: list[SourceKind]
    sources: list[SourceRead]


class EngagementSummary(BaseModel):
    """Lightweight row for the file library — no sources/documents payload."""
    id: uuid.UUID
    entity_name: str | None
    jurisdictions: list[str]
    fiscal_year: str | None
    updated_at: datetime


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
    error: str | None  # why this requirement failed to assess, if it did
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
    failed: int
    need_attention: int   # partial + missing
    draft_ready: bool
    draft_blocker: str | None
    present_ratio: float
    draft_min_present_ratio: float


class SkippedDocumentRead(BaseModel):
    document_id: uuid.UUID
    filename: str
    reason: str


class RegulatorySourceRead(BaseModel):
    title: str
    issuing_authority: str
    url: str | None = None
    citation_locator: str | None = None


class RegulatoryContextRead(BaseModel):
    """A jurisdiction-level rule surfaced on Requirements (PRD §11-12): applicability (applied/unknown) or
    materiality (a per-category threshold)."""
    rule_key: str
    rule_category: str                # "applicability" | "materiality"
    plain_english: str
    status: str                       # "applied" | "unknown" | "informational"
    result: bool | None = None
    missing_input: str | None = None
    threshold: float | None = None    # materiality: in-scope at or above this amount
    currency: str | None = None
    effective_from: str
    effective_to: str | None = None
    verification_status: str
    sources: list[RegulatorySourceRead] = []
    overridden: bool = False          # a practitioner override is in force (S8)
    override_reason: str | None = None


class RegulatoryOverrideCreate(BaseModel):
    jurisdiction: str
    rule_key: str
    override_value: dict               # fields overlaid onto the resolved rule, e.g. {"result": true}
    reason: str


class RegulatoryOverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    jurisdiction: str
    rule_key: str
    original_value: dict
    override_value: dict
    reason: str
    overridden_by: str | None
    created_at: datetime


class CoverageResponse(BaseModel):
    jurisdiction: str
    summary: CoverageSummary
    requirements: list[CoverageRead]
    skipped_documents: list[SkippedDocumentRead] = []
    regulatory: list[RegulatoryContextRead] = []  # jurisdiction rules from the registry (empty if none defined)


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
    tables: list = []   # [{id, title, columns[], rows[][]}]
    charts: list = []   # [{id, type, title, categories[], series[{name, values[]}]}]
    research: dict | None = None   # Industry Analysis research card (null on statutory sections)
    error: str | None
    citations: list[DraftCitationRead]


class DraftSectionPatch(BaseModel):
    content: str


class DraftSummary(BaseModel):
    total: int
    drafted: int
    pending: int
    failed: int


class DraftResponse(BaseModel):
    jurisdiction: str
    draft_mode: str
    summary: DraftSummary
    sections: list[DraftSectionRead]


class RequirementResultRead(BaseModel):
    requirement_key: str
    element_name: str
    status: str        # present | partial | missing | invalid | blocked | conditional
    severity: str = "medium"  # critical | high | medium | low
    explanation: str | None
    missing: list[list[str]] = []  # groups of acceptable document types still needed (each group = OR)
    overridden: bool = False


class RequirementResultsResponse(BaseModel):
    jurisdiction: str
    results: list[RequirementResultRead]


class RequirementEvidenceRead(BaseModel):
    document_id: uuid.UUID | None
    document_type: str
    role: str


class RequirementDetailResponse(BaseModel):
    requirement_key: str
    element_name: str
    status: str
    severity: str = "medium"
    explanation: str | None
    missing: list[list[str]] = []
    overridden: bool = False
    evidence: list[RequirementEvidenceRead] = []


class OverrideRequest(BaseModel):
    justification: str


class MissingGroupRead(BaseModel):
    acceptable: list[str]        # any one of these document types satisfies the gap
    sources: list[str] = []      # connectors that could supply them (e.g. SAP, Oracle)


class RequirementMissingResponse(BaseModel):
    requirement_key: str
    status: str
    severity: str = "medium"
    missing: list[MissingGroupRead] = []


class PipelineRecoveryResponse(BaseModel):
    retried_failed: bool
    documents_restarted: int
    coverage_jurisdictions_restarted: list[str]
    draft_jurisdictions_restarted: list[str]
    risk_jurisdictions_restarted: list[str]


class FactSourceRead(BaseModel):
    document_id: uuid.UUID
    page: int | None
    locator: str
    quote: str


class FactEntityMentionRead(BaseModel):
    id: uuid.UUID
    raw_name: str
    role: str
    resolution_status: str
    canonical_entity_id: uuid.UUID | None
    canonical_entity_name: str | None


class FactRead(BaseModel):
    id: uuid.UUID
    canonical_fact_id: uuid.UUID | None
    document_id: uuid.UUID
    fact_type: str
    value_raw: str
    value_normalized: str | None
    value_type: str
    unit: str | None
    period: str | None
    scope_level: str
    resolution_status: str
    entity_mention: FactEntityMentionRead | None
    sources: list[FactSourceRead]


class DocumentFactsResponse(BaseModel):
    document_id: uuid.UUID
    facts: list[FactRead]


class CanonicalEntityRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    legal_name: str
    jurisdiction: str | None
    entity_type: str | None
    aliases: list[str]


class RiskEvidenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    kind: str
    reference: str
    detail: str
    source_label: str | None
    verified: bool
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
    analysis_mode: str
    stale: bool
    summary: RiskSummary
    findings: list[RiskFindingRead]


# ── Functional interviews (Class 2 §13-19, §37, §43) ──
class InterviewResponseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    response_raw: str
    response_summary: str | None
    locator: str | None
    created_at: datetime


class InterviewQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    question_key: str
    question_text: str
    question_category: str | None
    sequence: int
    parent_question_id: uuid.UUID | None
    responses: list[InterviewResponseRead] = []


class InterviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    engagement_id: uuid.UUID
    entity_id: uuid.UUID | None
    participant_name: str
    participant_title: str | None
    participant_role: str | None
    transaction_ids: list = []
    fiscal_period: str | None
    interview_date: datetime | None
    status: str
    questions: list[InterviewQuestionRead] = []


class InterviewListItem(BaseModel):
    id: uuid.UUID
    participant_name: str
    participant_role: str | None
    entity_id: uuid.UUID | None
    transaction_ids: list = []
    status: str
    interview_date: datetime | None
    question_count: int
    answered_count: int


class InterviewCreate(BaseModel):
    entity_id: uuid.UUID | None = None
    participant_name: str
    participant_title: str | None = None
    participant_role: str | None = None
    transaction_ids: list[str] = []
    transaction_types: list[str] = []   # drives question-module selection (§22); not stored on the interview
    fiscal_period: str | None = None
    interview_date: datetime | None = None


class ResponseCreate(BaseModel):
    question_id: uuid.UUID
    response_raw: str
    response_summary: str | None = None
    locator: str | None = None


class InterviewFindings(BaseModel):
    functions: list[str] = []
    risks: list[str] = []
    decision_makers: list[str] = []
    open_questions: list[str] = []
