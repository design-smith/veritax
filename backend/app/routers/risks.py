from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from ..config import settings
from ..corpus import document_contexts_by_id, document_filename_map, retrieve_documents, union_docs
from ..deps import get_session, require_engagement_owner
from ..embeddings import Embedder
from ..jobs import enqueue_pipeline_job, schedule_pipeline_drain
from ..models import (
    Confidence,
    DraftSection,
    DraftStatus,
    Engagement,
    PipelineJobKind,
    RiskEvidence,
    RiskFinding,
    RiskKind,
    RiskRecommendation,
    RiskRun,
    RiskRunStatus,
    RiskSeverity,
)
from ..risks import RiskAnalyzer
from ..schemas import RiskEvidenceRead, RiskFindingRead, RiskResponse, RiskSummary

router = APIRouter(tags=["risks"])
log = logging.getLogger("veritax")

SEV_RANK = {RiskSeverity.critical: 0, RiskSeverity.high: 1, RiskSeverity.medium: 2, RiskSeverity.low: 3}
RISK_STALE_AFTER = timedelta(minutes=5)
RISK_ANALYSIS_TIMEOUT_SECONDS = 180


def _elapsed_ms(started_at: float) -> int:
    return round((time.perf_counter() - started_at) * 1000)


def _short_id(value: uuid.UUID) -> str:
    return f"{str(value)[:8]}..."


def _analysis_mode() -> str:
    provider = settings.llm_provider.strip().lower()
    if provider:
        return provider
    if settings.deepseek_api_key:
        return "deepseek"
    if settings.anthropic_api_key:
        return "anthropic"
    return "fake"


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


def _evidence_verified(detail: str, draft_text: str, documents, source_filename: str | None) -> bool:
    needle = _norm(detail)
    if len(needle) < 16:
        return False
    haystacks = [draft_text]
    if source_filename:
        haystacks.extend(d.text for d in documents if d.filename == source_filename)
    else:
        haystacks.extend(d.text for d in documents)
    return any(needle in _norm(text) for text in haystacks if text)


async def _latest_draft_update(
    session: AsyncSession,
    engagement_id: uuid.UUID,
    jurisdiction: str,
) -> datetime | None:
    return (
        await session.execute(
            select(func.max(DraftSection.status_updated_at)).where(
                DraftSection.engagement_id == engagement_id,
                DraftSection.jurisdiction == jurisdiction,
            )
        )
    ).scalar_one_or_none()


def _run_is_fresh(run: RiskRun, latest_draft_update: datetime | None) -> bool:
    if run.status != RiskRunStatus.done or run.completed_at is None:
        return False
    return latest_draft_update is None or latest_draft_update <= run.completed_at


def _running_run_is_stale(run: RiskRun, now: datetime) -> bool:
    if run.status not in (RiskRunStatus.pending, RiskRunStatus.analyzing):
        return False
    if run.status_updated_at is None:
        return True
    # Existing production rows get status_updated_at added by migration. created_at catches older
    # stranded jobs that would otherwise look fresh immediately after that column appears.
    return run.status_updated_at < now - RISK_STALE_AFTER or run.created_at < now - RISK_STALE_AFTER


# ── Draft-complete gate (Risks runs only on the finished file) ────────────────
async def draft_complete(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> bool:
    complete, _counts = await _draft_status_counts(session, engagement_id, jurisdiction)
    return complete


async def _draft_status_counts(
    session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str
) -> tuple[bool, dict[str, int]]:
    rows = (
        await session.execute(
            select(DraftSection.status).where(
                DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction
            )
        )
    ).scalars().all()
    if not rows:
        return False, {}
    counts: dict[str, int] = {}
    for status in rows:
        counts[status.value] = counts.get(status.value, 0) + 1
    return all(s == DraftStatus.drafted for s in rows), counts


# ── Read helpers ─────────────────────────────────────────────────────────────
def _to_finding_read(f: RiskFinding) -> RiskFindingRead:
    return RiskFindingRead(
        id=f.id,
        kind=f.kind,
        title=f.title,
        description=f.description,
        severity=f.severity,
        exposure_label=f.exposure_label,
        exposure_estimated=f.exposure_estimated,
        exposure_amount=float(f.exposure_amount) if f.exposure_amount is not None else None,
        exposure_currency=f.exposure_currency,
        confidence=f.confidence,
        evidence=[RiskEvidenceRead.model_validate(e) for e in f.evidence],
        recommendations=[r.text for r in f.recommendations],
    )


def _summary(findings: list[RiskFinding]) -> RiskSummary:
    by_sev = {s.value: 0 for s in RiskSeverity}
    by_kind = {k.value: 0 for k in RiskKind}
    for f in findings:
        by_sev[f.severity.value] += 1
        by_kind[f.kind.value] += 1
    return RiskSummary(total=len(findings), by_severity=by_sev, by_kind=by_kind)


async def _response(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> RiskResponse:
    started_at = time.perf_counter()
    query_started_at = time.perf_counter()
    run = (
        await session.execute(
            select(RiskRun)
            .options(
                selectinload(RiskRun.findings).selectinload(RiskFinding.evidence),
                selectinload(RiskRun.findings).selectinload(RiskFinding.recommendations),
            )
            .where(RiskRun.engagement_id == engagement_id, RiskRun.jurisdiction == jurisdiction)
        )
    ).scalar_one_or_none()
    query_ms = _elapsed_ms(query_started_at)
    findings = list(run.findings) if run else []
    latest_started_at = time.perf_counter()
    latest = await _latest_draft_update(session, engagement_id, jurisdiction)
    latest_ms = _elapsed_ms(latest_started_at)
    serialize_started_at = time.perf_counter()
    response = RiskResponse(
        jurisdiction=jurisdiction,
        status=run.status.value if run else "not_started",
        error=run.error if run else None,
        analysis_mode=_analysis_mode(),
        stale=bool(run and run.status == RiskRunStatus.done and not _run_is_fresh(run, latest)),
        summary=_summary(findings),
        findings=[_to_finding_read(f) for f in findings],
    )
    serialize_ms = _elapsed_ms(serialize_started_at)
    log.info(
        "risks.response engagement_id=%s jurisdiction=%s status=%s findings=%d evidence=%d recommendations=%d "
        "stale=%s query_ms=%d latest_draft_ms=%d serialize_ms=%d total_ms=%d",
        _short_id(engagement_id),
        jurisdiction,
        response.status,
        len(findings),
        sum(len(f.evidence) for f in findings),
        sum(len(f.recommendations) for f in findings),
        response.stale,
        query_ms,
        latest_ms,
        serialize_ms,
        _elapsed_ms(started_at),
    )
    return response


# ── Analysis job (holistic — the whole draft vs. the retrieved record) ────────
async def run_analysis(session_factory: async_sessionmaker, analyzer: RiskAnalyzer, embedder: Embedder,
                       engagement_id: uuid.UUID, jurisdiction: str) -> None:
    job_started_at = time.perf_counter()
    async with session_factory() as session:
        run = (
            await session.execute(
                select(RiskRun).where(RiskRun.engagement_id == engagement_id, RiskRun.jurisdiction == jurisdiction)
            )
        ).scalar_one_or_none()
        if run is None:
            log.warning(
                "risks.job.missing_run engagement_id=%s jurisdiction=%s",
                _short_id(engagement_id),
                jurisdiction,
            )
            return
        run_id = run.id  # capture now — after a rollback the instance is expired and can't lazy-load
        now = datetime.now(timezone.utc)
        log.info(
            "risks.job.start engagement_id=%s jurisdiction=%s run_id=%s provider=%s analyzer=%s",
            _short_id(engagement_id),
            jurisdiction,
            _short_id(run_id),
            _analysis_mode(),
            analyzer.__class__.__name__,
        )
        run.status = RiskRunStatus.analyzing
        run.status_updated_at = now
        await session.commit()

        try:
            draft_started_at = time.perf_counter()
            eng = await session.get(Engagement, engagement_id)
            entity_name = eng.entity.name if eng and eng.entity else ""
            sections = (
                await session.execute(
                    select(DraftSection)
                    .options(selectinload(DraftSection.citations))
                    .where(DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction)
                    .order_by(DraftSection.element_order)
                )
            ).scalars().all()
            draft_text = "\n\n".join(
                f"## {s.element_order}. {s.element_name}\n\n{s.content or '(not drafted)'}" for s in sections
            )
            citation_count = sum(len(s.citations) for s in sections)
            log.info(
                "risks.job.draft_loaded engagement_id=%s jurisdiction=%s sections=%d citations=%d draft_chars=%d "
                "duration_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(sections),
                citation_count,
                len(draft_text),
                _elapsed_ms(draft_started_at),
            )
            # Retrieve the record passages most relevant to a TP risk review (transactions, rates,
            # agreements, comparables) rather than the whole corpus — keeps risk analysis in-window.
            risk_query = (
                f"{entity_name} {jurisdiction} transfer pricing royalty rate markup margin "
                "intercompany services agreement comparables method arm's length intangibles"
            )
            retrieve_started_at = time.perf_counter()
            documents = await retrieve_documents(session, engagement_id, embedder, risk_query, k=24)
            log.info(
                "risks.job.semantic_retrieval engagement_id=%s jurisdiction=%s documents=%d context_chars=%d "
                "duration_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(documents),
                sum(len(d.text) for d in documents),
                _elapsed_ms(retrieve_started_at),
            )
            cited_started_at = time.perf_counter()
            cited_ids = [c.document_id for s in sections for c in s.citations if c.document_id]
            cited_documents = await document_contexts_by_id(session, cited_ids)
            documents = union_docs([documents, cited_documents])
            log.info(
                "risks.job.cited_context_loaded engagement_id=%s jurisdiction=%s cited_ids=%d cited_documents=%d "
                "merged_documents=%d merged_context_chars=%d duration_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(cited_ids),
                len(cited_documents),
                len(documents),
                sum(len(d.text) for d in documents),
                _elapsed_ms(cited_started_at),
            )
            filename_map_started_at = time.perf_counter()
            fname_to_docid = await document_filename_map(session, engagement_id)
            fname_to_docid_ci = {fn.lower(): docid for fn, docid in fname_to_docid.items()}
            log.info(
                "risks.job.filename_map_loaded engagement_id=%s jurisdiction=%s filenames=%d duration_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(fname_to_docid),
                _elapsed_ms(filename_map_started_at),
            )

            analysis_started_at = time.perf_counter()
            log.info(
                "risks.job.analysis_begin engagement_id=%s jurisdiction=%s timeout_seconds=%d",
                _short_id(engagement_id),
                jurisdiction,
                RISK_ANALYSIS_TIMEOUT_SECONDS,
            )
            try:
                findings = await asyncio.wait_for(
                    asyncio.to_thread(analyzer.analyze, entity_name, jurisdiction, draft_text, documents),
                    timeout=RISK_ANALYSIS_TIMEOUT_SECONDS,
                )
            except TimeoutError as exc:
                raise RuntimeError(
                    f"risk analysis timed out after {RISK_ANALYSIS_TIMEOUT_SECONDS}s"
                ) from exc
            log.info(
                "risks.job.analysis_complete engagement_id=%s jurisdiction=%s findings=%d duration_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(findings),
                _elapsed_ms(analysis_started_at),
            )

            persist_started_at = time.perf_counter()
            await session.execute(delete(RiskFinding).where(RiskFinding.run_id == run.id))
            evidence_count = 0
            recommendation_count = 0
            for f in findings:
                severity = RiskSeverity(f.severity)
                finding = RiskFinding(
                    run_id=run.id,
                    engagement_id=engagement_id,
                    jurisdiction=jurisdiction,
                    kind=RiskKind(f.kind),
                    title=f.title,
                    description=f.description,
                    severity=severity,
                    exposure_label=f.exposure_label or None,
                    exposure_estimated=bool(f.exposure_estimated),
                    confidence=Confidence(f.confidence),
                    rank=SEV_RANK[severity],
                )
                session.add(finding)
                await session.flush()
                for e in f.evidence:
                    docid = None
                    if e.source_filename:
                        docid = fname_to_docid.get(e.source_filename) or fname_to_docid_ci.get(e.source_filename.lower())
                    evidence_count += 1
                    session.add(RiskEvidence(
                        finding_id=finding.id, kind=e.kind, reference=e.reference, detail=e.detail,
                        source_label=e.source_filename,
                        verified=_evidence_verified(e.detail, draft_text, documents, e.source_filename),
                        document_id=uuid.UUID(docid) if docid else None,
                    ))
                for i, rec in enumerate(f.recommendations):
                    recommendation_count += 1
                    session.add(RiskRecommendation(finding_id=finding.id, order=i, text=rec))
            run.status = RiskRunStatus.done
            run.error = None
            run.completed_at = datetime.now(timezone.utc)
            run.status_updated_at = run.completed_at
            await session.commit()
            log.info(
                "risks.job.persisted engagement_id=%s jurisdiction=%s findings=%d evidence=%d recommendations=%d "
                "persist_ms=%d total_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                len(findings),
                evidence_count,
                recommendation_count,
                _elapsed_ms(persist_started_at),
                _elapsed_ms(job_started_at),
            )
        except Exception as exc:  # noqa: BLE001 - record failure on the run
            await session.rollback()
            run = await session.get(RiskRun, run_id)  # run.id would be expired after the rollback
            if run is not None:
                run.status = RiskRunStatus.failed
                run.error = str(exc)[:1000]
                run.status_updated_at = datetime.now(timezone.utc)
                await session.commit()
            log.exception(
                "risks.job.failed engagement_id=%s jurisdiction=%s run_id=%s total_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                _short_id(run_id),
                _elapsed_ms(job_started_at),
            )


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/engagements/{engagement_id}/risks", response_model=RiskResponse, status_code=201)
async def start_risks(
    engagement_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> RiskResponse:
    request_started_at = time.perf_counter()
    now = datetime.now(timezone.utc)
    log.info(
        "risks.start.begin engagement_id=%s jurisdiction=%s",
        _short_id(engagement_id),
        jurisdiction,
    )
    # Idempotent: if analysis already ran (or is running), return the stored result — never re-run on
    # revisit/reload. Only a not-started or failed run proceeds.
    existing_started_at = time.perf_counter()
    existing = (
        await session.execute(
            select(RiskRun).where(RiskRun.engagement_id == engagement_id, RiskRun.jurisdiction == jurisdiction)
        )
    ).scalar_one_or_none()
    log.info(
        "risks.start.existing_checked engagement_id=%s jurisdiction=%s existing=%s status=%s duration_ms=%d",
        _short_id(engagement_id),
        jurisdiction,
        existing is not None,
        existing.status.value if existing else None,
        _elapsed_ms(existing_started_at),
    )
    if existing is not None and existing.status in (RiskRunStatus.pending, RiskRunStatus.analyzing):
        stale_running = _running_run_is_stale(existing, now)
        log.info(
            "risks.start.running_checked engagement_id=%s jurisdiction=%s status=%s stale=%s "
            "created_at=%s status_updated_at=%s stale_after_seconds=%d",
            _short_id(engagement_id),
            jurisdiction,
            existing.status.value,
            stale_running,
            existing.created_at.isoformat() if existing.created_at else None,
            existing.status_updated_at.isoformat() if existing.status_updated_at else None,
            int(RISK_STALE_AFTER.total_seconds()),
        )
        if stale_running:
            log.warning(
                "risks.start.recover_stale_running engagement_id=%s jurisdiction=%s status=%s total_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                existing.status.value,
                _elapsed_ms(request_started_at),
            )
        else:
            log.info(
                "risks.start.return_running engagement_id=%s jurisdiction=%s status=%s total_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                existing.status.value,
                _elapsed_ms(request_started_at),
            )
            return await _response(session, engagement_id, jurisdiction)

    latest_draft_update = None
    if existing is not None:
        latest_started_at = time.perf_counter()
        latest_draft_update = await _latest_draft_update(session, engagement_id, jurisdiction)
        fresh = _run_is_fresh(existing, latest_draft_update)
        log.info(
            "risks.start.freshness_checked engagement_id=%s jurisdiction=%s fresh=%s latest_draft_update=%s "
            "completed_at=%s duration_ms=%d",
            _short_id(engagement_id),
            jurisdiction,
            fresh,
            latest_draft_update.isoformat() if latest_draft_update else None,
            existing.completed_at.isoformat() if existing.completed_at else None,
            _elapsed_ms(latest_started_at),
        )
        if fresh:
            log.info(
                "risks.start.return_fresh engagement_id=%s jurisdiction=%s status=%s total_ms=%d",
                _short_id(engagement_id),
                jurisdiction,
                existing.status.value,
                _elapsed_ms(request_started_at),
            )
            return await _response(session, engagement_id, jurisdiction)

    gate_started_at = time.perf_counter()
    complete, status_counts = await _draft_status_counts(session, engagement_id, jurisdiction)
    log.info(
        "risks.start.draft_gate engagement_id=%s jurisdiction=%s complete=%s statuses=%s duration_ms=%d",
        _short_id(engagement_id),
        jurisdiction,
        complete,
        status_counts,
        _elapsed_ms(gate_started_at),
    )
    if not complete:
        # The mirror of the Requirements rule: Risks runs only on the completed draft.
        log.info(
            "risks.start.blocked engagement_id=%s jurisdiction=%s reason=draft_not_complete total_ms=%d",
            _short_id(engagement_id),
            jurisdiction,
            _elapsed_ms(request_started_at),
        )
        raise HTTPException(status_code=409, detail=f"draft not complete for '{jurisdiction}'")

    # Race-safe upsert of the run + clear prior findings.
    upsert_started_at = time.perf_counter()
    stmt = (
        pg_insert(RiskRun)
        .values(id=uuid.uuid4(), engagement_id=engagement_id, jurisdiction=jurisdiction,
                status=RiskRunStatus.pending, status_updated_at=now)
        .on_conflict_do_update(
            index_elements=["engagement_id", "jurisdiction"],
            set_={
                "status": RiskRunStatus.pending,
                "error": None,
                "completed_at": None,
                "status_updated_at": now,
            },
        )
        .returning(RiskRun.id)
    )
    run_id = (await session.execute(stmt)).scalar_one()
    await session.execute(delete(RiskFinding).where(RiskFinding.run_id == run_id))
    await enqueue_pipeline_job(
        session,
        engagement_id=engagement_id,
        kind=PipelineJobKind.analyze_risks,
        dedupe_key=f"analyze_risks:{engagement_id}:{jurisdiction}",
        payload={"jurisdiction": jurisdiction},
        restart=True,
    )
    await session.commit()
    log.info(
        "risks.start.run_queued engagement_id=%s jurisdiction=%s run_id=%s upsert_ms=%d total_ms=%d",
        _short_id(engagement_id),
        jurisdiction,
        _short_id(run_id),
        _elapsed_ms(upsert_started_at),
        _elapsed_ms(request_started_at),
    )

    schedule_pipeline_drain(background, request.app, max_jobs=1)
    return await _response(session, engagement_id, jurisdiction)


@router.get("/engagements/{engagement_id}/risks", response_model=RiskResponse)
async def get_risks(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> RiskResponse:
    started_at = time.perf_counter()
    log.info(
        "risks.get.begin engagement_id=%s jurisdiction=%s",
        _short_id(engagement_id),
        jurisdiction,
    )
    response = await _response(session, engagement_id, jurisdiction)
    log.info(
        "risks.get.complete engagement_id=%s jurisdiction=%s status=%s findings=%d total_ms=%d",
        _short_id(engagement_id),
        jurisdiction,
        response.status,
        len(response.findings),
        _elapsed_ms(started_at),
    )
    return response
