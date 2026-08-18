"""Class 3 · S8 — allocations: shared-cost split by a base + %, computed server-side, with full provenance."""
import io

import pytest
from openpyxl import Workbook


def _xlsx() -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 18500000, "QAR"])
    ws.append(["510100", "Salaries", "SERVICES", -10000000, "QAR"])
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _segment(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                      files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services", "currency": "QAR"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    return seg


async def test_allocation_computed_server_side_with_provenance(client):
    seg = await _segment(client)
    r = await client.post(f"/financial-segments/{seg}/allocations", json={
        "cost_pool": "Group IT costs", "pool_amount": 2000000, "allocation_base": "headcount",
        "allocation_percentage": 35, "source": "HR headcount schedule FY2025", "reason": "shared IT"})
    assert r.status_code == 201
    a = r.json()
    assert a["allocated_amount"] == pytest.approx(700000.0)          # 2,000,000 × 35% computed by the server
    assert a["allocation_base"] == "headcount" and a["source"] == "HR headcount schedule FY2025"
    assert a["created_by"] and a["created_at"]


async def test_client_supplied_result_is_ignored(client):
    # Even if a client tries to sneak an allocated_amount, the server recomputes from pool × percentage (§74).
    seg = await _segment(client)
    a = (await client.post(f"/financial-segments/{seg}/allocations", json={
        "cost_pool": "IT", "pool_amount": 1000, "allocation_base": "revenue",
        "allocation_percentage": 10, "allocated_amount": 999999})).json()
    assert a["allocated_amount"] == pytest.approx(100.0)


async def test_allocation_reflected_in_adjusted_result(client):
    seg = await _segment(client)  # base operating result = 8,500,000
    await client.post(f"/financial-segments/{seg}/allocations", json={
        "cost_pool": "Group IT", "pool_amount": 2000000, "allocation_base": "headcount", "allocation_percentage": 35})
    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert pnl["allocations_total"] == pytest.approx(700000.0)
    assert pnl["adjusted_operating_result"] == pytest.approx(9200000.0)   # 8.5M + 0.7M allocation
    assert len(pnl["allocations"]) == 1 and pnl["allocations"][0]["cost_pool"] == "Group IT"


async def test_delete_allocation(client):
    seg = await _segment(client)
    a = (await client.post(f"/financial-segments/{seg}/allocations", json={
        "cost_pool": "IT", "pool_amount": 1000, "allocation_base": "revenue", "allocation_percentage": 10})).json()
    assert (await client.delete(f"/financial-allocations/{a['id']}")).status_code == 204
    pnl = (await client.get(f"/financial-segments/{seg}/pnl")).json()
    assert pnl["allocations"] == [] and pnl["allocations_total"] == pytest.approx(0.0)


async def test_invalid_allocation_base_rejected(client):
    seg = await _segment(client)
    r = await client.post(f"/financial-segments/{seg}/allocations", json={
        "cost_pool": "IT", "pool_amount": 1000, "allocation_base": "vibes", "allocation_percentage": 10})
    assert r.status_code == 422
