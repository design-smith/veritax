"""Class 3 · S16 — deterministic financial risk findings; each names its basis; nothing without Class 3 data."""
import io
import uuid

from openpyxl import Workbook

from app.financial_risks import financial_findings
from app.main import app


def _xlsx(cost) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 1000000, "QAR"])
    ws.append(["510100", "Salaries", "SERVICES", -cost, "QAR"])
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _dataset(client, eid, cost=950000):
    return (await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                              files={"file": ("tb.xlsx", _xlsx(cost), "application/octet-stream")})).json()["id"]


async def _findings(eid, jurisdiction="Netherlands"):
    async with app.state.session_factory() as session:
        return await financial_findings(session, uuid.UUID(eid), jurisdiction)


async def test_no_class3_data_yields_no_findings(client):
    eid = (await client.post("/engagements")).json()["id"]
    assert await _findings(eid) == []


async def test_reconciliation_gap_finding(client):
    eid = (await client.post("/engagements")).json()["id"]
    a = await _dataset(client, eid, cost=950000)
    b = await _dataset(client, eid, cost=750000)   # different total → unreconciled
    await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "FS to TB", "source": {"kind": "dataset", "id": a}, "target": {"kind": "dataset", "id": b}})
    findings = await _findings(eid)
    gap = next(f for f in findings if f.title.startswith("Financial reconciliation gap"))
    assert gap.kind == "discrepancy" and gap.evidence[0].reference.startswith("financial_reconciliations[")


async def test_unsupported_exclusion_finding(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid)
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules", json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    # An exclusion WITHOUT a reason → flagged; a reasoned one is fine.
    await client.post(f"/financial-segments/{seg}/adjustments", json={"adjustment_type": "exclude_non_operating", "adjustment_amount": -400000})
    await client.post(f"/financial-segments/{seg}/adjustments", json={"adjustment_type": "exclude_non_operating", "adjustment_amount": -100, "reason": "financing item"})
    findings = await _findings(eid)
    unsupported = [f for f in findings if f.title.startswith("Unsupported exclusion")]
    assert len(unsupported) == 1 and unsupported[0].kind == "exposure"


async def test_out_of_range_finding(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _dataset(client, eid, cost=980000)   # operating margin 2% (below the comparable range)
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules", json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "segment_id": seg, "tested_party_entity_id": "NL"})).json()["id"]
    await client.post(f"/tnmm-analyses/{a}/compute")
    bs = (await client.post(f"/tnmm-analyses/{a}/benchmark-sets", json={"source": "Orbis", "comparables": [
        {"company_name": f"C{i}", "accepted": True, "pli_values": [v]} for i, v in enumerate([0.05, 0.06, 0.07, 0.08])]})).json()["id"]
    await client.post(f"/benchmark-sets/{bs}/compute-range")
    findings = await _findings(eid)
    oor = next(f for f in findings if "below range" in f.title.lower())
    assert oor.kind == "exposure" and oor.evidence[0].reference.startswith("benchmark_results[")


async def test_missing_segmentation_finding(client):
    # A TNMM analysis with NO segment → economic summary is partial + segment gap → missing-segmentation finding.
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin", "tested_party_entity_id": "NL"})
    findings = await _findings(eid)
    assert any(f.title == "Missing financial segmentation" for f in findings)
