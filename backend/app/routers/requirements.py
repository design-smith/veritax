from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth import AuthUser
from ..canonical_fact_context import canonical_fact_docs, classification_backed_docs
from ..deps import (
    get_classified_docs_provider,
    get_current_user,
    get_session,
    require_engagement_owner,
)
from ..matching import ClassifiedDocumentsProvider, evaluate_over, resolve_policies, suggested_sources
from ..models import (
    Engagement,
    RequirementEvidence,
    RequirementOverride,
    RequirementResult,
    RequirementStatus,
)
from ..schemas import (
    MissingGroupRead,
    OverrideRequest,
    RequirementDetailResponse,
    RequirementEvidenceRead,
    RequirementMissingResponse,
    RequirementResultRead,
    RequirementResultsResponse,
)

router = APIRouter(tags=["requirements"])


def _scope(owner: Engagement, jurisdiction: str) -> dict:
    return {"jurisdiction": jurisdiction, "entity": owner.entity.name if owner.entity else None}


def _severity_by_key(jurisdiction: str) -> dict[str, str]:
    return {p.requirement_key: p.severity for p in resolve_policies(jurisdiction)}


def _result_read(r: RequirementResult, severity: dict[str, str]) -> RequirementResultRead:
    return RequirementResultRead(
        requirement_key=r.requirement_key,
        element_name=r.element_name,
        status=r.status.value,
        severity=severity.get(r.requirement_key, "medium"),
        explanation=r.explanation,
        missing=r.missing or [],
        overridden=r.overridden,
    )


async def _overrides(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> dict[str, RequirementOverride]:
    rows = (
        await session.execute(
            select(RequirementOverride).where(
                RequirementOverride.engagement_id == engagement_id,
                RequirementOverride.jurisdiction == jurisdiction,
            )
        )
    ).scalars()
    return {o.requirement_key: o for o in rows}


def _apply_override(result: RequirementResult, ov: RequirementOverride) -> None:
    """A human override supersedes the rule verdict but preserves it in the explanation for audit."""
    result.explanation = f"Marked satisfied by {ov.actor}: {ov.justification} (rule result: {result.status.value})."
    result.status = RequirementStatus.present
    result.overridden = True
    result.missing = []


async def _load(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> list[RequirementResult]:
    return list(
        (
            await session.execute(
                select(RequirementResult)
                .where(
                    RequirementResult.engagement_id == engagement_id,
                    RequirementResult.jurisdiction == jurisdiction,
                )
                .order_by(RequirementResult.requirement_key)
            )
        ).scalars()
    )


@router.post(
    "/engagements/{engagement_id}/requirements/evaluate",
    response_model=RequirementResultsResponse,
    status_code=201,
)
async def evaluate_requirements(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    provider: ClassifiedDocumentsProvider = Depends(get_classified_docs_provider),
    owner: Engagement = Depends(require_engagement_owner),
) -> RequirementResultsResponse:
    """Run the deterministic matcher for one jurisdiction and store the results (fully recomputed each run)."""
    docs = [
        *provider.documents_for(engagement_id, jurisdiction),
        *(await canonical_fact_docs(session, engagement_id, jurisdiction)),
        *(await classification_backed_docs(session, engagement_id, jurisdiction)),
    ]
    evals = evaluate_over(resolve_policies(jurisdiction), docs, scope=_scope(owner, jurisdiction))
    now = datetime.now(timezone.utc)

    # Deterministic recompute: replace this jurisdiction's results (evidence cascades) with a fresh set.
    await session.execute(
        delete(RequirementResult).where(
            RequirementResult.engagement_id == engagement_id,
            RequirementResult.jurisdiction == jurisdiction,
        )
    )
    overrides = await _overrides(session, engagement_id, jurisdiction)
    for e in evals:
        result = RequirementResult(
            engagement_id=engagement_id,
            jurisdiction=jurisdiction,
            requirement_key=e.requirement_key,
            element_name=e.element_name,
            status=RequirementStatus(e.result.status),
            explanation=e.result.explanation,
            missing=e.result.missing,
            status_updated_at=now,
        )
        for m in e.result.matched:
            doc_id = m.doc.document_id if isinstance(m.doc.document_id, uuid.UUID) else None
            result.evidence.append(
                RequirementEvidence(document_id=doc_id, document_type=m.doc.document_type, role=m.role)
            )
        if e.requirement_key in overrides:  # human override survives recompute
            _apply_override(result, overrides[e.requirement_key])
        session.add(result)
    await session.commit()

    rows = await _load(session, engagement_id, jurisdiction)
    sev = _severity_by_key(jurisdiction)
    return RequirementResultsResponse(jurisdiction=jurisdiction, results=[_result_read(r, sev) for r in rows])


@router.get(
    "/engagements/{engagement_id}/requirements",
    response_model=RequirementResultsResponse,
)
async def list_requirements(
    engagement_id: uuid.UUID,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    owner: Engagement = Depends(require_engagement_owner),
) -> RequirementResultsResponse:
    rows = await _load(session, engagement_id, jurisdiction)
    sev = _severity_by_key(jurisdiction)
    return RequirementResultsResponse(jurisdiction=jurisdiction, results=[_result_read(r, sev) for r in rows])


async def _require_result(
    session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str, requirement_key: str
) -> RequirementResult:
    row = (
        await session.execute(
            select(RequirementResult)
            .where(
                RequirementResult.engagement_id == engagement_id,
                RequirementResult.jurisdiction == jurisdiction,
                RequirementResult.requirement_key == requirement_key,
            )
            .options(selectinload(RequirementResult.evidence))
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="requirement result not found")
    return row


@router.get(
    "/engagements/{engagement_id}/requirements/{requirement_key}",
    response_model=RequirementDetailResponse,
)
async def requirement_detail(
    engagement_id: uuid.UUID,
    requirement_key: str,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    owner: Engagement = Depends(require_engagement_owner),
) -> RequirementDetailResponse:
    r = await _require_result(session, engagement_id, jurisdiction, requirement_key)
    return _detail_read(r, jurisdiction)


def _detail_read(r: RequirementResult, jurisdiction: str) -> RequirementDetailResponse:
    return RequirementDetailResponse(
        requirement_key=r.requirement_key,
        element_name=r.element_name,
        status=r.status.value,
        severity=_severity_by_key(jurisdiction).get(r.requirement_key, "medium"),
        explanation=r.explanation,
        missing=r.missing or [],
        overridden=r.overridden,
        evidence=[
            RequirementEvidenceRead(document_id=e.document_id, document_type=e.document_type, role=e.role)
            for e in r.evidence
        ],
    )


@router.post(
    "/engagements/{engagement_id}/requirements/{requirement_key}/override",
    response_model=RequirementDetailResponse,
)
async def override_requirement(
    engagement_id: uuid.UUID,
    requirement_key: str,
    body: OverrideRequest,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
    owner: Engagement = Depends(require_engagement_owner),
) -> RequirementDetailResponse:
    """Human 'mark satisfied': records an audited override and applies it to the current result. The
    override is stored separately so it survives future recomputes."""
    r = await _require_result(session, engagement_id, jurisdiction, requirement_key)  # 404 if not evaluated
    actor = user.email or str(user.id)
    existing = (
        await session.execute(
            select(RequirementOverride).where(
                RequirementOverride.engagement_id == engagement_id,
                RequirementOverride.jurisdiction == jurisdiction,
                RequirementOverride.requirement_key == requirement_key,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        override = RequirementOverride(
            engagement_id=engagement_id, jurisdiction=jurisdiction, requirement_key=requirement_key,
            actor=actor, justification=body.justification,
        )
        session.add(override)
    else:
        existing.actor = actor
        existing.justification = body.justification
        override = existing
    _apply_override(r, override)
    await session.commit()
    return _detail_read(r, jurisdiction)


@router.get(
    "/engagements/{engagement_id}/requirements/{requirement_key}/evidence",
    response_model=list[RequirementEvidenceRead],
)
async def requirement_evidence(
    engagement_id: uuid.UUID,
    requirement_key: str,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    owner: Engagement = Depends(require_engagement_owner),
) -> list[RequirementEvidenceRead]:
    r = await _require_result(session, engagement_id, jurisdiction, requirement_key)
    return [
        RequirementEvidenceRead(document_id=e.document_id, document_type=e.document_type, role=e.role)
        for e in r.evidence
    ]


@router.get(
    "/engagements/{engagement_id}/requirements/{requirement_key}/missing",
    response_model=RequirementMissingResponse,
)
async def requirement_missing(
    engagement_id: uuid.UUID,
    requirement_key: str,
    jurisdiction: str = Query(...),
    session: AsyncSession = Depends(get_session),
    owner: Engagement = Depends(require_engagement_owner),
) -> RequirementMissingResponse:
    r = await _require_result(session, engagement_id, jurisdiction, requirement_key)
    return RequirementMissingResponse(
        requirement_key=r.requirement_key,
        status=r.status.value,
        severity=_severity_by_key(jurisdiction).get(r.requirement_key, "medium"),
        missing=[
            MissingGroupRead(acceptable=group, sources=suggested_sources(group)) for group in (r.missing or [])
        ],
    )
