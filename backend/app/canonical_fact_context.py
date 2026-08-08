from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .corpus import usable_source_filter
from .matching import ClassifiedDoc
from .models import (
    CanonicalFact,
    CanonicalFactSource,
    Document,
    DocumentClassification,
    DocumentScope,
    ExtractedFact,
    ExtractionRun,
    Source,
)

CLASSIFICATION_TO_MATCH_TYPE = {
    "Benchmark Study": "benchmark_study",
    "General Ledger": "ledger",
    "Invoice Population": "invoice",
    "Service Agreement": "executed_agreement",
    "Distribution Agreement": "executed_agreement",
    "Manufacturing Agreement": "executed_agreement",
    "License Agreement": "executed_agreement",
    "Loan Agreement": "executed_agreement",
    "Cost Sharing Agreement": "executed_agreement",
}

FACT_TYPE_TO_MATCH_TYPE = {
    "benchmark_range": "benchmark_study",
    "tested_party": "benchmark_study",
    "gl_account": "ledger",
    "transaction_amount": "ledger",
    "invoice_amount": "invoice",
    "invoice_number": "invoice",
}


async def canonical_fact_docs(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    jurisdiction: str,
) -> list[ClassifiedDoc]:
    rows = (
        await session.execute(
            select(CanonicalFact, ExtractedFact, ExtractionRun, Document)
            .join(CanonicalFactSource, CanonicalFactSource.canonical_fact_id == CanonicalFact.id)
            .join(ExtractedFact, ExtractedFact.id == CanonicalFactSource.extracted_fact_id)
            .join(ExtractionRun, ExtractionRun.id == ExtractedFact.extraction_run_id)
            .join(Document, Document.id == ExtractedFact.document_id)
            .join(Source, Source.id == Document.source_id)
            .outerjoin(DocumentClassification, DocumentClassification.document_id == Document.id)
            .where(
                CanonicalFact.engagement_id == engagement_id,
                CanonicalFact.active.is_(True),
                ExtractionRun.active.is_(True),
                usable_source_filter(),
                ExtractedFact.resolution_status.not_in(["unresolved", "failed"]),
            )
            .order_by(Document.created_at, CanonicalFact.created_at)
        )
    ).all()
    docs: list[ClassifiedDoc] = []
    seen: set[tuple[uuid.UUID, str]] = set()
    for canonical, fact, run, doc in rows:
        match_type = CLASSIFICATION_TO_MATCH_TYPE.get(run.classification_type) or FACT_TYPE_TO_MATCH_TYPE.get(
            canonical.fact_type
        )
        if match_type is None:
            continue
        key = (doc.id, match_type)
        if key in seen:
            continue
        seen.add(key)
        docs.append(
            ClassifiedDoc(
                document_id=doc.id,
                document_type=match_type,
                jurisdiction=None,
                fiscal_year=canonical.period,
            )
        )
    return docs


async def classification_backed_docs(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    jurisdiction: str,
) -> list[ClassifiedDoc]:
    """Classified documents (e.g. executed agreements) that carry no extracted fact but still count as
    evidence. Complements canonical_fact_docs, which covers fact-bearing types (invoice/ledger/benchmark)."""
    rows = (
        await session.execute(
            select(DocumentClassification, DocumentScope, Document)
            .join(Document, Document.id == DocumentClassification.document_id)
            .join(Source, Source.id == Document.source_id)
            .join(DocumentScope, DocumentScope.document_id == DocumentClassification.document_id)
            .where(Source.engagement_id == engagement_id, usable_source_filter())
            .order_by(Document.created_at)
        )
    ).all()
    docs: list[ClassifiedDoc] = []
    seen: set[tuple[uuid.UUID, str]] = set()
    for classification, scope, doc in rows:
        match_type = CLASSIFICATION_TO_MATCH_TYPE.get(classification.document_type)
        if match_type is None:
            continue
        key = (doc.id, match_type)
        if key in seen:
            continue
        seen.add(key)
        docs.append(
            ClassifiedDoc(
                document_id=doc.id,
                document_type=match_type,
                jurisdiction=scope.jurisdiction,
                entity=scope.entity,
                fiscal_year=scope.fiscal_year,
                executed=(scope.document_status or "").strip().lower() == "executed",
            )
        )
    return docs
