from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session
from ..models import WaitlistRequest
from ..schemas import WaitlistRequestCreate, WaitlistResponse

# Public (no auth) — reached from the demo's "Access Veritax" CTA. Registered without get_current_user.
router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistResponse)
async def create_waitlist_request(
    body: WaitlistRequestCreate,
    session: AsyncSession = Depends(get_session),
) -> WaitlistResponse:
    row = WaitlistRequest(
        name=body.name.strip(),
        country=body.country.strip(),
        email=body.email.strip(),
        company=body.company.strip(),
        lead_id=body.lead_id,
        attribution=body.attribution or {},
    )
    session.add(row)
    await session.commit()
    # Opaque internal id (never the email) — used as the PostHog distinct_id after identify().
    return WaitlistResponse(waitlist_user_id=f"waitlist_{row.id}")
