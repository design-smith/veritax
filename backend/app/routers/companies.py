from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session

# Public — Stage 1 screening over public.companies (the 50k+ warehouse index). No login.
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

_CLASS_FIELDS = {
    "sic": ("sic", "sic_description"),
    "naics": ("naics", "naics"),
    "nace": ("nace", "nace"),
}

_FACET_KEYS = ("sector", "hq", "op", "subs", "region", "exchange", "std", "tags", "conf")

_SUBS_BANDS = (
    ("200+", "coalesce((index->>'n_subsidiaries')::int, 0) >= 200"),
    ("51–200", "coalesce((index->>'n_subsidiaries')::int, 0) between 51 and 199"),
    ("11–50", "coalesce((index->>'n_subsidiaries')::int, 0) between 11 and 50"),
    ("1–10", "coalesce((index->>'n_subsidiaries')::int, 0) between 1 and 10"),
    ("None", "coalesce((index->>'n_subsidiaries')::int, 0) = 0"),
)


def _needle(q: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[%_\\]", " ", q)).strip()


def _csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        v = part.strip()
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out[:40]


def _text_clause(alias: str = "index") -> str:
    a = alias
    return f"""(
  {a}->>'name' ilike :pat
  or coalesce({a}->>'ticker','') ilike :pat
  or coalesce({a}->>'keywords','') ilike :pat
  or coalesce({a}->>'hq_country','') ilike :pat
  or coalesce({a}->>'hq_region','') ilike :pat
  or coalesce({a}->>'sector','') ilike :pat
  or coalesce({a}->>'sic','') ilike :pat
  or coalesce({a}->>'sic_description','') ilike :pat
  or coalesce({a}->>'naics','') ilike :pat
  or coalesce({a}->>'nace','') ilike :pat
  or coalesce({a}->>'exchange','') ilike :pat
  or slug ilike :pat
)"""


def _class_clause(scheme: str, codes: list[str], bind: dict[str, Any], prefix: str) -> str | None:
    field, _ = _CLASS_FIELDS.get(scheme, _CLASS_FIELDS["sic"])
    if not codes:
        return None
    parts: list[str] = []
    for i, code in enumerate(codes):
        key = f"{prefix}{i}"
        bind[key] = code.lower()
        # Prefix match so SIC "357" hits 3571; exact chips still work.
        parts.append(f"lower(coalesce(index->>'{field}','')) like :{key} || '%'")
    return "(" + " OR ".join(parts) + ")"


def _inc_exc_scalar(field_sql: str, inc: list[str], exc: list[str], bind: dict[str, Any], prefix: str) -> list[str]:
    clauses: list[str] = []
    if inc:
        keys = []
        for i, v in enumerate(inc):
            k = f"{prefix}i{i}"
            bind[k] = v
            keys.append(f":{k}")
        clauses.append(f"{field_sql} in ({', '.join(keys)})")
    if exc:
        keys = []
        for i, v in enumerate(exc):
            k = f"{prefix}e{i}"
            bind[k] = v
            keys.append(f":{k}")
        clauses.append(f"coalesce({field_sql}, '') not in ({', '.join(keys)})")
    return clauses


def _array_overlap(json_field: str, values: list[str], bind: dict[str, Any], prefix: str, negate: bool = False) -> str | None:
    if not values:
        return None
    keys = []
    for i, v in enumerate(values):
        k = f"{prefix}{i}"
        bind[k] = v
        keys.append(f":{k}")
    arr = f"array[{', '.join(keys)}]::text[]"
    # ?| → jsonb has any of the strings as top-level keys; for arrays use ?| on jsonb array of strings.
    # Prefer EXISTS over jsonb_array_elements for planner friendliness.
    exists = (
        f"exists (select 1 from jsonb_array_elements_text(coalesce(index->'{json_field}', '[]'::jsonb)) t "
        f"where t = any({arr}))"
    )
    return f"not {exists}" if negate else exists


def _subs_clause(inc: list[str], exc: list[str]) -> list[str]:
    band = {name: sql for name, sql in _SUBS_BANDS}
    clauses: list[str] = []
    if inc:
        parts = [band[v] for v in inc if v in band]
        if parts:
            clauses.append("(" + " OR ".join(parts) + ")")
    if exc:
        parts = [band[v] for v in exc if v in band]
        if parts:
            clauses.append("not (" + " OR ".join(parts) + ")")
    return clauses


def build_where(
    *,
    q: str = "",
    scheme: str = "sic",
    class_codes: list[str] | None = None,
    hq: list[str] | None = None,
    hq_exc: list[str] | None = None,
    op: list[str] | None = None,
    op_exc: list[str] | None = None,
    sector: list[str] | None = None,
    sector_exc: list[str] | None = None,
    region: list[str] | None = None,
    region_exc: list[str] | None = None,
    exchange: list[str] | None = None,
    exchange_exc: list[str] | None = None,
    std: list[str] | None = None,
    std_exc: list[str] | None = None,
    tags: list[str] | None = None,
    tags_exc: list[str] | None = None,
    conf: list[str] | None = None,
    conf_exc: list[str] | None = None,
    subs: list[str] | None = None,
    subs_exc: list[str] | None = None,
    rev_min: float | None = None,
    rev_max: float | None = None,
    has_rnd: bool = False,
    has_patents: bool = False,
    has_intl: bool = False,
) -> tuple[str, dict[str, Any]]:
    clauses: list[str] = []
    bind: dict[str, Any] = {}

    needle = _needle(q)
    if needle:
        bind["pat"] = f"%{needle}%"
        bind["exact"] = needle
        clauses.append(_text_clause())

    scheme_key = scheme if scheme in _CLASS_FIELDS else "sic"
    class_sql = _class_clause(scheme_key, class_codes or [], bind, "cls")
    if class_sql:
        clauses.append(class_sql)

    clauses.extend(_inc_exc_scalar("index->>'hq_country'", hq or [], hq_exc or [], bind, "hq"))
    clauses.extend(_inc_exc_scalar("index->>'sector'", sector or [], sector_exc or [], bind, "sec"))
    clauses.extend(_inc_exc_scalar("index->>'hq_region'", region or [], region_exc or [], bind, "reg"))
    clauses.extend(_inc_exc_scalar("index->>'exchange'", exchange or [], exchange_exc or [], bind, "ex"))
    clauses.extend(_inc_exc_scalar("index->>'accounting_standard'", std or [], std_exc or [], bind, "std"))
    clauses.extend(_inc_exc_scalar("index->>'confidence'", conf or [], conf_exc or [], bind, "cnf"))
    clauses.extend(_subs_clause(subs or [], subs_exc or []))

    op_inc = _array_overlap("op_countries", op or [], bind, "opi")
    if op_inc:
        clauses.append(op_inc)
    op_ex = _array_overlap("op_countries", op_exc or [], bind, "ope", negate=True)
    if op_ex:
        clauses.append(op_ex)
    tag_inc = _array_overlap("activity_tags", tags or [], bind, "tgi")
    if tag_inc:
        clauses.append(tag_inc)
    tag_ex = _array_overlap("activity_tags", tags_exc or [], bind, "tge", negate=True)
    if tag_ex:
        clauses.append(tag_ex)

    if rev_min is not None:
        bind["rev_min"] = rev_min
        clauses.append("(index->>'revenue_latest') is not null and (index->>'revenue_latest')::float8 >= :rev_min")
    if rev_max is not None:
        bind["rev_max"] = rev_max
        clauses.append("(index->>'revenue_latest') is not null and (index->>'revenue_latest')::float8 <= :rev_max")
    if has_rnd:
        clauses.append("coalesce((index->>'has_rnd')::boolean, false) = true")
    if has_patents:
        clauses.append("coalesce((index->>'has_patents')::boolean, false) = true")
    if has_intl:
        clauses.append("coalesce((index->>'has_international')::boolean, false) = true")

    where = " AND ".join(clauses) if clauses else "true"
    return where, bind


def _screen_params(
    q: str,
    scheme: str,
    class_codes: str | None,
    hq: str | None,
    hq_exc: str | None,
    op: str | None,
    op_exc: str | None,
    sector: str | None,
    sector_exc: str | None,
    region: str | None,
    region_exc: str | None,
    exchange: str | None,
    exchange_exc: str | None,
    std: str | None,
    std_exc: str | None,
    tags: str | None,
    tags_exc: str | None,
    conf: str | None,
    conf_exc: str | None,
    subs: str | None,
    subs_exc: str | None,
    rev_min: float | None,
    rev_max: float | None,
    has_rnd: bool,
    has_patents: bool,
    has_intl: bool,
) -> tuple[str, dict[str, Any]]:
    return build_where(
        q=q,
        scheme=scheme,
        class_codes=_csv(class_codes),
        hq=_csv(hq),
        hq_exc=_csv(hq_exc),
        op=_csv(op),
        op_exc=_csv(op_exc),
        sector=_csv(sector),
        sector_exc=_csv(sector_exc),
        region=_csv(region),
        region_exc=_csv(region_exc),
        exchange=_csv(exchange),
        exchange_exc=_csv(exchange_exc),
        std=_csv(std),
        std_exc=_csv(std_exc),
        tags=_csv(tags),
        tags_exc=_csv(tags_exc),
        conf=_csv(conf),
        conf_exc=_csv(conf_exc),
        subs=_csv(subs),
        subs_exc=_csv(subs_exc),
        rev_min=rev_min,
        rev_max=rev_max,
        has_rnd=has_rnd,
        has_patents=has_patents,
        has_intl=has_intl,
    )


def _row_from(slug: str, idx: Any) -> dict[str, Any] | None:
    if not idx:
        return None
    if isinstance(idx, dict):
        return {**idx, "slug": idx.get("slug") or slug}
    return None


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
    q: str = Query("", max_length=80),
    scheme: str = Query("sic"),
    class_codes: str | None = Query(None, description="Comma-separated classification codes"),
    hq: str | None = None,
    hq_exc: str | None = None,
    op: str | None = None,
    op_exc: str | None = None,
    sector: str | None = None,
    sector_exc: str | None = None,
    region: str | None = None,
    region_exc: str | None = None,
    exchange: str | None = None,
    exchange_exc: str | None = None,
    std: str | None = None,
    std_exc: str | None = None,
    tags: str | None = None,
    tags_exc: str | None = None,
    conf: str | None = None,
    conf_exc: str | None = None,
    subs: str | None = None,
    subs_exc: str | None = None,
    rev_min: float | None = Query(None, ge=0),
    rev_max: float | None = Query(None, ge=0),
    has_rnd: bool = False,
    has_patents: bool = False,
    has_intl: bool = False,
    sort: str = Query("revenue"),
    limit: int = Query(250, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Screen the warehouse. `q` is optional when other criteria are present."""
    where, bind = _screen_params(
        q, scheme, class_codes, hq, hq_exc, op, op_exc, sector, sector_exc,
        region, region_exc, exchange, exchange_exc, std, std_exc, tags, tags_exc,
        conf, conf_exc, subs, subs_exc, rev_min, rev_max, has_rnd, has_patents, has_intl,
    )
    if where == "true" and not _needle(q):
        # Empty screen = full universe page (revenue-ranked), still useful for idle→active.
        where = "true"
        bind = {}

    order = {
        "name": "index->>'name' asc nulls last",
        "ticker": "index->>'ticker' asc nulls last",
        "hq": "index->>'hq_country' asc nulls last",
        "sector": "index->>'sector' asc nulls last",
        "class": f"index->>'{_CLASS_FIELDS.get(scheme, _CLASS_FIELDS['sic'])[0]}' asc nulls last",
        "revenue": "coalesce((index->>'revenue_latest')::float8, -1) desc nulls last",
    }.get(sort, "coalesce((index->>'revenue_latest')::float8, -1) desc nulls last")

    if "exact" in bind:
        order = f"""
          case
            when lower(coalesce(index->>'ticker','')) = lower(:exact) then 0
            when lower(coalesce(index->>'name','')) = lower(:exact) then 1
            when lower(coalesce(index->>'name','')) like lower(:exact) || '%' then 2
            when lower(coalesce(index->>'sic','')) = lower(:exact) then 3
            else 4
          end,
          {order}
        """

    bind["lim"] = limit
    count_sql = text(f"select count(*) from public.companies where {where}")  # noqa: S608
    search_sql = text(  # noqa: S608
        f"select slug, index from public.companies where {where} order by {order} limit :lim"
    )
    try:
        total = (await session.execute(count_sql, bind)).scalar_one()
        rows = []
        for slug, idx in (await session.execute(search_sql, bind)).all():
            row = _row_from(slug, idx)
            if row:
                rows.append(row)
    except ProgrammingError:
        await session.rollback()
        return {"total": 0, "rows": []}
    return {"total": int(total or 0), "rows": rows}


@router.get("/facets")
async def company_facets(
    q: str = Query("", max_length=80),
    scheme: str = Query("sic"),
    class_codes: str | None = None,
    hq: str | None = None,
    hq_exc: str | None = None,
    op: str | None = None,
    op_exc: str | None = None,
    sector: str | None = None,
    sector_exc: str | None = None,
    region: str | None = None,
    region_exc: str | None = None,
    exchange: str | None = None,
    exchange_exc: str | None = None,
    std: str | None = None,
    std_exc: str | None = None,
    tags: str | None = None,
    tags_exc: str | None = None,
    conf: str | None = None,
    conf_exc: str | None = None,
    subs: str | None = None,
    subs_exc: str | None = None,
    rev_min: float | None = Query(None, ge=0),
    rev_max: float | None = Query(None, ge=0),
    has_rnd: bool = False,
    has_patents: bool = False,
    has_intl: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Facet buckets under the current screen (warehouse-wide when empty)."""
    where, bind = _screen_params(
        q, scheme, class_codes, hq, hq_exc, op, op_exc, sector, sector_exc,
        region, region_exc, exchange, exchange_exc, std, std_exc, tags, tags_exc,
        conf, conf_exc, subs, subs_exc, rev_min, rev_max, has_rnd, has_patents, has_intl,
    )
    out: dict[str, list[list[Any]]] = {k: [] for k in _FACET_KEYS}
    try:
        # Scalar facets
        for key, expr in (
            ("sector", "nullif(index->>'sector','')"),
            ("hq", "nullif(index->>'hq_country','')"),
            ("region", "nullif(index->>'hq_region','')"),
            ("exchange", "nullif(index->>'exchange','')"),
            ("std", "nullif(index->>'accounting_standard','')"),
            ("conf", "nullif(index->>'confidence','')"),
        ):
            sql = text(  # noqa: S608
                f"""
                select {expr} as v, count(*)::int as n
                from public.companies
                where {where} and {expr} is not null
                group by 1
                order by n desc, v asc
                limit 80
                """
            )
            out[key] = [[r[0], int(r[1])] for r in (await session.execute(sql, bind)).all()]

        # Array facets
        for key, field in (("op", "op_countries"), ("tags", "activity_tags")):
            sql = text(  # noqa: S608
                f"""
                select t as v, count(*)::int as n
                from public.companies,
                     lateral jsonb_array_elements_text(coalesce(index->'{field}', '[]'::jsonb)) as t
                where {where}
                group by 1
                order by n desc, v asc
                limit 80
                """
            )
            out[key] = [[r[0], int(r[1])] for r in (await session.execute(sql, bind)).all()]

        # Subsidiary bands
        subs_rows: list[list[Any]] = []
        for name, band_sql in _SUBS_BANDS:
            sql = text(f"select count(*) from public.companies where {where} and ({band_sql})")  # noqa: S608
            n = (await session.execute(sql, bind)).scalar_one()
            if int(n or 0):
                subs_rows.append([name, int(n)])
        out["subs"] = subs_rows
    except ProgrammingError:
        await session.rollback()
        return out
    return out


@router.get("/class-codes")
async def company_class_codes(
    scheme: str = Query("sic"),
    q: str = Query("", max_length=80),
    limit: int = Query(40, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Distinct warehouse classification codes for typeahead (with counts + labels)."""
    scheme_key = scheme if scheme in _CLASS_FIELDS else "sic"
    code_f, label_f = _CLASS_FIELDS[scheme_key]
    needle = _needle(q).lower()
    bind: dict[str, Any] = {"lim": limit}
    where = f"nullif(index->>'{code_f}','') is not null"
    if needle:
        bind["pat"] = f"{needle}%"
        bind["pat2"] = f"%{needle}%"
        where += (
            f" and (lower(index->>'{code_f}') like :pat"
            f" or lower(coalesce(index->>'{label_f}','')) like :pat2)"
        )
    sql = text(  # noqa: S608
        f"""
        select
          index->>'{code_f}' as code,
          max(nullif(index->>'{label_f}','')) as label,
          count(*)::int as n
        from public.companies
        where {where}
        group by 1
        order by
          case
            when :has_q and lower(index->>'{code_f}') = :exact then 0
            when :has_q and lower(index->>'{code_f}') like :pat then 1
            else 2
          end,
          count(*) desc,
          index->>'{code_f}' asc
        limit :lim
        """
    )
    bind["has_q"] = bool(needle)
    bind["exact"] = needle
    if "pat" not in bind:
        bind["pat"] = ""
    try:
        rows = [
            {"code": r[0], "label": (r[1] if r[1] and r[1] != r[0] else "") or "", "n": int(r[2])}
            for r in (await session.execute(sql, bind)).all()
            if r[0]
        ]
    except ProgrammingError:
        await session.rollback()
        return {"scheme": scheme_key, "rows": []}
    return {"scheme": scheme_key, "rows": rows}


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
