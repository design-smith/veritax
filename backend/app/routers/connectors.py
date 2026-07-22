from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session
from ..models import Connector
from ..schemas import ConnectorRead

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("", response_model=list[ConnectorRead])
async def list_connectors(session: AsyncSession = Depends(get_session)) -> list[Connector]:
    rows = (
        await session.execute(select(Connector).order_by(Connector.category, Connector.display_name))
    ).scalars().all()
    return list(rows)
