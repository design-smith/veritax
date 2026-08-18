"""Class 3 · S13 — TP adjustment: illustrative (target − current) × revenue to a practitioner-chosen target;
approval state; never auto-posted (§45-47)."""
import io

import pytest
from openpyxl import Workbook


def _xlsx(cost) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 1000000, "QAR"])
    ws.append(["510100", "Salaries", "SERVICES", -cost, "QAR"])
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


def _set(values):
    return {"source": "Orbis", "comparables": [
        {"company_name": f"C{i}", "accepted": True, "pli_values": [v]} for i, v in enumerate(values)]}


async def _analysis(client, cost):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                      files={"file": ("tb.xlsx", _xlsx(cost), "application/octet-stream")})
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "segment_id": seg})).json()["id"]
    await client.post(f"/tnmm-analyses/{a}/compute")
    return a


async def test_adjustment_to_median_is_deterministic(client):
    # cost 980,000 → op 20,000 on revenue 1,000,000 → tested margin 0.02 (below range).
    a = await _analysis(client, 980000)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.04, 0.05, 0.06, 0.07]))).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")   # median 0.055, tested 0.02 → below_range

    r = await client.post(f"/tnmm-analyses/{a}/tp-adjustment", json={"target_basis": "median", "currency": "QAR"})
    assert r.status_code == 201
    adj = r.json()
    assert adj["current_result"] == pytest.approx(0.02) and adj["target_result"] == pytest.approx(0.055)
    # (0.055 - 0.02) * 1,000,000 = 35,000
    assert adj["adjustment_amount"] == pytest.approx(35000.0)
    assert adj["status"] == "potential_adjustment" and adj["created_by"]


async def test_within_range_needs_no_adjustment(client):
    # cost 950,000 → tested margin 0.05, within [0.04..0.07] → none_required.
    a = await _analysis(client, 950000)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.04, 0.05, 0.06, 0.07]))).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")
    adj = (await client.post(f"/tnmm-analyses/{a}/tp-adjustment", json={"target_basis": "median"})).json()
    assert adj["status"] == "none_required"


async def test_approval_transitions_never_auto_posted(client):
    a = await _analysis(client, 980000)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.04, 0.05, 0.06, 0.07]))).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")
    adj = (await client.post(f"/tnmm-analyses/{a}/tp-adjustment", json={"target_basis": "median"})).json()
    assert adj["status"] == "potential_adjustment"          # not auto-confirmed/implemented
    confirmed = (await client.patch(f"/tp-adjustments/{adj['id']}", json={"status": "practitioner_confirmed"})).json()
    assert confirmed["status"] == "practitioner_confirmed"
    implemented = (await client.patch(f"/tp-adjustments/{adj['id']}", json={"status": "implemented"})).json()
    assert implemented["status"] == "implemented"


async def test_unknown_basis_and_status_rejected(client):
    a = await _analysis(client, 980000)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.04, 0.05, 0.06, 0.07]))).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")
    bad = await client.post(f"/tnmm-analyses/{a}/tp-adjustment", json={"target_basis": "vibes"})
    assert bad.status_code == 422
    adj = (await client.post(f"/tnmm-analyses/{a}/tp-adjustment", json={"target_basis": "median"})).json()
    bad_status = await client.patch(f"/tp-adjustments/{adj['id']}", json={"status": "posted"})
    assert bad_status.status_code == 422
