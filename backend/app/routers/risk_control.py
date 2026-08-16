"""Risk control & capability endpoints (Class 2 §12, §40): the per-risk control table."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session, require_engagement_owner
from ..models import Engagement, RiskControlProfile
from ..risk_control import upsert_risk_control
from ..schemas import RiskControlIngest, RiskControlRead, RiskControlResponse

router = APIRouter(tags=["risk-control"])


async def _table(session: AsyncSession, engagement_id: uuid.UUID) -> RiskControlResponse:
    rows = (
        await session.execute(
            select(RiskControlProfile).where(RiskControlProfile.engagement_id == engagement_id)
            .order_by(RiskControlProfile.created_at)
        )
    ).scalars().all()
    return RiskControlResponse(risks=[RiskControlRead.model_validate(r) for r in rows])


@router.post("/engagements/{engagement_id}/risk-control", response_model=RiskControlResponse, status_code=201)
async def set_risk_control(
    engagement_id: uuid.UUID,
    body: RiskControlIngest,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> RiskControlResponse:
    for item in body.items:
        await upsert_risk_control(
            session, engagement_id, transaction_id=item.transaction_id, risk_type=item.risk_type,
            contractual_bearer_entity_id=item.contractual_bearer_entity_id, exposed_entity_id=item.exposed_entity_id,
            decision_maker_entity_id=item.decision_maker_entity_id, control_entity_id=item.control_entity_id,
            capability_entity_id=item.capability_entity_id,
            financial_capacity_entity_id=item.financial_capacity_entity_id)
    await session.commit()
    return await _table(session, engagement_id)


@router.get("/engagements/{engagement_id}/risk-control", response_model=RiskControlResponse)
async def get_risk_control(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> RiskControlResponse:
    return await _table(session, engagement_id)
