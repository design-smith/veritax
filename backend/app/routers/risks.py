from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from ..corpus import document_filename_map, retrieve_documents
from ..deps import get_embedder, get_risk_analyzer, get_session, get_session_factory
from ..embeddings import Embedder
from ..models import (
    Confidence,
    DraftSection,
    DraftStatus,
    Engagement,
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

SEV_RANK = {RiskSeverity.critical: 0, RiskSeverity.high: 1, RiskSeverity.medium: 2, RiskSeverity.low: 3}


# ── Draft-complete gate (Risks runs only on the finished file) ────────────────
async def draft_complete(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> bool:
    rows = (
        await session.execute(
            select(DraftSection.status).where(
                DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction
            )
        )
    ).scalars().all()
    if not rows:
        return False
    return all(s not in (DraftStatus.pending, DraftStatus.drafting) for s in rows)


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
    run = (
        await session.execute(
            select(RiskRun).where(RiskRun.engagement_id == engagement_id, RiskRun.jurisdiction == jurisdiction)
        )
    ).scalar_one_or_none()
    findings = list(run.findings) if run else []
    return RiskResponse(
        jurisdiction=jurisdiction,
        status=run.status.value if run else "not_started",
        error=run.error if run else None,
        summary=_summary(findings),
        findings=[_to_finding_read(f) for f in findings],
    )


# ── Analysis job (holistic — the whole draft vs. the retrieved record) ────────
async def run_analysis(session_factory: async_sessionmaker, analyzer: RiskAnalyzer, embedder: Embedder,
                       engagement_id: uuid.UUID, jurisdiction: str) -> None:
    async with session_factory() as session:
        run = (
            await session.execute(
                select(RiskRun).where(RiskRun.engagement_id == engagement_id, RiskRun.jurisdiction == jurisdiction)
            )
        ).scalar_one_or_none()
        if run is None:
            return
        run.status = RiskRunStatus.analyzing
        await session.commit()

        try:
            eng = await session.get(Engagement, engagement_id)
            entity_name = eng.entity.name if eng and eng.entity else ""
            sections = (
                await session.execute(
                    select(DraftSection)
                    .where(DraftSection.engagement_id == engagement_id, DraftSection.jurisdiction == jurisdiction)
                    .order_by(DraftSection.element_order)
                )
            ).scalars().all()
            draft_text = "\n\n".join(
                f"## {s.element_order}. {s.element_name}\n\n{s.content or '(not drafted)'}" for s in sections
            )
            # Retrieve the record passages most relevant to a TP risk review (transactions, rates,
            # agreements, comparables) rather than the whole corpus — keeps risk analysis in-window.
            risk_query = (
                f"{entity_name} {jurisdiction} transfer pricing royalty rate markup margin "
                "intercompany services agreement comparables method arm's length intangibles"
            )
            documents = await retrieve_documents(session, engagement_id, embedder, risk_query, k=24)
            fname_to_docid = await document_filename_map(session, engagement_id)

            findings = await asyncio.to_thread(analyzer.analyze, entity_name, jurisdiction, draft_text, documents)

            await session.execute(delete(RiskFinding).where(RiskFinding.run_id == run.id))
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
                    docid = fname_to_docid.get(e.source_filename) if e.source_filename else None
                    session.add(RiskEvidence(
                        finding_id=finding.id, kind=e.kind, reference=e.reference, detail=e.detail,
                        document_id=uuid.UUID(docid) if docid else None,
                    ))
                for i, rec in enumerate(f.recommendations):
                    session.add(RiskRecommendation(finding_id=finding.id, order=i, text=rec))
            run.status = RiskRunStatus.done
            run.error = None
            run.completed_at = datetime.now(timezone.utc)
            await session.commit()
        except Exception as exc:  # noqa: BLE001 - record failure on the run
            await session.rollback()
            run = await session.get(RiskRun, run.id)
            if run is not None:
                run.status = RiskRunStatus.failed
                run.error = str(exc)[:1000]
                await session.commit()


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/engagements/{engagement_id}/risks", response_model=RiskResponse, status_code=201)
async def start_risks(
    engagement_id: uuid.UUID,
    background: BackgroundTasks,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    analyzer: RiskAnalyzer = Depends(get_risk_analyzer),
    embedder: Embedder = Depends(get_embedder),
    factory: async_sessionmaker = Depends(get_session_factory),
) -> RiskResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    if not await draft_complete(session, engagement_id, jurisdiction):
        # The mirror of the Requirements rule: Risks runs only on the completed draft.
        raise HTTPException(status_code=409, detail=f"draft not complete for '{jurisdiction}'")

    # Race-safe upsert of the run + clear prior findings.
    stmt = (
        pg_insert(RiskRun)
        .values(id=uuid.uuid4(), engagement_id=engagement_id, jurisdiction=jurisdiction,
                status=RiskRunStatus.pending)
        .on_conflict_do_update(
            index_elements=["engagement_id", "jurisdiction"],
            set_={"status": RiskRunStatus.pending, "error": None, "completed_at": None},
        )
        .returning(RiskRun.id)
    )
    run_id = (await session.execute(stmt)).scalar_one()
    await session.execute(delete(RiskFinding).where(RiskFinding.run_id == run_id))
    await session.commit()

    background.add_task(run_analysis, factory, analyzer, embedder, engagement_id, jurisdiction)
    return await _response(session, engagement_id, jurisdiction)


@router.get("/engagements/{engagement_id}/risks", response_model=RiskResponse)
async def get_risks(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
) -> RiskResponse:
    if await session.get(Engagement, engagement_id) is None:
        raise HTTPException(status_code=404, detail="engagement not found")
    return await _response(session, engagement_id, jurisdiction)
