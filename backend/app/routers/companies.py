from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session

# Public — Stage 1 search over public.companies (the 50k+ warehouse index). No login.
router = APIRouter(prefix="/companies", tags=["companies"])

_DETAIL = {
    "index": "index",
    "profile": "profile",
    "financials": "financials",
    "footprint": "footprint",
    "ip": "ip",
    "group": "group_data",
    "group_data": "group_data",
}

_COUNT = text("select count(*) from public.companies")
_COUNT_MATCH = text("""
select count(*) from public.companies
where index->>'name' ilike :pat
   or coalesce(index->>'ticker','') ilike :pat
   or coalesce(index->>'keywords','') ilike :pat
   or coalesce(index->>'hq_country','') ilike :pat
   or coalesce(index->>'hq_region','') ilike :pat
   or coalesce(index->>'sector','') ilike :pat
   or coalesce(index->>'sic_description','') ilike :pat
   or coalesce(index->>'exchange','') ilike :pat
   or slug ilike :pat
""")
_SEARCH = text("""
select slug, index from public.companies
where index->>'name' ilike :pat
   or coalesce(index->>'ticker','') ilike :pat
   or coalesce(index->>'keywords','') ilike :pat
   or coalesce(index->>'hq_country','') ilike :pat
   or coalesce(index->>'hq_region','') ilike :pat
   or coalesce(index->>'sector','') ilike :pat
   or coalesce(index->>'sic_description','') ilike :pat
   or coalesce(index->>'exchange','') ilike :pat
   or slug ilike :pat
order by
  case
    when lower(coalesce(index->>'ticker','')) = lower(:exact) then 0
    when lower(coalesce(index->>'name','')) = lower(:exact) then 1
    when lower(coalesce(index->>'name','')) like lower(:exact) || '%' then 2
    else 3
  end,
  index->>'name'
limit :lim
""")


def _needle(q: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[%_\\]", " ", q)).strip()


@router.get("/count")
async def company_count(session: AsyncSession = Depends(get_session)) -> dict:
    try:
        n = (await session.execute(_COUNT)).scalar_one()
    except ProgrammingError:
        await session.rollback()
        return {"count": 0}
    return {"count": int(n or 0)}


@router.get("/search")
async def company_search(
    q: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(250, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> dict:
    needle = _needle(q)
    if not needle:
        return {"total": 0, "rows": []}
    params = {"pat": f"%{needle}%", "exact": needle, "lim": limit}
    try:
        total = (await session.execute(_COUNT_MATCH, params)).scalar_one()
        rows = []
        for slug, idx in (await session.execute(_SEARCH, params)).all():
            if not idx:
                continue
            if isinstance(idx, dict) and not idx.get("slug"):
                idx = {**idx, "slug": slug}
            rows.append(idx)
    except ProgrammingError:
        await session.rollback()
        return {"total": 0, "rows": []}
    return {"total": int(total or 0), "rows": rows}


@router.get("/{slug}/{column}")
async def company_column(
    slug: str,
    column: str,
    session: AsyncSession = Depends(get_session),
) -> object:
    col = _DETAIL.get(column)
    if col is None:
        raise HTTPException(status_code=404, detail="unknown column")
    sql = text(f"select {col} from public.companies where slug = :slug")  # noqa: S608 - whitelist
    try:
        value = (await session.execute(sql, {"slug": slug})).scalar_one_or_none()
    except ProgrammingError:
        await session.rollback()
        raise HTTPException(status_code=404, detail="company not found") from None
    if value is None:
        raise HTTPException(status_code=404, detail="company not found")
    return value
