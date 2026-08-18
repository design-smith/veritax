"""Class 3 · S14 — Requirements evaluates economic-analysis CAPABILITIES (not doc presence, §50-51)."""
import io
import uuid

from openpyxl import Workbook

from app.economic_coverage import economic_analysis_summary
from app.main import app


def _xlsx(cost=950000) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 1000000, "QAR"])
    ws.append(["510100", "Salaries", "SERVICES", -cost, "QAR"])
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _dataset(client, eid):
    return (await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                              files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})).json()["id"]


async def test_unknown_without_any_analysis(client):
    eid = (await client.post("/engagements")).json()["id"]
    async with app.state.session_factory() as session:
        summary = await economic_analysis_summary(session, uuid.UUID(eid))
    assert summary["status"] == "unknown" and summary["gaps"]


async def test_partial_when_benchmark_missing(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules", json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "segment_id": seg, "tested_party_entity_id": "QA"})
    async with app.state.session_factory() as session:
        summary = await economic_analysis_summary(session, uuid.UUID(eid))
    assert summary["status"] == "partial"
    assert summary["capabilities"]["tested_party_identified"] and summary["capabilities"]["financial_segment_available"]
    assert not summary["capabilities"]["benchmark_available"]
    assert any("comparable set" in g.lower() for g in summary["gaps"])


async def test_present_when_all_capabilities_met_and_rides_coverage(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds = await _dataset(client, eid)
    ds2 = await _dataset(client, eid)
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules", json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "segment_id": seg, "tested_party_entity_id": "QA"})).json()["id"]
    await client.post(f"/tnmm-analyses/{a}/compute")   # tested margin 0.05
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json={"source": "Orbis", "comparables": [
        {"company_name": f"C{i}", "accepted": True, "pli_values": [v]} for i, v in enumerate([0.03, 0.04, 0.06, 0.07])]})).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")   # within_range
    await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "FS -> TB", "source": {"kind": "dataset", "id": ds}, "target": {"kind": "dataset", "id": ds2}})

    async with app.state.session_factory() as session:
        summary = await economic_analysis_summary(session, uuid.UUID(eid))
    assert summary["status"] == "present" and summary["gaps"] == []
    assert all(summary["capabilities"].values())

    # And it rides the coverage response (Requirements view consumes it).
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Qatar"})).json()
    assert got["economic_analysis"]["status"] == "present"
