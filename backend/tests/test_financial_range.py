"""Class 3 · S12 — arm's-length range & conclusion: reuses the Class 1 engine; deterministic within/below/above."""
import io

import pytest
from openpyxl import Workbook


def _xlsx() -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 1000000, "QAR"])
    ws.append(["510100", "Salaries", "SERVICES", -950000, "QAR"])   # operating margin 5%
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _analysis_with_tested_result(client, *, compute=True):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                      files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "segment_id": seg})).json()["id"]
    if compute:
        await client.post(f"/tnmm-analyses/{a}/compute")   # tested operating margin = 0.05
    return a


def _set(values_per_company, accepted=True):
    return {"source": "Orbis", "comparables": [
        {"company_name": f"C{i}", "accepted": accepted, "pli_values": [v]} for i, v in enumerate(values_per_company)
    ]}


async def test_within_range_uses_class1_engine(client):
    a = await _analysis_with_tested_result(client)           # tested 0.05
    # 6 comparables 0.03..0.08 → IQR straddles 0.05 → within.
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.03, 0.04, 0.045, 0.055, 0.06, 0.08]))).json()["id"]
    r = (await client.post(f"/benchmark-sets/{bs}/compute-range")).json()
    assert r["n"] == 6 and r["lower_quartile"] is not None and r["upper_quartile"] is not None
    assert r["median"] is not None and "interquartile_range" in r["statistical_method"]
    assert r["tested_result"] == pytest.approx(0.05) and r["position"] == "within_range"


async def test_below_range(client):
    a = await _analysis_with_tested_result(client)           # tested 0.05
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.10, 0.11, 0.12, 0.13, 0.14, 0.15]))).json()["id"]
    r = (await client.post(f"/benchmark-sets/{bs}/compute-range")).json()
    assert r["position"] == "below_range"


async def test_insufficient_data_when_too_few_comparables(client):
    a = await _analysis_with_tested_result(client)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.04, 0.05]))).json()["id"]   # < 4 for IQR
    r = (await client.post(f"/benchmark-sets/{bs}/compute-range")).json()
    assert r["position"] == "insufficient_data"


async def test_review_required_without_tested_result(client):
    a = await _analysis_with_tested_result(client, compute=False)   # no TNMM calc yet
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.03, 0.04, 0.06, 0.08]))).json()["id"]
    r = (await client.post(f"/benchmark-sets/{bs}/compute-range")).json()
    assert r["tested_result"] is None and r["position"] == "review_required"


async def test_range_persisted_and_fetchable(client):
    a = await _analysis_with_tested_result(client)
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json=_set([0.03, 0.04, 0.06, 0.08]))).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")
    latest = (await client.get(f"/benchmark-sets/{bs}/range")).json()
    assert latest is not None and latest["position"] in ("within_range", "below_range", "above_range")
