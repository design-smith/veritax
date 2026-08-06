from __future__ import annotations

import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy import delete, false, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import (
    get_session,
    require_engagement_owner,
)
from ..jobs import enqueue_index_document_job, enqueue_pipeline_job, schedule_pipeline_drain
from ..models import (
    CoverageEvidence,
    CoverageStatus,
    Document,
    DocumentStatus,
    DraftCitation,
    DraftSection,
    DraftStatus,
    Engagement,
    PipelineJobKind,
    RequirementCoverage,
    RiskFinding,
    RiskRun,
    RiskRunStatus,
    Source,
)
from ..schemas import PipelineRecoveryResponse
from .draft import _draft_blocked_by_coverage
from .risks import RISK_STALE_AFTER, draft_complete

router = APIRouter(tags=["pipeline"])
log = logging.getLogger("veritax")

DOCUMENT_STALE_AFTER = timedelta(minutes=10)
COVERAGE_STALE_AFTER = timedelta(minutes=8)
DRAFT_STALE_AFTER = timedelta(minutes=12)


@router.post("/engagements/{engagement_id}/pipeline/recover", response_model=PipelineRecoveryResponse)
async def recover_pipeline(
    engagement_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    retry_failed: bool = Query(False),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> PipelineRecoveryResponse:
    now = datetime.now(timezone.utc)

    stale_documents = (
        await session.execute(
            select(Document)
            .join(Source, Source.id == Document.source_id)
            .where(
                Source.engagement_id == engagement_id,
                or_(
                    Document.status.in_([DocumentStatus.uploaded, DocumentStatus.embedding])
                    & or_(
                        Document.status_updated_at.is_(None),
                        Document.status_updated_at < now - DOCUMENT_STALE_AFTER,
                    ),
                    (Document.status == DocumentStatus.failed) if retry_failed else false(),
                ),
            )
        )
    ).scalars().all()
    for doc in stale_documents:
        doc.status = DocumentStatus.uploaded
        doc.status_updated_at = now
        doc.error = None

    coverage_rows = (
        await session.execute(
            select(RequirementCoverage).where(
                RequirementCoverage.engagement_id == engagement_id,
                or_(
                    (RequirementCoverage.status == CoverageStatus.pending)
                    & or_(
                        RequirementCoverage.status_updated_at.is_(None),
                        RequirementCoverage.status_updated_at < now - COVERAGE_STALE_AFTER,
                    ),
                    (RequirementCoverage.status == CoverageStatus.failed) if retry_failed else false(),
                ),
            )
        )
    ).scalars().all()
    coverage_ids_to_clear: list[uuid.UUID] = []
    coverage_jurisdictions = sorted({row.jurisdiction for row in coverage_rows})
    for row in coverage_rows:
        if row.status == CoverageStatus.failed:
            coverage_ids_to_clear.append(row.id)
            row.whats_present = None
            row.whats_missing = None
            row.confidence = None
        row.status = CoverageStatus.pending
        row.status_updated_at = now
        row.error = None
    if coverage_ids_to_clear:
        await session.execute(delete(CoverageEvidence).where(CoverageEvidence.coverage_id.in_(coverage_ids_to_clear)))

    draft_rows = (
        await session.execute(
            select(DraftSection).where(
                DraftSection.engagement_id == engagement_id,
                or_(
                    DraftSection.status.in_([DraftStatus.pending, DraftStatus.drafting])
                    & or_(
                        DraftSection.status_updated_at.is_(None),
                        DraftSection.status_updated_at < now - DRAFT_STALE_AFTER,
                    ),
                    (DraftSection.status == DraftStatus.failed) if retry_failed else false(),
                ),
            )
        )
    ).scalars().all()
    draft_ids_to_clear: list[uuid.UUID] = []
    draft_jurisdictions: set[str] = set()
    for row in draft_rows:
        blocked = await _draft_blocked_by_coverage(session, engagement_id, row.jurisdiction)
        if blocked:
            row.status = DraftStatus.failed
            row.status_updated_at = now
            row.error = blocked
            continue
        draft_ids_to_clear.append(row.id)
        draft_jurisdictions.add(row.jurisdiction)
        row.status = DraftStatus.pending
        row.status_updated_at = now
        row.error = None
        row.content = None
    if draft_ids_to_clear:
        await session.execute(delete(DraftCitation).where(DraftCitation.section_id.in_(draft_ids_to_clear)))

    risk_rows = (
        await session.execute(
            select(RiskRun).where(
                RiskRun.engagement_id == engagement_id,
                or_(
                    RiskRun.status.in_([RiskRunStatus.pending, RiskRunStatus.analyzing])
                    & or_(
                        RiskRun.status_updated_at.is_(None),
                        RiskRun.status_updated_at < now - RISK_STALE_AFTER,
                        RiskRun.created_at < now - RISK_STALE_AFTER,
                    ),
                    (RiskRun.status == RiskRunStatus.failed) if retry_failed else false(),
                ),
            )
        )
    ).scalars().all()
    risk_run_ids_to_clear: list[uuid.UUID] = []
    risk_jurisdictions: set[str] = set()
    for row in risk_rows:
        if not await draft_complete(session, engagement_id, row.jurisdiction):
            row.status = RiskRunStatus.failed
            row.status_updated_at = now
            row.error = f"draft not complete for '{row.jurisdiction}'"
            continue
        risk_run_ids_to_clear.append(row.id)
        risk_jurisdictions.add(row.jurisdiction)
        row.status = RiskRunStatus.pending
        row.status_updated_at = now
        row.error = None
        row.completed_at = None
    if risk_run_ids_to_clear:
        await session.execute(delete(RiskFinding).where(RiskFinding.run_id.in_(risk_run_ids_to_clear)))

    for doc in stale_documents:
        await enqueue_index_document_job(session, doc, restart=True)
    for jurisdiction in coverage_jurisdictions:
        await enqueue_pipeline_job(
            session,
            engagement_id=engagement_id,
            kind=PipelineJobKind.assess_requirements,
            dedupe_key=f"assess_requirements:{engagement_id}:{jurisdiction}",
            payload={"jurisdiction": jurisdiction},
            restart=True,
        )
    for jurisdiction in sorted(draft_jurisdictions):
        await enqueue_pipeline_job(
            session,
            engagement_id=engagement_id,
            kind=PipelineJobKind.draft_jurisdiction,
            dedupe_key=f"draft_jurisdiction:{engagement_id}:{jurisdiction}",
            payload={"jurisdiction": jurisdiction},
            restart=True,
        )
    for jurisdiction in sorted(risk_jurisdictions):
        await enqueue_pipeline_job(
            session,
            engagement_id=engagement_id,
            kind=PipelineJobKind.analyze_risks,
            dedupe_key=f"analyze_risks:{engagement_id}:{jurisdiction}",
            payload={"jurisdiction": jurisdiction},
            restart=True,
        )
    await session.commit()
    total_jobs = len(stale_documents) + len(coverage_jurisdictions) + len(draft_jurisdictions) + len(risk_jurisdictions)
    if total_jobs:
        schedule_pipeline_drain(background, request.app, max_jobs=total_jobs)

    log.info(
        "pipeline.recover engagement_id=%s documents=%d coverage=%s draft=%s risks=%s retry_failed=%s",
        str(engagement_id)[:8] + "...",
        len(stale_documents),
        coverage_jurisdictions,
        sorted(draft_jurisdictions),
        sorted(risk_jurisdictions),
        retry_failed,
    )

    return PipelineRecoveryResponse(
        retried_failed=retry_failed,
        documents_restarted=len(stale_documents),
        coverage_jurisdictions_restarted=coverage_jurisdictions,
        draft_jurisdictions_restarted=sorted(draft_jurisdictions),
        risk_jurisdictions_restarted=sorted(risk_jurisdictions),
    )
