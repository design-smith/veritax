"""Class 3 · S10 — TNMM core: deterministic PLI from the tested party's segment; practitioner-selected tested
party with a FAR-linked rationale; inputs inspectable + traceable."""
import io
import uuid

import pytest
from openpyxl import Workbook

from app.financial_tnmm import compute_pli
from app.main import app
from app.models import CanonicalFact


# ── Pure PLI registry ─────────────────────────────────────────────────────────
def test_pli_formulas_and_undetermined():
    assert compute_pli("operating_margin", revenue=1000, operating_profit=100, total_costs=900) == pytest.approx(0.1)
    assert compute_pli("full_cost_markup", revenue=1000, operating_profit=100, total_costs=900) == pytest.approx(100 / 900)
    # No revenue → undetermined, not a fabricated number.
    assert compute_pli("operating_margin", revenue=0, operating_profit=100, total_costs=0) is None
    # v1 has no gross-profit / assets inputs → undetermined.
    assert compute_pli("berry_ratio", revenue=1000, operating_profit=100, total_costs=900) is None
    assert compute_pli("return_on_assets", revenue=1000, operating_profit=100, total_costs=900) is None


# ── Integration ───────────────────────────────────────────────────────────────
def _xlsx() -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    ws.append(["500100", "Revenue", "SERVICES", 1000000, "QAR"])     # operating income
    ws.append(["510100", "Salaries", "SERVICES", -900000, "QAR"])    # operating cost
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _engagement_with_segment(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                      files={"file": ("tb.xlsx", _xlsx(), "application/octet-stream")})
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services", "currency": "QAR"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    return eid, seg


async def test_operating_margin_computed_deterministically_and_traceable(client):
    eid, seg = await _engagement_with_segment(client)
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={
        "pli_type": "operating_margin", "segment_id": seg,
        "tested_party_entity_id": "QA", "tested_party_rationale": "routine service provider"})).json()
    assert a["tested_party_entity_id"] == "QA" and a["tested_party_selected_by"]     # practitioner-selected (§31)

    got = (await client.post(f"/tnmm-analyses/{a['id']}/compute")).json()
    calc = got["calculation"]
    assert calc["revenue"] == pytest.approx(1000000.0)                    # inputs trace to the segment
    assert calc["operating_profit"] == pytest.approx(100000.0)           # 1,000,000 - 900,000
    assert calc["total_costs"] == pytest.approx(900000.0)
    assert calc["pli_value"] == pytest.approx(0.1)                       # operating margin 10%


async def test_far_characterization_surfaced_for_tested_party(client):
    eid, seg = await _engagement_with_segment(client)
    # Seed a Class 2 functional fact so the FAR characterization is non-trivial.
    async with app.state.session_factory() as session:
        session.add(CanonicalFact(
            engagement_id=uuid.UUID(eid), fact_type="function_performed", value_normalized="true",
            value_type="boolean", scope_level="local_entity", far_type="distribution",
            evidence_type="functional_interview", canonical_key=f"k-{uuid.uuid4().hex[:8]}"))
        await session.commit()
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={
        "pli_type": "operating_margin", "segment_id": seg, "tested_party_entity_id": "QA"})).json()
    assert a["far_characterization"] in ("limited_risk_distributor", "full_fledged_distributor")


async def test_full_cost_markup_and_lifecycle(client):
    eid, seg = await _engagement_with_segment(client)
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "full_cost_markup", "segment_id": seg})).json()
    got = (await client.post(f"/tnmm-analyses/{a['id']}/compute")).json()
    assert got["calculation"]["pli_value"] == pytest.approx(100000.0 / 900000.0)
    # Lifecycle status update.
    patched = (await client.patch(f"/tnmm-analyses/{a['id']}", json={"status": "complete"})).json()
    assert patched["status"] == "complete"


async def test_unknown_pli_and_missing_segment_rejected(client):
    eid, seg = await _engagement_with_segment(client)
    bad = await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "vibes"})
    assert bad.status_code == 422
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin"})).json()
    no_seg = await client.post(f"/tnmm-analyses/{a['id']}/compute")   # no segment selected
    assert no_seg.status_code == 422
