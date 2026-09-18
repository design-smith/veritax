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
            {
                "slug": "toyota-motor-corp",
                "name": "Toyota Motor Corp",
                "ticker": "TM",
                "hq_country": "Japan",
                "hq_region": "Asia",
                "sector": "Manufacturing",
                "sic": "3711",
                "sic_description": "Motor Vehicles and Passenger Car Bodies",
                "naics": "336",
                "nace": "C29",
                "keywords": "automotive",
                "op_countries": ["JP", "US"],
                "activity_tags": ["Manufacturing"],
                "revenue_latest": 200e9,
                "has_rnd": True,
                "has_patents": True,
                "has_international": True,
                "n_subsidiaries": 80,
                "exchange": "NYSE",
                "accounting_standard": "US-GAAP",
                "confidence": "high",
            },
            {
                "slug": "apple-inc",
                "name": "Apple Inc.",
                "ticker": "AAPL",
                "hq_country": "United States",
                "hq_region": "Americas",
                "sector": "Manufacturing",
                "sic": "3571",
                "sic_description": "Electronic Computers",
                "naics": "333",
                "nace": "C28",
                "keywords": "phones",
                "op_countries": ["US", "IE"],
                "activity_tags": ["Manufacturing", "Services"],
                "revenue_latest": 400e9,
                "has_rnd": True,
                "has_patents": True,
                "has_international": True,
                "n_subsidiaries": 24,
                "exchange": "Nasdaq",
                "accounting_standard": "US-GAAP",
                "confidence": "high",
            },
            {
                "slug": "sotoh-co-ltd",
                "name": "SOTOH CO.,LTD.",
                "ticker": "3571",
                "hq_country": "JP",
                "hq_region": "Other",
                "sector": None,
                "sic": None,
                "sic_description": None,
                "keywords": "",
                "op_countries": [],
                "activity_tags": [],
                "revenue_latest": None,
                "has_rnd": False,
                "has_patents": False,
                "has_international": False,
                "n_subsidiaries": 0,
                "exchange": "JP",
                "accounting_standard": "US-GAAP",
                "confidence": "low",
            },
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


async def test_search_matches_sic_code_not_just_ticker(raw_client):
    await _seed()
    res = await raw_client.get("/companies/search", params={"q": "3571"})
    assert res.status_code == 200
    body = res.json()
    slugs = {r["slug"] for r in body["rows"]}
    assert "apple-inc" in slugs
    # ticker collision still allowed, but SIC hit must be present
    assert body["total"] >= 1


async def test_search_filters_by_class_codes(raw_client):
    await _seed()
    res = await raw_client.get("/companies/search", params={"class_codes": "3571", "scheme": "sic"})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["rows"][0]["slug"] == "apple-inc"


async def test_search_filters_by_hq(raw_client):
    await _seed()
    res = await raw_client.get("/companies/search", params={"hq": "Japan"})
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["rows"][0]["slug"] == "toyota-motor-corp"


async def test_class_codes_typeahead(raw_client):
    await _seed()
    res = await raw_client.get("/companies/class-codes", params={"scheme": "sic", "q": "357"})
    assert res.status_code == 200
    body = res.json()
    codes = {r["code"] for r in body["rows"]}
    assert "3571" in codes
    apple = next(r for r in body["rows"] if r["code"] == "3571")
    assert apple["n"] == 1
    assert "Electronic" in apple["label"]


async def test_facets_under_screen(raw_client):
    await _seed()
    res = await raw_client.get("/companies/facets", params={"sector": "Manufacturing"})
    assert res.status_code == 200
    body = res.json()
    hq = {v: n for v, n in body["hq"]}
    assert hq.get("United States") == 1
    assert hq.get("Japan") == 1


async def test_count_is_public(raw_client):
    await _seed()
    res = await raw_client.get("/companies/count")
    assert res.status_code == 200
    assert res.json()["count"] == 3


async def test_detail_column_is_public(raw_client):
    await _seed()
    res = await raw_client.get("/companies/apple-inc/index")
    assert res.status_code == 200
    assert res.json()["ticker"] == "AAPL"
