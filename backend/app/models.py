from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
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
    entity_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    assessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    evidence: Mapped[list[CoverageEvidence]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    supplements: Mapped[list[CoverageSupplement]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="CoverageSupplement.created_at"
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
    model: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
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
