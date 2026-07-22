from __future__ import annotations

import asyncio
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
    UploadFile,
)
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..assessment import Assessor
from ..corpus import document_filename_map, element_query, retrieve_documents, retrieve_documents_batch
from ..deps import get_assessor, get_embedder, get_session, get_session_factory, get_storage
from ..embeddings import Embedder
from ..ingest import embed_document, get_or_create_uploaded_source, store_upload
from ..models import (
    Confidence,
    CoverageEvidence,
    CoverageStatus,
    CoverageSupplement,
    Document,
    DraftSection,
    Engagement,
    RequirementCoverage,
    Source,
    SourceKind,
    SupplementKind,
)
from ..requirements import resolve_requirements
from ..schemas import CoverageEvidenceRead, CoverageRead, CoverageResponse, CoverageSummary
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
    conditional, pending = n(CoverageStatus.conditional), n(CoverageStatus.pending)
    return CoverageSummary(
        total=len(rows),
        required_total=sum(1 for r in rows if not r.is_conditional),
        present=present,
        partial=partial,
        missing=missing,
        conditional=conditional,
        pending=pending,
        need_attention=partial + missing,
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


async def _response(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> CoverageResponse:
    rows = await _load_rows(session, engagement_id, jurisdiction)
    doc_kind = await _doc_kind(session, engagement_id)
    section_by_key = await _draft_section_by_key(session, engagement_id, jurisdiction)
    return CoverageResponse(
        jurisdiction=jurisdiction,
        summary=_summary(rows),
        requirements=[_to_read(r, doc_kind, section_by_key) for r in rows],
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


async def _apply(session: AsyncSession, row: RequirementCoverage, element, documents, assessor: Assessor,
                 fname_to_docid: dict[str, str]) -> None:
    try:
        result = await asyncio.to_thread(assessor.assess, element, documents)
        row.status = CoverageStatus(result.status)
        row.whats_present = result.whats_present or None
        row.whats_missing = result.whats_missing or None
        row.confidence = Confidence(result.confidence)
        row.error = None
        row.assessed_at = datetime.now(timezone.utc)
        await _write_evidence(session, row.id, result.evidence, fname_to_docid)
    except Exception as exc:  # noqa: BLE001 - record failure per row, keep the loop going
        log.exception("assess FAILED for '%s': %s", row.element_name, exc)
        row.status = CoverageStatus.failed
        row.error = str(exc)[:1000]


async def run_assessment(session_factory: async_sessionmaker, assessor: Assessor, embedder: Embedder,
                         engagement_id: uuid.UUID, jurisdiction: str) -> None:
    """Background job: assess pending rows ONE AT A TIME in element order, committing each as it finishes.

    Sequential (not concurrent) on purpose — the UI reveals requirements one-by-one as each is processed,
    so completions must arrive in order. Context is retrieved PER element (the matched chunks), so each
    assessment call stays inside the model window regardless of how large the source documents are.
    """
    log.info("run_assessment START engagement=%s jurisdiction=%s assessor=%s",
             engagement_id, jurisdiction, type(assessor).__name__)
    t0 = time.monotonic()
    try:
        async with session_factory() as session:
            elements = {e.requirement_key: e for e in resolve_requirements(jurisdiction)}
            fname_to_docid = await document_filename_map(session, engagement_id)
            pending = (
                await session.execute(
                    select(RequirementCoverage.id, RequirementCoverage.requirement_key).where(
                        RequirementCoverage.engagement_id == engagement_id,
                        RequirementCoverage.jurisdiction == jurisdiction,
                        RequirementCoverage.status == CoverageStatus.pending,
                    ).order_by(RequirementCoverage.element_order)  # process (and reveal) in order
                )
            ).all()
            # Embed every element's query in ONE call (the rate-limited step), then search per element.
            queries = {rk: element_query(elements[rk]) for _, rk in pending if rk in elements}
            docs_by_key: dict = {}
            retrieval_error: str | None = None
            try:
                docs_by_key = await retrieve_documents_batch(session, engagement_id, embedder, queries)
            except Exception as exc:  # noqa: BLE001 - embedding provider down/rate-limited: fail rows cleanly
                retrieval_error = str(exc)[:500]
                log.exception("run_assessment: query embedding FAILED — all rows will be marked failed")
        log.info("run_assessment: %d pending row(s), assessing one at a time in order", len(pending))

        async def assess_one(row_id: uuid.UUID, req_key: str) -> None:
            # Fully self-contained: any failure marks THIS row failed and never propagates, so one bad
            # row can't stall the sequence (which previously left the rest stuck 'pending').
            try:
                element = elements.get(req_key)
                result, err = None, None
                if element is not None:
                    if retrieval_error is not None:
                        err = RuntimeError(f"context retrieval failed: {retrieval_error}")
                    else:
                        documents = docs_by_key.get(req_key, [])
                        try:
                            result = await asyncio.to_thread(assessor.assess, element, documents)
                        except Exception as exc:  # noqa: BLE001
                            err = exc
                            log.exception("assess FAILED for '%s'", element.element_name)
                async with session_factory() as s:  # own session per row → concurrency-safe + progressive
                    row = await s.get(RequirementCoverage, row_id)
                    if row is None:
                        return
                    if element is None:
                        row.status, row.error = CoverageStatus.failed, "requirement not found in seed"
                    elif err is not None:
                        row.status, row.error = CoverageStatus.failed, str(err)[:1000]
                    else:
                        row.status = CoverageStatus(result.status)
                        row.whats_present = result.whats_present or None
                        row.whats_missing = result.whats_missing or None
                        row.confidence = Confidence(result.confidence)
                        row.error = None
                        row.assessed_at = datetime.now(timezone.utc)
                        await _write_evidence(s, row.id, result.evidence, fname_to_docid)
                    await s.commit()
            except Exception:  # noqa: BLE001 - last resort: mark failed, never abort the batch
                log.exception("assess_one CRASHED for row %s", row_id)
                try:
                    async with session_factory() as s2:
                        r = await s2.get(RequirementCoverage, row_id)
                        if r is not None and r.status == CoverageStatus.pending:
                            r.status, r.error = CoverageStatus.failed, "assessment write error"
                            await s2.commit()
                except Exception:  # noqa: BLE001
                    pass

        for rid, rk in pending:  # sequential — each commit reveals the next requirement in the UI
            await assess_one(rid, rk)
        log.info("run_assessment DONE engagement=%s jurisdiction=%s in %.1fs",
                 engagement_id, jurisdiction, time.monotonic() - t0)
    except Exception:
        # A crash here (setup/retrieval) would otherwise leave rows stuck 'pending' silently.
        log.exception("run_assessment CRASHED engagement=%s jurisdiction=%s after %.1fs",
                      engagement_id, jurisdiction, time.monotonic() - t0)


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/engagements/{engagement_id}/coverage", response_model=CoverageResponse, status_code=201)
async def start_coverage(
    engagement_id: uuid.UUID,
    background: BackgroundTasks,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    assessor: Assessor = Depends(get_assessor),
    embedder: Embedder = Depends(get_embedder),
    factory: async_sessionmaker = Depends(get_session_factory),
) -> CoverageResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    elements = resolve_requirements(jurisdiction)
    if not elements:
        raise HTTPException(status_code=404, detail=f"no requirements defined for '{jurisdiction}'")

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
        }
        for e in elements
    ]
    stmt = pg_insert(RequirementCoverage).values(rows).on_conflict_do_nothing(
        index_elements=["engagement_id", "jurisdiction", "requirement_key"]
    )
    result = await session.execute(stmt)
    await session.commit()

    inserted = result.rowcount or 0
    log.info("start_coverage engagement=%s jurisdiction=%s: %d new row(s), %s",
             engagement_id, jurisdiction, inserted,
             "scheduling assessment" if inserted > 0 else "already assessed/queued (no-op)")
    if inserted > 0:
        background.add_task(run_assessment, factory, assessor, embedder, engagement_id, jurisdiction)
    return await _response(session, engagement_id, jurisdiction)


@router.get("/engagements/{engagement_id}/coverage", response_model=CoverageResponse)
async def get_coverage(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> CoverageResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    return await _response(session, engagement_id, jurisdiction)


@router.post("/coverage/{coverage_id}/supplements", response_model=CoverageRead, status_code=201)
async def add_supplement(
    coverage_id: uuid.UUID,
    background: BackgroundTasks,
    kind: SupplementKind = Form(...),
    text: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    assessor: Assessor = Depends(get_assessor),
    embedder: Embedder = Depends(get_embedder),
    factory: async_sessionmaker = Depends(get_session_factory),
) -> CoverageRead:
    row = await session.get(RequirementCoverage, coverage_id)
    if row is None:
        raise HTTPException(status_code=404, detail="coverage row not found")

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
    session.add(CoverageSupplement(coverage_id=row.id, kind=kind, document_id=doc.id, text=text_value))
    await session.commit()
    # Embed the supplement INLINE (not background) so its chunks are retrievable for the re-assess below.
    await embed_document(factory, storage, embedder, doc.id)

    # Re-assess just this requirement now that the supplement is in the corpus.
    element = next((e for e in resolve_requirements(row.jurisdiction) if e.requirement_key == row.requirement_key), None)
    if element is not None:
        fname_to_docid = await document_filename_map(session, row.engagement_id)
        documents = await retrieve_documents(session, row.engagement_id, embedder, element_query(element))
        await _apply(session, row, element, documents, assessor, fname_to_docid)
        await session.commit()

    doc_kind = await _doc_kind(session, row.engagement_id)
    section_by_key = await _draft_section_by_key(session, row.engagement_id, row.jurisdiction)
    await session.refresh(row)
    return _to_read(row, doc_kind, section_by_key)
