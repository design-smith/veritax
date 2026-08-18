"""Class 3 · S7 — adjustments: auditable amount adjustments layered on a segment's P&L; raw never mutated (§75)."""
import io

import pytest
from openpyxl import Workbook


def _xlsx() -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 18500000, "QAR"])   # operating
    ws.append(["510100", "Salaries", "SERVICES", -10000000, "QAR"]) # operating
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _segment_with_rows(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds = (await client.post(f"/engagements/{eid}/financial-datasets",
                            data={"dataset_type": "trial_balance"},
                            files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})).json()["id"]
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services", "currency": "QAR"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    return eid, ds, seg


async def test_adjustment_records_audit_and_reflects_in_pnl(client):
    eid, ds, seg = await _segment_with_rows(client)
    base = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert base["operating_result"] == pytest.approx(8500000.0)

    r = await client.post(f"/financial-segments/{seg}/adjustments", json={
        "adjustment_type": "exclude_non_operating", "adjustment_amount": -500000,
        "original_amount": 500000, "account_ref": "Relocation", "reason": "exceptional relocation, excluded"})
    assert r.status_code == 201
    adj = r.json()
    assert adj["adjustment_amount"] == pytest.approx(-500000.0) and adj["original_amount"] == pytest.approx(500000.0)
    assert adj["reason"] == "exceptional relocation, excluded"
    assert adj["created_by"] and adj["created_at"]                 # audit: user + timestamp

    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert pnl["adjustments_total"] == pytest.approx(-500000.0)
    assert pnl["adjusted_operating_result"] == pytest.approx(8000000.0)   # 8.5M - 0.5M
    assert pnl["operating_result"] == pytest.approx(8500000.0)             # base unchanged
    assert len(pnl["adjustments"]) == 1


async def test_raw_rows_never_mutated_by_adjustment(client):
    eid, ds, seg = await _segment_with_rows(client)
    await client.post(f"/financial-segments/{seg}/adjustments",
                      json={"adjustment_type": "manual_adjustment", "adjustment_amount": -123456})
    rows = (await client.get(f"/financial-datasets/{ds}/rows")).json()["rows"]
    assert len(rows) == 2
    assert {r["account_code"]: r["amount"] for r in rows} == {"500100": 18500000.0, "510100": -10000000.0}


async def test_delete_adjustment_reverts_adjusted_result(client):
    eid, ds, seg = await _segment_with_rows(client)
    adj = (await client.post(f"/financial-segments/{seg}/adjustments",
                             json={"adjustment_type": "gaap_adjustment", "adjustment_amount": -1000000})).json()
    assert (await client.get(f"/financial-segments/{seg}/pnl")).json()["adjusted_operating_result"] == pytest.approx(7500000.0)
    d = await client.delete(f"/financial-adjustments/{adj['id']}")
    assert d.status_code == 204
    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert pnl["adjustments"] == [] and pnl["adjusted_operating_result"] == pytest.approx(8500000.0)


async def test_unknown_adjustment_type_rejected(client):
    eid, ds, seg = await _segment_with_rows(client)
    r = await client.post(f"/financial-segments/{seg}/adjustments",
                          json={"adjustment_type": "bogus", "adjustment_amount": 1})
    assert r.status_code == 422
