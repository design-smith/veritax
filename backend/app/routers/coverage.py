from __future__ import annotations

import asyncio
import gc
import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from sqlalchemy import delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ..assessment import Assessor
from ..auth import AuthUser
from ..classification_store import load_classification, scope_fingerprint, store_classification
from ..config import settings
from ..coverage_readiness import draft_readiness_for_rows
from ..corpus import (
    ASSESS_K,
    context_chars,
    document_filename_map,
    retrieve_documents,
    union_docs,
)
from ..diagnostics import rss_mb
from ..document_classifier import CLASSIFIER_VERSION, classify_document_bytes, unknown_classification
from ..evidence_quality import assessment_scope_instruction, scoped_query
from ..deps import (
    assert_owner,
    get_current_user,
    get_embedder,
    get_session,
    get_session_factory,
    get_storage,
    require_engagement_owner,
)
from ..embeddings import Embedder
from ..extraction_eligibility import extraction_eligibility
from ..extraction_jobs import queue_extraction_jobs_for_engagement
from ..ingest import embed_document, get_or_create_uploaded_source, store_upload
from ..jobs import enqueue_index_document_job, enqueue_pipeline_job, schedule_pipeline_drain
from ..models import (
    Confidence,
    CoverageEvidence,
    CoverageStatus,
    CoverageSupplement,
    Document,
    DocumentClassification,
    DocumentRelevance,
    DocumentScope,
    DocumentStatus,
    DraftCitation,
    DraftSection,
    DraftStatus,
    Engagement,
    EngagementJurisdiction,
    Entity,
    PipelineJobKind,
    RequirementCoverage,
    Source,
    SourceKind,
    SourceOrigin,
    SupplementKind,
)
from ..requirements import available_jurisdictions, resolve_requirements
from ..schemas import CoverageEvidenceRead, CoverageRead, CoverageResponse, CoverageSummary, SkippedDocumentRead
from ..storage import Storage

router = APIRouter(tags=["coverage"])
log = logging.getLogger("veritax")


# ── Read helpers ─────────────────────────────────────────────────────────────
async def _doc_kind(session: AsyncSession, engagement_id: uuid.UUID) -> dict[uuid.UUID, str]:
    """document_id -> source kind, for deriving the requirement's source chips from its evidence."""
    rows = (
        await session.execute(
            select(Document.id, Source.kind)
            .join(Source, Source.id == Document.source_id)
            .where(Source.engagement_id == engagement_id)
        )
    ).all()
    return {did: kind.value for did, kind in rows}


def _to_read(row: RequirementCoverage, doc_kind: dict[uuid.UUID, str],
             section_by_key: dict[str, uuid.UUID]) -> CoverageRead:
    kinds = sorted({doc_kind.get(e.document_id, "?") for e in row.evidence if e.document_id})
    return CoverageRead(
        id=row.id,
        requirement_key=row.requirement_key,
        element_order=row.element_order,
        element_name=row.element_name,
        element_description=row.element_description,
        is_conditional=row.is_conditional,
        verified=row.verified,
        status=row.status,
        whats_present=row.whats_present,
        whats_missing=row.whats_missing,
        confidence=row.confidence,
        error=row.error,
        sources_used=kinds,
        evidence=[
            CoverageEvidenceRead(document_id=e.document_id, source_label=e.source_label, locator=e.locator)
            for e in row.evidence
        ],
        draft_section_id=section_by_key.get(row.requirement_key),
    )


def _summary(rows: list[RequirementCoverage]) -> CoverageSummary:
    def n(status: CoverageStatus) -> int:
        return sum(1 for r in rows if r.status == status)

    present, partial, missing = n(CoverageStatus.present), n(CoverageStatus.partial), n(CoverageStatus.missing)
    conditional, pending, failed = n(CoverageStatus.conditional), n(CoverageStatus.pending), n(CoverageStatus.failed)
    readiness = draft_readiness_for_rows(rows)
    return CoverageSummary(
        total=len(rows),
        required_total=sum(1 for r in rows if not r.is_conditional),
        present=present,
        partial=partial,
        missing=missing,
        conditional=conditional,
        pending=pending,
        failed=failed,
        need_attention=partial + missing,
        draft_ready=readiness.ready,
        draft_blocker=readiness.blocker,
        present_ratio=readiness.present_ratio,
        draft_min_present_ratio=readiness.min_present_ratio,
    )


async def _load_rows(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> list[RequirementCoverage]:
    return list(
        (
            await session.execute(
                select(RequirementCoverage)
                .where(
                    RequirementCoverage.engagement_id == engagement_id,
                    RequirementCoverage.jurisdiction == jurisdiction,
                )
                .order_by(RequirementCoverage.element_order)
            )
        ).scalars()
    )


async def _draft_section_by_key(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> dict[str, uuid.UUID]:
    """requirement_key -> drafted section id, so a covered requirement links into the draft."""
    rows = (
        await session.execute(
            select(DraftSection.requirement_key, DraftSection.id).where(
                DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction
            )
        )
    ).all()
    return {rk: sid for rk, sid in rows}


def _skip_reason(validation: dict, *, entity_name: str | None, jurisdictions: list[str], fiscal_year: str | None) -> str:
    if validation.get("entity") == "fail" and entity_name:
        return f"Entity does not match {entity_name}."
    if validation.get("fiscal_year") == "fail" and fiscal_year:
        return f"Fiscal year does not match {fiscal_year}."
    if validation.get("jurisdiction") == "fail" and jurisdictions:
        return f"Jurisdiction does not match {', '.join(jurisdictions)}."
    return "Document appears outside this engagement scope."


async def _skipped_documents(session: AsyncSession, engagement_id: uuid.UUID) -> list[SkippedDocumentRead]:
    entity_name, jurisdictions, fiscal_year = await _engagement_scope(session, engagement_id)
    rows = (
        await session.execute(
            select(
                Document.id,
                Document.original_filename,
                DocumentScope.source_validation_result,
            )
            .join(Source, Source.id == Document.source_id)
            .join(DocumentClassification, DocumentClassification.document_id == Document.id)
            .join(DocumentScope, DocumentScope.document_id == Document.id)
            .where(
                Source.engagement_id == engagement_id,
                Source.kind != SourceKind.supplement,
                DocumentClassification.relevance == DocumentRelevance.out_of_scope,
            )
            .order_by(Document.created_at)
        )
    ).all()
    return [
        SkippedDocumentRead(
            document_id=row.id,
            filename=row.original_filename,
            reason=_skip_reason(
                row.source_validation_result or {},
                entity_name=entity_name,
                jurisdictions=jurisdictions,
                fiscal_year=fiscal_year,
            ),
        )
        for row in rows
    ]


async def _invalidate_drafts_for_element(session: AsyncSession, row: RequirementCoverage) -> list[str]:
    sections = (
        await session.execute(
            select(DraftSection).where(
                DraftSection.engagement_id == row.engagement_id,
                DraftSection.element_name == row.element_name,
                DraftSection.element_order == row.element_order,
                DraftSection.status.in_([DraftStatus.drafted, DraftStatus.failed]),
            )
        )
    ).scalars().all()
    if not sections:
        return []
    now = datetime.now(timezone.utc)
    section_ids = [section.id for section in sections]
    await session.execute(delete(DraftCitation).where(DraftCitation.section_id.in_(section_ids)))
    for section in sections:
        section.status = DraftStatus.pending
        section.status_updated_at = now
        section.content = None
        section.error = None
    return sorted({section.jurisdiction for section in sections})


async def _response(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> CoverageResponse:
    rows = await _load_rows(session, engagement_id, jurisdiction)
    doc_kind = await _doc_kind(session, engagement_id)
    section_by_key = await _draft_section_by_key(session, engagement_id, jurisdiction)
    return CoverageResponse(
        jurisdiction=jurisdiction,
        summary=_summary(rows),
        requirements=[_to_read(r, doc_kind, section_by_key) for r in rows],
        skipped_documents=await _skipped_documents(session, engagement_id),
    )


# ── Assessment loop (retrieves the matched chunks per element) ────────────────
async def _write_evidence(session: AsyncSession, coverage_id: uuid.UUID, evidence,
                          fname_to_docid: dict[str, str]) -> None:
    """Replace a requirement's provenance pointers (document + locator), de-duped."""
    await session.execute(delete(CoverageEvidence).where(CoverageEvidence.coverage_id == coverage_id))
    seen: set = set()
    for ev in evidence:
        docid = fname_to_docid.get(ev.source_filename)
        key = (docid, ev.locator)
        if key in seen:
            continue
        seen.add(key)
        session.add(CoverageEvidence(
            coverage_id=coverage_id,
            document_id=uuid.UUID(docid) if docid else None,
            source_label=ev.source_filename,
            locator=ev.locator,
        ))


# ── Cross-jurisdiction dedup: reuse a byte-identical element already assessed in this engagement ──
def _locator_snippet(text: str, fallback: str) -> str:
    value = " ".join(text.split())
    if not value:
        return fallback
    return value[:177] + "..." if len(value) > 180 else value


async def _mark_present(
    session: AsyncSession,
    row: RequirementCoverage,
    *,
    source_label: str,
    locator: str,
    document_id: uuid.UUID | None = None,
    whats_present: str | None = None,
) -> None:
    row.status = CoverageStatus.present
    row.whats_present = whats_present or "Marked satisfied by user."
    row.whats_missing = None
    row.confidence = Confidence.high
    row.error = None
    row.status_updated_at = datetime.now(timezone.utc)
    row.assessed_at = datetime.now(timezone.utc)
    await session.execute(delete(CoverageEvidence).where(CoverageEvidence.coverage_id == row.id))
    session.add(
        CoverageEvidence(
            coverage_id=row.id,
            document_id=document_id,
            source_label=source_label,
            locator=locator,
        )
    )


async def _restart_draft_if_needed(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    jurisdictions: list[str],
) -> int:
    if not jurisdictions:
        return 0
    for jurisdiction in jurisdictions:
        await enqueue_pipeline_job(
            session,
            engagement_id=engagement_id,
            kind=PipelineJobKind.draft_jurisdiction,
            dedupe_key=f"draft_jurisdiction:{engagement_id}:{jurisdiction}",
            payload={"jurisdiction": jurisdiction},
            restart=True,
        )
    return len(jurisdictions)


async def _engagement_scope(session: AsyncSession, engagement_id: uuid.UUID) -> tuple[str | None, list[str], str | None]:
    row = (
        await session.execute(
            select(Entity.name, Engagement.fiscal_year)
            .select_from(Engagement)
            .outerjoin(Entity, Entity.id == Engagement.entity_id)
            .where(Engagement.id == engagement_id)
        )
    ).one_or_none()
    if row is None:
        return None, [], None
    jurisdictions = (
        await session.execute(
            select(EngagementJurisdiction.jurisdiction)
            .where(EngagementJurisdiction.engagement_id == engagement_id)
            .order_by(EngagementJurisdiction.jurisdiction)
        )
    ).scalars().all()
    return row.name, list(jurisdictions), row.fiscal_year


async def _classify_uploaded_documents(
    session: AsyncSession,
    storage: Storage,
    engagement_id: uuid.UUID,
    llm_fallback=None,
) -> int:
    entity_name, jurisdictions, fiscal_year = await _engagement_scope(session, engagement_id)
    docs = (
        await session.execute(
            select(Document)
            .join(Source, Source.id == Document.source_id)
            .where(
                Source.engagement_id == engagement_id,
                Source.origin == SourceOrigin.uploaded,
                Source.kind != SourceKind.supplement,
                Source.kind != SourceKind.interview,
            )
            .order_by(Document.created_at)
        )
    ).scalars().all()
    classified = 0
    for doc in docs:
        if await _classify_document_with_scope(
            session,
            storage,
            doc,
            entity_name=entity_name,
            jurisdictions=jurisdictions,
            fiscal_year=fiscal_year,
            llm_fallback=llm_fallback,
        ):
            classified += 1
    return classified


async def _classify_document_with_scope(
    session: AsyncSession,
    storage: Storage,
    doc: Document,
    *,
    entity_name: str | None,
    jurisdictions: list[str],
    fiscal_year: str | None,
    llm_fallback=None,
) -> bool:
    t0 = time.monotonic()
    fingerprint = scope_fingerprint(
        document_hash=doc.content_hash,
        entity_name=entity_name,
        jurisdictions=jurisdictions,
        fiscal_year=fiscal_year,
        classifier_version=CLASSIFIER_VERSION,
    )
    existing = await load_classification(session, doc.id)
    if existing is not None and existing.scope_fingerprint == fingerprint:
        return False
    try:
        data = await asyncio.to_thread(storage.get, doc.storage_key)
        result = await asyncio.to_thread(
            classify_document_bytes,
            filename=doc.original_filename,
            content_type=doc.content_type,
            content_hash=doc.content_hash,
            data=data,
            entity_name=entity_name,
            jurisdictions=jurisdictions,
            fiscal_year=fiscal_year,
            llm_fallback=llm_fallback,
        )
    except Exception as exc:  # noqa: BLE001 - classification degrades; Requirements still runs
        log.exception("classify FAILED doc=%s file=%s", doc.id, doc.original_filename)
        result = unknown_classification(
            filename=doc.original_filename,
            content_hash=doc.content_hash,
            entity_name=entity_name,
            jurisdictions=jurisdictions,
            fiscal_year=fiscal_year,
            error=str(exc),
        )
    await store_classification(session, doc.id, result)
    log.info(
        "classify doc=%s classifier_version=%s taxonomy_version=%s type=%s relevance=%s state=%s score=%s elapsed=%.1fs",
        doc.id,
        result.classifier_version,
        result.taxonomy_version,
        result.document_type,
        result.relevance,
        result.classification_state,
        result.classification_score,
        time.monotonic() - t0,
    )
    return True


async def _supplement_extraction_eligibility(session: AsyncSession, doc: Document):
    classification = await load_classification(session, doc.id)
    if classification is None:
        return None
    return extraction_eligibility(
        document_type=classification.document_type,
        classification_state=getattr(classification.classification_state, "value", classification.classification_state),
        relevance=getattr(classification.relevance, "value", classification.relevance),
        source_validation_result=classification.scope.source_validation_result,
        document_active=doc.is_active,
    )


async def _queue_uploaded_documents(session: AsyncSession, engagement_id: uuid.UUID) -> int:
    docs = (
        await session.execute(
            select(Document)
            .join(Source, Source.id == Document.source_id)
            .outerjoin(DocumentClassification, DocumentClassification.document_id == Document.id)
            .where(
                Source.engagement_id == engagement_id,
                Document.status == DocumentStatus.uploaded,
                or_(
                    Source.kind == SourceKind.supplement,
                    DocumentClassification.document_id.is_(None),
                    DocumentClassification.relevance != DocumentRelevance.out_of_scope,
                ),
            )
            .order_by(Document.created_at)
        )
    ).scalars().all()
    for doc in docs:
        await enqueue_index_document_job(session, doc)
    return len(docs)


async def _find_assessed_twin(session: AsyncSession, engagement_id: uuid.UUID, element) -> RequirementCoverage | None:
    return None
    """A completed assessment of the same element elsewhere in this engagement. Shared base templates
    give jurisdictions byte-identical (name, description) elements, so the verdict is the same over the
    same documents — reuse it instead of paying the LLM again (and keep the files consistent)."""
    return (
        await session.execute(
            select(RequirementCoverage)
            .where(
                RequirementCoverage.engagement_id == engagement_id,
                RequirementCoverage.element_name == element.element_name,
                RequirementCoverage.element_description == element.description,
                RequirementCoverage.status.in_(
                    [CoverageStatus.present, CoverageStatus.partial, CoverageStatus.missing]
                ),
            )
            .options(selectinload(RequirementCoverage.evidence))
            .limit(1)
        )
    ).scalar_one_or_none()


async def _copy_assessment(session: AsyncSession, target_id: uuid.UUID, twin: RequirementCoverage) -> None:
    row = await session.get(RequirementCoverage, target_id)
    if row is None:
        return
    row.status = twin.status
    row.whats_present = twin.whats_present
    row.whats_missing = twin.whats_missing
    row.confidence = twin.confidence
    row.error = None
    row.status_updated_at = datetime.now(timezone.utc)
    row.assessed_at = datetime.now(timezone.utc)
    await session.execute(delete(CoverageEvidence).where(CoverageEvidence.coverage_id == target_id))
    for e in twin.evidence:
        session.add(CoverageEvidence(
            coverage_id=target_id, document_id=e.document_id, source_label=e.source_label, locator=e.locator,
        ))


async def _assess_group(session_factory: async_sessionmaker, assessor: Assessor, elements: dict,
                        docs_by_key: dict, retrieval_error: str | None, fname_to_docid: dict[str, str],
                        group: list[tuple[uuid.UUID, str]], entity_name: str | None, jurisdiction: str) -> None:
    """Assess one batch in a single LLM call over the UNION of its elements' chunks, then write + commit
    all rows together (the UI reveals the batch at once). One bad batch fails only its own rows."""
    els = [elements[rk] for _, rk in group]
    results: dict = {}
    err: Exception | None = None
    if retrieval_error is not None:
        err = RuntimeError(f"context retrieval failed: {retrieval_error}")
    else:
        shared = union_docs([docs_by_key.get(rk, []) for _, rk in group])
        try:
            scope_notes = {
                i: assessment_scope_instruction(el, entity_name=entity_name, jurisdiction=jurisdiction)
                for i, el in enumerate(els, 1)
            }
            results = await asyncio.to_thread(assessor.assess_batch, els, shared, scope_notes)
        except Exception as exc:  # noqa: BLE001 - whole batch failed; mark its rows, keep the run going
            err = exc
            log.exception("assess_batch FAILED for %d element(s)", len(els))
    async with session_factory() as s:
        for i, (rid, _rk) in enumerate(group, 1):  # element_number is 1-based position in the group
            row = await s.get(RequirementCoverage, rid)
            if row is None:
                continue
            result = None if err is not None else results.get(i)
            try:
                if err is not None:
                    row.status, row.error = CoverageStatus.failed, str(err)[:1000]
                    row.status_updated_at = datetime.now(timezone.utc)
                elif result is None:
                    row.status, row.error = CoverageStatus.failed, "no assessment returned for this element"
                    row.status_updated_at = datetime.now(timezone.utc)
                else:
                    row.status = CoverageStatus(result.status)
                    row.whats_present = result.whats_present or None
                    row.whats_missing = result.whats_missing or None
                    row.confidence = Confidence(result.confidence)
                    row.error = None
                    row.status_updated_at = datetime.now(timezone.utc)
                    row.assessed_at = datetime.now(timezone.utc)
                    await _write_evidence(s, row.id, result.evidence, fname_to_docid)
            except Exception:  # noqa: BLE001 - one row's write error can't sink the rest of the batch
                log.exception("assess write FAILED for '%s'", row.element_name)
                row.status, row.error = CoverageStatus.failed, "assessment write error"
                row.status_updated_at = datetime.now(timezone.utc)
        await s.commit()


async def _apply(session: AsyncSession, row: RequirementCoverage, element, documents, assessor: Assessor,
                 fname_to_docid: dict[str, str]) -> None:
    try:
        result = await asyncio.to_thread(assessor.assess, element, documents)
        row.status = CoverageStatus(result.status)
        row.whats_present = result.whats_present or None
        row.whats_missing = result.whats_missing or None
        row.confidence = Confidence(result.confidence)
        row.error = None
        row.status_updated_at = datetime.now(timezone.utc)
        row.assessed_at = datetime.now(timezone.utc)
        await _write_evidence(session, row.id, result.evidence, fname_to_docid)
    except Exception as exc:  # noqa: BLE001 - record failure per row, keep the loop going
        log.exception("assess FAILED for '%s': %s", row.element_name, exc)
        row.status = CoverageStatus.failed
        row.status_updated_at = datetime.now(timezone.utc)
        row.error = str(exc)[:1000]


async def _mark_pending_failed(session_factory: async_sessionmaker, engagement_id: uuid.UUID,
                               jurisdiction: str, error: str) -> None:
    async with session_factory() as session:
        rows = (
            await session.execute(
                select(RequirementCoverage).where(
                    RequirementCoverage.engagement_id == engagement_id,
                    RequirementCoverage.jurisdiction == jurisdiction,
                    RequirementCoverage.status == CoverageStatus.pending,
                )
            )
        ).scalars().all()
        for row in rows:
            row.status = CoverageStatus.failed
            row.status_updated_at = datetime.now(timezone.utc)
            row.error = error[:1000]
        await session.commit()


async def run_assessment(session_factory: async_sessionmaker, assessor: Assessor, embedder: Embedder,
                         engagement_id: uuid.UUID, jurisdiction: str) -> None:
    """Background job. Two passes over the pending rows:

    1. Cross-jurisdiction dedup — an element already assessed elsewhere in the engagement (shared base
       templates) is copied, no LLM call, revealed immediately.
    2. The rest are assessed in batches of ASSESS_BATCH_SIZE, each a single LLM call over the union of
       the batch's retrieved chunks (context sent once, not per element), committed per batch so the UI
       still reveals progressively. Batch size 1 == the old strict one-call-per-element behaviour.
    """
    log.info("run_assessment START engagement=%s jurisdiction=%s assessor=%s",
             engagement_id, jurisdiction, type(assessor).__name__)
    t0 = time.monotonic()
    try:
        elements = {e.requirement_key: e for e in resolve_requirements(jurisdiction)}
        # ── Pass 1: setup, cross-jurisdiction dedup, retrieval for the remainder ──
        async with session_factory() as session:
            fname_to_docid = await document_filename_map(session, engagement_id)
            engagement = await session.get(Engagement, engagement_id)
            entity_name = engagement.entity.name if engagement and engagement.entity else None
            pending = (
                await session.execute(
                    select(RequirementCoverage.id, RequirementCoverage.requirement_key).where(
                        RequirementCoverage.engagement_id == engagement_id,
                        RequirementCoverage.jurisdiction == jurisdiction,
                        RequirementCoverage.status == CoverageStatus.pending,
                    ).order_by(RequirementCoverage.element_order)  # process (and reveal) in order
                )
            ).all()
            uncached: list[tuple[uuid.UUID, str]] = []
            reused = 0
            for rid, rk in pending:
                element = elements.get(rk)
                if element is None:
                    row = await session.get(RequirementCoverage, rid)
                    if row is not None:
                        row.status, row.error = CoverageStatus.failed, "requirement not found in seed"
                        row.status_updated_at = datetime.now(timezone.utc)
                    await session.commit()
                    continue
                twin = await _find_assessed_twin(session, engagement_id, element)
                if twin is not None and twin.id != rid:
                    await _copy_assessment(session, rid, twin)
                    await session.commit()  # reveal the reused verdict immediately
                    reused += 1
                else:
                    uncached.append((rid, rk))
            # Context is retrieved per batch below so Render does not hold every section's source text.

        batch_size = 1
        log.info("run_assessment: %d reused from twin, %d to assess in batches of %d",
                 reused, len(uncached), batch_size)

        # ── Pass 2: batched assessment of the uncached rows (committed per batch = progressive reveal) ──
        for start in range(0, len(uncached), batch_size):
            group = uncached[start:start + batch_size]
            docs_by_key: dict = {}
            retrieval_error: str | None = None
            try:
                async with session_factory() as retrieval_session:
                    for _rid, rk in group:
                        docs = await retrieve_documents(
                            retrieval_session,
                            engagement_id,
                            embedder,
                            scoped_query(elements[rk], entity_name=entity_name, jurisdiction=jurisdiction),
                            k=ASSESS_K,
                        )
                        docs_by_key[rk] = docs
                    log.info(
                        "run_assessment: context ready rows=%d docs=%d context_chars=%d rss=%s",
                        len(group),
                        sum(len(docs) for docs in docs_by_key.values()),
                        sum(context_chars(docs) for docs in docs_by_key.values()),
                        rss_mb(),
                    )
            except Exception as exc:  # noqa: BLE001 - embedding provider down/rate-limited: fail rows cleanly
                retrieval_error = str(exc)[:500]
                log.exception("run_assessment: context retrieval FAILED for %d row(s)", len(group))
            await _assess_group(session_factory, assessor, elements, docs_by_key,
                                retrieval_error, fname_to_docid, group, entity_name, jurisdiction)
            docs_by_key.clear()
            gc.collect()
        log.info("run_assessment DONE engagement=%s jurisdiction=%s in %.1fs",
                 engagement_id, jurisdiction, time.monotonic() - t0)
    except Exception:
        # A crash here (setup/retrieval) would otherwise leave rows stuck 'pending' silently.
        log.exception("run_assessment CRASHED engagement=%s jurisdiction=%s after %.1fs",
                      engagement_id, jurisdiction, time.monotonic() - t0)
        await _mark_pending_failed(session_factory, engagement_id, jurisdiction, "assessment job crashed")


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/engagements/{engagement_id}/coverage", response_model=CoverageResponse, status_code=201)
async def start_coverage(
    engagement_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    jurisdiction: str = Query(...),
    force: bool = Query(False),  # user hit "refresh": re-run matching against the current corpus
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    _owner: Engagement = Depends(require_engagement_owner),
) -> CoverageResponse:
    elements = resolve_requirements(jurisdiction)
    if not elements:
        raise HTTPException(status_code=404, detail=f"no requirements defined for '{jurisdiction}'")

    # Force re-run: reset this jurisdiction's assessed rows back to pending so run_assessment
    # re-evaluates every requirement against whatever changed in planning (sources, entity).
    # ponytail: reuses a cross-jurisdiction twin if another jurisdiction is still assessed;
    #           re-run those too if stale-twin reuse ever matters.
    if force:
        await session.execute(
            update(RequirementCoverage)
            .where(
                RequirementCoverage.engagement_id == engagement_id,
                RequirementCoverage.jurisdiction == jurisdiction,
                RequirementCoverage.is_conditional.is_(False),
            )
            .values(status=CoverageStatus.pending, error=None,
                    status_updated_at=datetime.now(timezone.utc))
        )
        await session.commit()

    # Idempotent + race-safe: the frontend effect (React StrictMode) can fire two POSTs at once.
    # ON CONFLICT DO NOTHING lets both land without a unique-violation; rowcount tells us who
    # actually inserted, so only that request kicks off the assessment job.
    rows = [
        {
            "id": uuid.uuid4(),
            "engagement_id": engagement_id,
            "jurisdiction": jurisdiction,
            "requirement_key": e.requirement_key,
            "element_order": e.order,
            "element_name": e.element_name,
            "element_description": e.description,
            "is_conditional": not e.required,
            "verified": e.verified,
            # Conditional (required:false) elements aren't flagged missing — no trigger evaluated.
            "status": CoverageStatus.pending if e.required else CoverageStatus.conditional,
            "status_updated_at": datetime.now(timezone.utc),
        }
        for e in elements
    ]
    stmt = pg_insert(RequirementCoverage).values(rows).on_conflict_do_nothing(
        index_elements=["engagement_id", "jurisdiction", "requirement_key"]
    )
    result = await session.execute(stmt)

    inserted = result.rowcount or 0
    should_assess = inserted > 0 or force
    classified_documents = (
        await _classify_uploaded_documents(
            session,
            storage,
            engagement_id,
            getattr(request.app.state, "classification_fallback", None),
        )
        if should_assess else 0
    )
    queued_documents = await _queue_uploaded_documents(session, engagement_id) if should_assess else 0
    queued_extractions = (
        await queue_extraction_jobs_for_engagement(session, engagement_id, restart=force)
        if should_assess else 0
    )
    if should_assess:
        await enqueue_pipeline_job(
            session,
            engagement_id=engagement_id,
            kind=PipelineJobKind.assess_requirements,
            dedupe_key=f"assess_requirements:{engagement_id}:{jurisdiction}",
            payload={"jurisdiction": jurisdiction},
            restart=force,
        )
    await session.commit()
    log.info("start_coverage engagement=%s jurisdiction=%s force=%s: %d new row(s), classified_documents=%d, queued_documents=%d, queued_extractions=%d, %s",
             engagement_id, jurisdiction, force, inserted, classified_documents, queued_documents, queued_extractions,
             "queued assessment" if should_assess else "already assessed/queued (no-op)")
    if should_assess:
        schedule_pipeline_drain(background, request.app, max_jobs=queued_documents + queued_extractions + 1)
    return await _response(session, engagement_id, jurisdiction)


@router.get("/jurisdictions")
async def list_jurisdictions() -> list[str]:
    """Countries with a defined requirement list — the single source for the Planning picker."""
    return available_jurisdictions()


@router.get("/engagements/{engagement_id}/coverage", response_model=CoverageResponse)
async def get_coverage(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> CoverageResponse:
    return await _response(session, engagement_id, jurisdiction)


@router.post("/coverage/{coverage_id}/supplements", response_model=CoverageRead, status_code=201)
async def add_supplement(
    coverage_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    kind: SupplementKind = Form(...),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    embedder: Embedder = Depends(get_embedder),
    factory: async_sessionmaker = Depends(get_session_factory),
    user: AuthUser = Depends(get_current_user),
) -> CoverageRead:
    row = await session.get(RequirementCoverage, coverage_id)
    if row is None:
        raise HTTPException(status_code=404, detail="coverage row not found")
    await assert_owner(session, row.engagement_id, user)

    # Supplement material becomes a real corpus Document (so Draft consumes it) under a 'supplement' source.
    src = await get_or_create_uploaded_source(session, row.engagement_id, SourceKind.supplement)
    if kind == SupplementKind.upload:
        if file is None:
            raise HTTPException(status_code=422, detail="file required for an upload supplement")
        data = await file.read()
        filename = file.filename or "supplement"
        content_type = file.content_type
        text_value = None
    else:
        if not (text and text.strip()):
            raise HTTPException(status_code=422, detail="text required for a text supplement")
        data = text.encode("utf-8")
        filename = f"supplement-{row.requirement_key.replace(':', '-')}.txt"
        content_type = "text/plain"
        text_value = text

    doc = await store_upload(session, storage, row.engagement_id, src.id, filename, content_type, data)
    session.add(
        CoverageSupplement(
            coverage_id=row.id,
            kind=kind,
            document_id=doc.id,
            source_context="supplement",
            target_requirement_id=row.id,
            text=text_value,
        )
    )

    queued_extractions = 0
    if kind == SupplementKind.upload:
        entity_name, jurisdictions, fiscal_year = await _engagement_scope(session, row.engagement_id)
        await _classify_document_with_scope(
            session,
            storage,
            doc,
            entity_name=entity_name,
            jurisdictions=jurisdictions,
            fiscal_year=fiscal_year,
            llm_fallback=getattr(request.app.state, "classification_fallback", None),
        )
        eligibility = await _supplement_extraction_eligibility(session, doc)
        if eligibility is None or eligibility.status != "pending":
            doc.extraction_status = eligibility.status if eligibility is not None else "skipped_unknown"
            await session.commit()
            doc_kind = await _doc_kind(session, row.engagement_id)
            section_by_key = await _draft_section_by_key(session, row.engagement_id, row.jurisdiction)
            await session.refresh(row)
            return _to_read(row, doc_kind, section_by_key)
        queued_extractions = await queue_extraction_jobs_for_engagement(session, row.engagement_id)

    await session.commit()
    # Embed accepted supplements INLINE (not background) so Draft can retrieve them immediately.
    await embed_document(factory, storage, embedder, doc.id)

    locator = (
        f"Uploaded supplement: {filename}"
        if kind == SupplementKind.upload
        else _locator_snippet(text or "", "Text supplement added by user")
    )
    await _mark_present(
        session,
        row,
        source_label=filename,
        locator=locator,
        document_id=doc.id,
        whats_present=f"User-supplied supplement satisfies {row.element_name}.",
    )
    redraft_jurisdictions = await _invalidate_drafts_for_element(session, row)
    restarted = await _restart_draft_if_needed(session, row.engagement_id, redraft_jurisdictions)
    await session.commit()
    if restarted:
        schedule_pipeline_drain(background, request.app, max_jobs=restarted)
    if queued_extractions:
        schedule_pipeline_drain(background, request.app, max_jobs=queued_extractions)

    doc_kind = await _doc_kind(session, row.engagement_id)
    section_by_key = await _draft_section_by_key(session, row.engagement_id, row.jurisdiction)
    await session.refresh(row)
    return _to_read(row, doc_kind, section_by_key)


@router.post("/coverage/{coverage_id}/satisfied", response_model=CoverageRead)
async def mark_satisfied(
    coverage_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> CoverageRead:
    row = await session.get(RequirementCoverage, coverage_id)
    if row is None:
        raise HTTPException(status_code=404, detail="coverage row not found")
    await assert_owner(session, row.engagement_id, user)
    if row.is_conditional:
        raise HTTPException(status_code=409, detail="conditional requirement cannot be manually satisfied")

    await _mark_present(
        session,
        row,
        source_label="Manual",
        locator="Marked satisfied by user",
        whats_present=f"User marked {row.element_name} satisfied.",
    )
    redraft_jurisdictions = await _invalidate_drafts_for_element(session, row)
    restarted = await _restart_draft_if_needed(session, row.engagement_id, redraft_jurisdictions)
    await session.commit()
    if restarted:
        schedule_pipeline_drain(background, request.app, max_jobs=restarted)

    doc_kind = await _doc_kind(session, row.engagement_id)
    section_by_key = await _draft_section_by_key(session, row.engagement_id, row.jurisdiction)
    await session.refresh(row)
    return _to_read(row, doc_kind, section_by_key)
