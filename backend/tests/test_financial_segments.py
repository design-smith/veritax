"""Class 3 · S6 — segments + segmented P&L: rule-based membership (incl. exclude-with-reason), a classification
rollup that drills to rows, multiple segments per entity, originals preserved."""
import io

import pytest
from openpyxl import Workbook


def _xlsx() -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    for row in [
        ["500100", "Revenue", "SERVICES", 18500000, "QAR"],       # operating
        ["510100", "Salaries", "SERVICES", -10000000, "QAR"],     # operating
        ["520100", "Rent expense", "SERVICES", -50000, "QAR"],    # operating
        ["700200", "Interest Expense", "SERVICES", -200000, "QAR"],# financing
        ["500200", "Revenue", "TRADING", 5000000, "QAR"],         # operating, other BU
    ]:
        ws.append(row)
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _dataset(client, eid) -> str:
    return (await client.post(f"/engagements/{eid}/financial-datasets",
                              data={"dataset_type": "trial_balance"},
                              files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})).json()["id"]


async def _segment(client, eid, name="Qatar Services") -> str:
    return (await client.post(f"/engagements/{eid}/financial-segments", json={"name": name, "currency": "QAR"})).json()["id"]


async def test_segmented_pnl_includes_and_excludes_with_reason(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    seg = await _segment(client, eid)
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES", "action": "include"})

    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    op = next(ln for ln in pnl["lines"] if ln["classification"] == "operating")
    assert op["total"] == pytest.approx(8450000.0) and op["row_count"] == 3
    assert any(ln["classification"] == "financing" and ln["total"] == pytest.approx(-200000.0) for ln in pnl["lines"])
    assert pnl["operating_result"] == pytest.approx(8450000.0)

    # Exclude the financing account from the tested segment, with a reason (§56).
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "account_code", "operator": "equals", "value": "700200",
                            "action": "exclude", "reason": "financing item, out of the tested segment"})
    pnl2 = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert not any(ln["classification"] == "financing" for ln in pnl2["lines"])
    assert pnl2["operating_result"] == pytest.approx(8450000.0) and pnl2["row_count"] == 3
    # The reason is preserved on the rule.
    detail = (await client.get(f"/financial-segments/{seg}")).json()
    excl = next(r for r in detail["rules"] if r["action"] == "exclude")
    assert excl["reason"] == "financing item, out of the tested segment"


async def test_segment_rows_drill_and_originals_preserved(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds = await _dataset(client, eid)
    seg = await _segment(client, eid)
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})

    rows = (await client.get(f"/financial-segments/{seg}/rows")).json()
    assert rows["total"] == 4
    assert {r["account_code"] for r in rows["rows"]} == {"500100", "510100", "520100", "700200"}

    # The underlying dataset still has all 5 rows with original amounts (segmenting never mutates rows, §9).
    all_rows = (await client.get(f"/financial-datasets/{ds}/rows")).json()["rows"]
    assert len(all_rows) == 5
    assert next(r for r in all_rows if r["account_code"] == "700200")["amount"] == pytest.approx(-200000.0)


async def test_multiple_segments_per_entity(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    services = await _segment(client, eid, "Qatar Services")
    trading = await _segment(client, eid, "Qatar Trading")
    await client.post(f"/financial-segments/{services}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    await client.post(f"/financial-segments/{trading}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "TRADING"})

    listed = (await client.get(f"/engagements/{eid}/financial-segments")).json()
    assert {s["name"] for s in listed} == {"Qatar Services", "Qatar Trading"}
    trading_pnl = (await client.get(f"/financial-segments/{trading}/pnl")).json()
    assert trading_pnl["operating_result"] == pytest.approx(5000000.0) and trading_pnl["row_count"] == 1


async def test_segment_with_no_include_rule_is_empty(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    seg = await _segment(client, eid)
    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert pnl["row_count"] == 0 and pnl["lines"] == []


async def test_invalid_rule_rejected(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    seg = await _segment(client, eid)
    bad = await client.post(f"/financial-segments/{seg}/rules",
                            json={"field": "widget", "operator": "equals", "value": "x"})
    assert bad.status_code == 422
    bad_op = await client.post(f"/financial-segments/{seg}/rules",
                               json={"field": "account_code", "operator": "regex", "value": "x"})
    assert bad_op.status_code == 422
