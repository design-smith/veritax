"""Org-chart intelligence (Class 2 §24-25): key roles + reporting lines as scoped SUPPORTING evidence.

Deterministic ingest of structured roles → an org_roles reporting graph. It never emits functional facts and
never establishes risk control on its own (§25); S9/S10 read it as context weighted below interviews (§31).
Extraction from an uploaded org-chart FILE is a follow-on (same document-pipeline gap as the S5 transcript).
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session, require_engagement_owner
from ..models import Engagement, OrgRole
from ..schemas import OrgChartIngest, OrgChartResponse, OrgRoleRead

router = APIRouter(tags=["org-chart"])


async def _graph(session: AsyncSession, engagement_id: uuid.UUID) -> OrgChartResponse:
    rows = (
        await session.execute(
            select(OrgRole).where(OrgRole.engagement_id == engagement_id).order_by(OrgRole.created_at)
        )
    ).scalars().all()
    return OrgChartResponse(roles=[OrgRoleRead.model_validate(r) for r in rows])


@router.post("/engagements/{engagement_id}/org-chart", response_model=OrgChartResponse, status_code=201)
async def ingest_org_chart(
    engagement_id: uuid.UUID,
    body: OrgChartIngest,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> OrgChartResponse:
    created: list[OrgRole] = []
    for r in body.roles:
        role = OrgRole(
            engagement_id=engagement_id, document_id=body.document_id, person_name=r.person_name,
            job_title=r.job_title, entity_id=r.entity_id, department=r.department, location=r.location,
            management_level=r.management_level, scope_level="local_entity",
        )
        session.add(role)
        created.append(role)
    await session.flush()
    # Second pass: resolve reporting edges within the batch (match job_title, else person_name).
    by_title = {rl.job_title.lower(): rl for rl in created}
    by_name = {rl.person_name.lower(): rl for rl in created if rl.person_name}
    for inp, role in zip(body.roles, created):
        if inp.reports_to:
            target = by_title.get(inp.reports_to.lower()) or by_name.get(inp.reports_to.lower())
            if target is not None and target.id != role.id:
                role.reports_to_role_id = target.id
    await session.commit()
    return await _graph(session, engagement_id)


@router.get("/engagements/{engagement_id}/org-chart", response_model=OrgChartResponse)
async def get_org_chart(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> OrgChartResponse:
    return await _graph(session, engagement_id)
