from __future__ import annotations

import json

from sqlalchemy import text

from app.main import app

DDL = """
create table if not exists public.companies (
  slug text primary key,
  index jsonb not null,
  profile jsonb, financials jsonb, footprint jsonb, ip jsonb, group_data jsonb,
  searched_at timestamptz, updated_at timestamptz default now()
)
"""


async def _seed():
    async with app.state.session_factory() as session:
        await session.execute(text(DDL))
        await session.execute(text("delete from public.companies"))
        for row in (
            {"slug": "toyota-motor-corp", "name": "Toyota Motor Corp", "ticker": "TM", "hq_country": "Japan", "keywords": "automotive"},
            {"slug": "apple-inc", "name": "Apple Inc.", "ticker": "AAPL", "hq_country": "United States", "keywords": "phones"},
        ):
            await session.execute(
                text("insert into public.companies (slug, index) values (:slug, cast(:index as jsonb))"),
                {"slug": row["slug"], "index": json.dumps(row)},
            )
        await session.commit()


async def test_search_is_public_and_finds_warehouse_names(raw_client):
    await _seed()
    res = await raw_client.get("/companies/search", params={"q": "toyota"})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["rows"][0]["slug"] == "toyota-motor-corp"


async def test_count_is_public(raw_client):
    await _seed()
    res = await raw_client.get("/companies/count")
    assert res.status_code == 200
    assert res.json()["count"] == 2


async def test_detail_column_is_public(raw_client):
    await _seed()
    res = await raw_client.get("/companies/apple-inc/index")
    assert res.status_code == 200
    assert res.json()["ticker"] == "AAPL"
