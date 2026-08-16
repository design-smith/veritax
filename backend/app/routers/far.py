"""FAR read endpoint (Class 2 §28-31): the aggregated functional profile + deterministic characterization."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session, require_engagement_owner
from ..far_builder import build_far_profile, derive_characterization
from ..models import Engagement

router = APIRouter(tags=["far"])


@router.get("/engagements/{engagement_id}/far")
async def get_far(
    engagement_id: uuid.UUID,
    transaction_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> dict:
    profile = await build_far_profile(session, engagement_id, transaction_id=transaction_id)
    return {"profile": profile, "characterization": derive_characterization(profile)}
