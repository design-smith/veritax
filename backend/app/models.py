from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from .config import settings


class Base(DeclarativeBase):
    pass


# ── Enums (native Postgres enums) ────────────────────────────────────────────
class SourceKind(str, enum.Enum):
    financials = "financials"
    agreements = "agreements"
    public = "public"
    interview = "interview"
    supplement = "supplement"  # requirement-gap material added in the Requirements stage


class SourceOrigin(str, enum.Enum):
    uploaded = "uploaded"
    connected = "connected"
    reference = "reference"


class DocumentStatus(str, enum.Enum):
    uploaded = "uploaded"
    embedding = "embedding"
    embedded = "embedded"
    failed = "failed"


class ClassificationState(str, enum.Enum):
    accepted = "accepted"
    needs_review = "needs_review"
    unknown = "unknown"
    rejected = "rejected"


class DocumentRelevance(str, enum.Enum):
    relevant = "relevant"
    partially_relevant = "partially_relevant"
    out_of_scope = "out_of_scope"
    unknown = "unknown"


class ConnectorCategory(str, enum.Enum):
    accounting = "accounting"
    notetaker = "notetaker"


class ConnectorStatus(str, enum.Enum):
    available = "available"
    wired = "wired"


class CoverageStatus(str, enum.Enum):
    pending = "pending"       # not yet assessed
    present = "present"
    partial = "partial"
    missing = "missing"
    conditional = "conditional"  # required:false element not yet triggered
    failed = "failed"         # assessment errored


class Confidence(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class SupplementKind(str, enum.Enum):
    upload = "upload"
    text = "text"


class DraftStatus(str, enum.Enum):
    pending = "pending"
    drafting = "drafting"
    drafted = "drafted"
    failed = "failed"


class RequirementStatus(str, enum.Enum):
    """Deterministic requirement-matching verdict. Slice 1 emits present/missing; the rest are reserved so
    the column type is stable across slices (partial/invalid = slice 2, blocked = slice 3, conflicted is set
    later by Contradiction Detection). conditional = a required:false element whose trigger hasn't applied."""
    present = "present"
    partial = "partial"
    missing = "missing"
    invalid = "invalid"
    blocked = "blocked"
    conditional = "conditional"
    conflicted = "conflicted"


class CitationKind(str, enum.Enum):
    document = "document"  # confidential source document
    web = "web"            # external research (gap-filler)


class RiskKind(str, enum.Enum):
    discrepancy = "discrepancy"  # the file contradicts itself or the record (objective)
    exposure = "exposure"        # documented but weak/indefensible position (judgment)


class RiskSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class RiskRunStatus(str, enum.Enum):
    pending = "pending"
    analyzing = "analyzing"
    done = "done"
    failed = "failed"


class PipelineJobKind(str, enum.Enum):
    index_document = "index_document"
    extract_document = "extract_document"
    assess_requirements = "assess_requirements"
    draft_jurisdiction = "draft_jurisdiction"
    analyze_risks = "analyze_risks"


class PipelineJobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    blocked = "blocked"


def _uuid_col() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


# ── Tables ───────────────────────────────────────────────────────────────────
class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Engagement(Base):
    __tablename__ = "engagements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Owner = the Supabase auth user (JWT `sub`). No FK to auth.users (avoid cross-schema coupling);
    # nullable so pre-auth rows survive — those are legacy and belong to no one, so no user sees them.
    user_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    fiscal_year: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_source_kinds: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    entity: Mapped[Entity | None] = relationship(lazy="selectin")
    jurisdictions: Mapped[list[EngagementJurisdiction]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    sources: Mapped[list[Source]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="Source.created_at"
    )


class EngagementJurisdiction(Base):
    __tablename__ = "engagement_jurisdictions"

    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), primary_key=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, primary_key=True)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[SourceKind] = mapped_column(Enum(SourceKind, name="source_kind"), nullable=False)
    origin: Mapped[SourceOrigin] = mapped_column(
        Enum(SourceOrigin, name="source_origin"), nullable=False
    )
    connector_provider: Mapped[str | None] = mapped_column(
        ForeignKey("connectors.provider"), nullable=True
    )
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    documents: Mapped[list[Document]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="Document.created_at"
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("storage_bucket", "storage_key", name="uq_documents_storage"),
        Index("ix_documents_content_hash", "content_hash"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    original_filename: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        nullable=False,
        default=DocumentStatus.uploaded,
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    doc_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chunks: Mapped[list[DocumentChunk]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_chunk_index"),
        Index(
            "ix_document_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim), nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentClassification(Base):
    __tablename__ = "document_classifications"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    taxonomy_version: Mapped[str] = mapped_column(Text, nullable=False)
    document_type: Mapped[str] = mapped_column(Text, nullable=False)
    classification_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    classification_state: Mapped[ClassificationState] = mapped_column(
        Enum(ClassificationState, name="classification_state"),
        nullable=False,
        default=ClassificationState.unknown,
    )
    relevance: Mapped[DocumentRelevance] = mapped_column(
        Enum(DocumentRelevance, name="document_relevance"),
        nullable=False,
        default=DocumentRelevance.unknown,
    )
    deterministic_signals: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    llm_supporting_quotes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    candidate_requirements: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    candidate_extractors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    scope_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    classifier_version: Mapped[str] = mapped_column(Text, nullable=False)
    diagnostics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    classified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentTag(Base):
    __tablename__ = "document_tags"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(Text, primary_key=True)


class DocumentScope(Base):
    __tablename__ = "document_scope"

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    entity: Mapped[str | None] = mapped_column(Text, nullable=True)
    jurisdiction: Mapped[str | None] = mapped_column(Text, nullable=True)
    fiscal_year: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_validation_result: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"
    __table_args__ = (
        Index("ix_extraction_runs_document_active", "document_id", "active"),
        Index("ix_extraction_runs_fingerprint", "fingerprint"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True   # null = interview-sourced (S5)
    )
    schema_key: Mapped[str] = mapped_column(Text, nullable=False)
    schema_version: Mapped[str] = mapped_column(Text, nullable=False)
    classification_type: Mapped[str] = mapped_column(Text, nullable=False)
    classification_version: Mapped[str] = mapped_column(Text, nullable=False)
    runner_version: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    diagnostics: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    facts: Mapped[list[ExtractedFact]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ExtractedFact.created_at"
    )
    expected_fields: Mapped[list[ExtractionExpectedField]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ExtractionExpectedField.field_name"
    )


class ExtractedFact(Base):
    __tablename__ = "extracted_facts"
    __table_args__ = (
        Index("ix_extracted_facts_run", "extraction_run_id"),
        Index("ix_extracted_facts_document", "document_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    extraction_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extraction_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True   # null = interview-sourced (S5)
    )
    schema_key: Mapped[str] = mapped_column(Text, nullable=False)
    schema_version: Mapped[str] = mapped_column(Text, nullable=False)
    fact_type: Mapped[str] = mapped_column(Text, nullable=False)
    value_raw: Mapped[str] = mapped_column(Text, nullable=False)
    value_normalized: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_type: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    period: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_level: Mapped[str] = mapped_column(Text, nullable=False)
    entity_mention_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    resolution_status: Mapped[str] = mapped_column(Text, nullable=False, default="not_required")
    # Functional evidence (Class 2 §7): far_type = the function/asset/risk value (validated vs the FAR ontology);
    # transaction_id = the controlled transaction; evidence_type = the kind of functional evidence. Nullable —
    # non-functional facts leave them null, so existing rows/flows are unchanged.
    far_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    # S5: interview-sourced facts have no document; provenance points at the interview response instead (§19).
    interview_response_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("interview_responses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sources: Mapped[list[FactSource]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="FactSource.created_at"
    )


class EntityMention(Base):
    __tablename__ = "entity_mentions"
    __table_args__ = (
        Index("ix_entity_mentions_run", "extraction_run_id"),
        Index("ix_entity_mentions_document", "document_id"),
        Index("ix_entity_mentions_fact", "extracted_fact_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    extraction_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extraction_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    extracted_fact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extracted_facts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    raw_name: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    locator: Mapped[str] = mapped_column(Text, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    resolution_status: Mapped[str] = mapped_column(Text, nullable=False, default="unresolved")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CanonicalEntity(Base):
    __tablename__ = "canonical_entities"
    __table_args__ = (
        UniqueConstraint("engagement_id", "normalized_name", name="uq_canonical_entity_name"),
        Index("ix_canonical_entities_engagement", "engagement_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    legal_name: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_name: Mapped[str] = mapped_column(Text, nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EntityAlias(Base):
    __tablename__ = "entity_aliases"
    __table_args__ = (
        UniqueConstraint("engagement_id", "normalized_alias", name="uq_entity_alias"),
        Index("ix_entity_aliases_entity", "canonical_entity_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    canonical_entity_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("canonical_entities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_alias: Mapped[str] = mapped_column(Text, nullable=False)
    source_entity_mention_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("entity_mentions.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CanonicalFact(Base):
    __tablename__ = "canonical_facts"
    __table_args__ = (
        UniqueConstraint("engagement_id", "canonical_key", name="uq_canonical_fact_key"),
        Index("ix_canonical_facts_engagement", "engagement_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fact_type: Mapped[str] = mapped_column(Text, nullable=False)
    value_normalized: Mapped[str] = mapped_column(Text, nullable=False)
    value_type: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    period: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_level: Mapped[str] = mapped_column(Text, nullable=False)
    far_type: Mapped[str | None] = mapped_column(Text, nullable=True)          # Class 2 §7 functional dimensions
    transaction_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    canonical_key: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    conflict_candidate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    sources: Mapped[list[CanonicalFactSource]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="CanonicalFactSource.created_at"
    )


class CanonicalFactSource(Base):
    __tablename__ = "canonical_fact_sources"

    canonical_fact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("canonical_facts.id", ondelete="CASCADE"), primary_key=True
    )
    extracted_fact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extracted_facts.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FactSource(Base):
    __tablename__ = "fact_sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    fact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extracted_facts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True   # null = interview-sourced (S5)
    )
    # S5: interview-sourced provenance points at the interview response (§19) instead of a document.
    interview_response_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("interview_responses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    locator: Mapped[str] = mapped_column(Text, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExtractionExpectedField(Base):
    __tablename__ = "extraction_expected_fields"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    extraction_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("extraction_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Connector(Base):
    __tablename__ = "connectors"

    provider: Mapped[str] = mapped_column(Text, primary_key=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[ConnectorCategory] = mapped_column(
        Enum(ConnectorCategory, name="connector_category"), nullable=False
    )
    status: Mapped[ConnectorStatus] = mapped_column(
        Enum(ConnectorStatus, name="connector_status"),
        nullable=False,
        default=ConnectorStatus.available,
    )


class ConnectorSelectedFile(Base):
    """Future-proofing: when a connector is wired, the user picks specific files (not the whole
    account). Present but unused until real connectors land."""

    __tablename__ = "connector_selected_files"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    external_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    selected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RequirementCoverage(Base):
    """Per-requirement input-sufficiency assessment (present/partial/missing). Requirement
    *definitions* live in the JSON seed; this row carries a snapshot + the assessment result."""

    __tablename__ = "requirement_coverage"
    __table_args__ = (
        UniqueConstraint(
            "engagement_id", "jurisdiction", "requirement_key", name="uq_coverage_requirement"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_key: Mapped[str] = mapped_column(Text, nullable=False)
    element_order: Mapped[int] = mapped_column(Integer, nullable=False)
    element_name: Mapped[str] = mapped_column(Text, nullable=False)
    element_description: Mapped[str] = mapped_column(Text, nullable=False)
    is_conditional: Mapped[bool] = mapped_column(default=False)
    verified: Mapped[bool] = mapped_column(default=False)
    status: Mapped[CoverageStatus] = mapped_column(
        Enum(CoverageStatus, name="coverage_status"), nullable=False, default=CoverageStatus.pending
    )
    whats_present: Mapped[str | None] = mapped_column(Text, nullable=True)
    whats_missing: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[Confidence | None] = mapped_column(
        Enum(Confidence, name="confidence"), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    evidence: Mapped[list[CoverageEvidence]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    supplements: Mapped[list[CoverageSupplement]] = relationship(
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CoverageSupplement.created_at",
        foreign_keys="CoverageSupplement.coverage_id",
    )


class CoverageEvidence(Base):
    """Provenance pointer: which document, and where in it, satisfies a requirement."""

    __tablename__ = "coverage_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    coverage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("requirement_coverage.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    source_label: Mapped[str] = mapped_column(Text, nullable=False)  # filename shown to the user
    locator: Mapped[str] = mapped_column(Text, nullable=False)       # section / page / quoted passage


class CoverageSupplement(Base):
    """Material added in-place to fill a requirement gap. Also lands in the engagement corpus as a
    Document so the Draft stage consumes it as a genuine input."""

    __tablename__ = "coverage_supplements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    coverage_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("requirement_coverage.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[SupplementKind] = mapped_column(
        Enum(SupplementKind, name="supplement_kind"), nullable=False
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    source_context: Mapped[str] = mapped_column(Text, nullable=False, default="supplement")
    target_requirement_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("requirement_coverage.id", ondelete="SET NULL"), nullable=True, index=True
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DraftSection(Base):
    """One drafted section per required element (the requirements list IS the document structure)."""

    __tablename__ = "draft_sections"
    __table_args__ = (
        UniqueConstraint("engagement_id", "jurisdiction", "requirement_key", name="uq_draft_section"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_key: Mapped[str] = mapped_column(Text, nullable=False)
    element_order: Mapped[int] = mapped_column(Integer, nullable=False)
    element_name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DraftStatus] = mapped_column(
        Enum(DraftStatus, name="draft_status"), nullable=False, default=DraftStatus.pending
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Structured renderables — rendered natively on-screen and in the .docx; referenced from `content`
    # by [[table:id]] / [[chart:id]] markers.
    tables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    charts: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Structured "research result" for the web-sourced Industry Analysis section (null on statutory sections).
    research: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    drafted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    citations: Mapped[list[DraftCitation]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="DraftCitation.marker"
    )


class DraftCitation(Base):
    """Per-claim provenance (Law L1): every factual sentence links to its source, captured as drafted."""

    __tablename__ = "draft_citations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("draft_sections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    marker: Mapped[int] = mapped_column(Integer, nullable=False)  # the [n] in the section content
    kind: Mapped[CitationKind] = mapped_column(Enum(CitationKind, name="citation_kind"), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_label: Mapped[str] = mapped_column(Text, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RequirementResult(Base):
    """Deterministic requirement-matching verdict from the evidence-policy engine. Runs on the new
    /requirements path; replaces RequirementCoverage at cutover. Definitions/policies stay in the JSON seed —
    only per-engagement results live here."""

    __tablename__ = "requirement_results"
    __table_args__ = (
        UniqueConstraint("engagement_id", "jurisdiction", "requirement_key", name="uq_requirement_result"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_key: Mapped[str] = mapped_column(Text, nullable=False)
    element_name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RequirementStatus] = mapped_column(
        Enum(RequirementStatus, name="requirement_status"), nullable=False
    )
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Unmet parts of the evaluation policy: list of acceptable-document-type groups (satisfy any one per group).
    missing: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    overridden: Mapped[bool] = mapped_column(default=False)  # human "mark satisfied" is in effect
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    evidence: Mapped[list[RequirementEvidence]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class RequirementOverride(Base):
    """A practitioner's explicit 'mark satisfied' — audited human judgment that survives recompute of the
    deterministic result and is re-applied on every evaluation."""

    __tablename__ = "requirement_overrides"
    __table_args__ = (
        UniqueConstraint("engagement_id", "jurisdiction", "requirement_key", name="uq_requirement_override"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    requirement_key: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(Text, nullable=False)         # who asserted it (email or user id)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RequirementEvidence(Base):
    """A document that counted toward a requirement's verdict, with the role it played (evidence policy)."""

    __tablename__ = "requirement_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("requirement_results.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )
    document_type: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)


class RiskRun(Base):
    """One risk analysis over the completed draft, per jurisdiction."""

    __tablename__ = "risk_runs"
    __table_args__ = (UniqueConstraint("engagement_id", "jurisdiction", name="uq_risk_run"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RiskRunStatus] = mapped_column(
        Enum(RiskRunStatus, name="risk_run_status"), nullable=False, default=RiskRunStatus.pending
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    findings: Mapped[list[RiskFinding]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="RiskFinding.rank"
    )


class RiskFinding(Base):
    __tablename__ = "risk_findings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("risk_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[RiskKind] = mapped_column(Enum(RiskKind, name="risk_kind"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[RiskSeverity] = mapped_column(Enum(RiskSeverity, name="risk_severity"), nullable=False)
    exposure_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    exposure_estimated: Mapped[bool] = mapped_column(default=True)  # true until a real engine computes it
    exposure_amount: Mapped[float | None] = mapped_column(Numeric, nullable=True)  # null until computed
    exposure_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    confidence: Mapped[Confidence] = mapped_column(Enum(Confidence, name="confidence"), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # severity order, worst first
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    evidence: Mapped[list[RiskEvidence]] = relationship(cascade="all, delete-orphan", lazy="selectin")
    recommendations: Mapped[list[RiskRecommendation]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="RiskRecommendation.order"
    )


class RiskEvidence(Base):
    """Traceable evidence for a finding: a draft section, a figure, or a source document."""

    __tablename__ = "risk_evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("risk_findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)  # section | figure | document
    reference: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    source_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified: Mapped[bool] = mapped_column(default=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )


class RiskRecommendation(Base):
    """A recommended option (not an instruction) — the practitioner decides."""

    __tablename__ = "risk_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    finding_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("risk_findings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class PipelineJob(Base):
    """Durable background work. Postgres is the queue; the worker is intentionally tiny."""

    __tablename__ = "pipeline_jobs"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_pipeline_job_dedupe"),
        Index("ix_pipeline_jobs_runnable", "status", "next_run_at", "created_at"),
        Index("ix_pipeline_jobs_engagement", "engagement_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[PipelineJobKind] = mapped_column(
        Enum(PipelineJobKind, name="pipeline_job_kind"), nullable=False
    )
    dedupe_key: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[PipelineJobStatus] = mapped_column(
        Enum(PipelineJobStatus, name="pipeline_job_status"),
        nullable=False,
        default=PipelineJobStatus.queued,
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_required: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# Public demo "Access Veritax" request-access submissions. Not tied to an account (the demo is anonymous).
class WaitlistRequest(Base):
    __tablename__ = "waitlist_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    country: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    lead_id: Mapped[str | None] = mapped_column(Text, nullable=True)          # opaque campaign id, never PII in a URL
    attribution: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # utm_* etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EngagementRegulatorySnapshot(Base):
    """Pins the resolved regulatory rule versions for an engagement's (jurisdiction, fiscal_year) so
    Requirements, Draft, and Risks all reason from the SAME snapshot (PRD Class 1 §40)."""

    __tablename__ = "engagement_regulatory_snapshots"
    __table_args__ = (
        UniqueConstraint("engagement_id", "jurisdiction", name="uq_regulatory_snapshot"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    fiscal_year: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # regulatory_snapshot() payload
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RegulatoryOverride(Base):
    """A practitioner override of a resolved regulatory rule (PRD Class 1 §S8). The original value is preserved
    and the change is audited (reason, user, timestamp); overlaid on the resolved rules with a 'Practitioner
    override' marker so the source of truth stays auditable."""

    __tablename__ = "regulatory_overrides"
    __table_args__ = (
        UniqueConstraint("engagement_id", "jurisdiction", "rule_key", name="uq_regulatory_override"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jurisdiction: Mapped[str] = mapped_column(Text, nullable=False)
    rule_key: Mapped[str] = mapped_column(Text, nullable=False)
    original_value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # audit: value before override
    override_value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # fields overlaid onto the rule
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    overridden_by: Mapped[str | None] = mapped_column(Text, nullable=True)  # auth user (sub / email)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FunctionalInterview(Base):
    """A scoped functional interview (Class 2 §13-15, §43) — an active Planning capability, not just an upload.
    Scoped to engagement + entity + transaction(s) + participant + role + fiscal period (§14)."""

    __tablename__ = "functional_interviews"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)          # the interviewed local entity
    participant_name: Mapped[str] = mapped_column(Text, nullable=False)
    participant_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    participant_role: Mapped[str | None] = mapped_column(Text, nullable=True)   # §15 role_category
    transaction_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # §14 transaction(s) covered
    fiscal_period: Mapped[str | None] = mapped_column(Text, nullable=True)      # §14/§48
    interview_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # §53: not_started | in_progress | completed | completed_with_gaps
    status: Mapped[str] = mapped_column(Text, nullable=False, default="not_started")
    created_by: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list[InterviewQuestion]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="InterviewQuestion.sequence"
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    interview_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("functional_interviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_key: Mapped[str] = mapped_column(Text, nullable=False)             # controlled question-module key (§16)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_category: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parent_question_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="SET NULL"), nullable=True   # follow-ups (§17)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    responses: Mapped[list[InterviewResponse]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="InterviewResponse.created_at"
    )


class InterviewResponse(Base):
    """A raw interview answer. `response_raw` is immutable evidence (§18); structured facts derive from it in S5."""

    __tablename__ = "interview_responses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    response_raw: Mapped[str] = mapped_column(Text, nullable=False)             # immutable (§18)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    locator: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrgRole(Base):
    """A key role + reporting line from an org chart (Class 2 §24-25). SCOPED supporting evidence only — org
    charts support but never PROVE risk control (§25); S9/S10 weight this below interviews (§31)."""

    __tablename__ = "org_roles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True   # source org-chart doc, if any
    )
    person_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    department: Mapped[str | None] = mapped_column(Text, nullable=True)
    reports_to_role_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("org_roles.id", ondelete="SET NULL"), nullable=True   # reporting edge (§25)
    )
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    management_level: Mapped[str | None] = mapped_column(Text, nullable=True)
    scope_level: Mapped[str] = mapped_column(Text, nullable=False, default="local_entity")  # §47
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RiskControlProfile(Base):
    """Per (transaction, risk) control record (Class 2 §11-12, §40): who bears the risk contractually, who is
    economically exposed, who decides, who controls it, who is capable, and who has financial capacity — with a
    deterministic mismatch status. Conflicts are PRESERVED (§32), not auto-resolved. Entity ids are opaque."""

    __tablename__ = "risk_control_profiles"
    __table_args__ = (
        UniqueConstraint("engagement_id", "transaction_id", "risk_type", name="uq_risk_control_profile"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transaction_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    risk_type: Mapped[str] = mapped_column(Text, nullable=False)
    contractual_bearer_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    exposed_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_maker_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    control_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    capability_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    financial_capacity_entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="undetermined")  # aligned|potential_mismatch|undetermined
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinancialDataset(Base):
    """A structured financial dataset (Class 3 §10) parsed from one uploaded file/sheet. The raw uploaded
    Document stays immutable (§9); rows are the normalized layer and preserve their original cells in `raw`."""

    __tablename__ = "financial_datasets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True
    )
    entity_id: Mapped[str | None] = mapped_column(Text, nullable=True)   # opaque entity id/label (§5 resolution = follow-on)
    dataset_type: Mapped[str] = mapped_column(Text, nullable=False)      # trial_balance|general_ledger|segmented_pl|...
    source_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_sheet: Mapped[str | None] = mapped_column(Text, nullable=True)
    period: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    columns: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)   # detected header columns (raw)
    column_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)    # effective {canonical_field: header} (S3)
    diagnostics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)       # validation summary (S4, §15)
    schema_version: Mapped[str] = mapped_column(Text, nullable=False, default="1")
    status: Mapped[str] = mapped_column(Text, nullable=False, default="ready")   # §64 lifecycle (v1: ready)
    row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinancialRow(Base):
    """A canonical financial row (§11). Immutable normalized layer — the original cells are preserved in `raw`;
    later adjustments live in separate rows (§9,§20), never as edits here. Bulk-inserted (no per-row ORM, §73)."""

    __tablename__ = "financial_rows"
    __table_args__ = (Index("ix_financial_rows_dataset", "dataset_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    dataset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("financial_datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    row_index: Mapped[int] = mapped_column(Integer, nullable=False)      # source row number (provenance, §9)
    account_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    account_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric, nullable=True)  # parsed; null if unparseable (S4 diagnoses)
    currency: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_center: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_unit: Mapped[str | None] = mapped_column(Text, nullable=True)
    counterparty: Mapped[str | None] = mapped_column(Text, nullable=True)
    period: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_locator: Mapped[str] = mapped_column(Text, nullable=False)    # "<sheet>!Row <n>" (§11)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # original cells by header — immutable (§9)
    issues: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # validation issue codes (S4, §15)


class FinancialColumnMapping(Base):
    """A saved, versioned column mapping (Class 3 §14) keyed by user + header signature, so a repeat engagement
    with the same source format reuses last time's mapping. Stores {canonical_field: source_header}."""

    __tablename__ = "financial_column_mappings"
    __table_args__ = (Index("ix_financial_column_mappings_lookup", "user_id", "signature"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(nullable=False)     # the practitioner/firm that owns the mapping
    signature: Mapped[str] = mapped_column(Text, nullable=False)   # header_signature(headers)
    label: Mapped[str | None] = mapped_column(Text, nullable=True)
    mapping: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Seed data for the connector registry (all available, none wired yet).
CONNECTOR_SEED: list[dict] = [
    {"provider": "sap", "display_name": "SAP", "category": ConnectorCategory.accounting},
    {"provider": "oracle", "display_name": "Oracle", "category": ConnectorCategory.accounting},
    {"provider": "netsuite", "display_name": "NetSuite", "category": ConnectorCategory.accounting},
    {"provider": "quickbooks", "display_name": "QuickBooks", "category": ConnectorCategory.accounting},
    {"provider": "xero", "display_name": "Xero", "category": ConnectorCategory.accounting},
    {"provider": "fireflies", "display_name": "Fireflies", "category": ConnectorCategory.notetaker},
    {"provider": "otter", "display_name": "Otter", "category": ConnectorCategory.notetaker},
    {"provider": "granola", "display_name": "Granola", "category": ConnectorCategory.notetaker},
]
