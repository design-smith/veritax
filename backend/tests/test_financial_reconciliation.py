"""Class 3 · S9 — reconciliation: deterministic tie-out with configurable tolerance; differences never hidden."""
import io

import pytest
from openpyxl import Workbook

from app.financial_reconciliation import reconcile


# ── Pure engine (no DB) ───────────────────────────────────────────────────────
def test_status_thresholds():
    assert reconcile(100, 100)["status"] == "reconciled"
    assert reconcile(100, 99)["status"] == "reconciled_with_rounding"                 # |1| <= rounding(1)
    assert reconcile(1_000_000, 999_000, tolerance=5000)["status"] == "reconciled_with_explained_difference"
    assert reconcile(1_000_000, 800_000, tolerance=100)["status"] == "unreconciled"   # diff 200,000 > tolerance
    assert reconcile(None, 100)["status"] == "review_required"
    assert reconcile(100, None)["status"] == "review_required"


def test_difference_and_pct():
    r = reconcile(1000, 800, tolerance=0)
    assert r["difference"] == pytest.approx(200.0) and r["difference_pct"] == pytest.approx(0.2)
    assert r["status"] == "unreconciled"


# ── Integration ───────────────────────────────────────────────────────────────
def _xlsx(rows) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(["Account", "GL Description", "BU", "Amount", "Currency"])
    for r in rows:
        ws.append(r)
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _dataset(client, eid, rows):
    return (await client.post(f"/engagements/{eid}/financial-datasets", data={"dataset_type": "trial_balance"},
                              files={"file": ("f.xlsx", _xlsx(rows), "application/octet-stream")})).json()["id"]


async def test_dataset_to_dataset_tie_out(client):
    eid = (await client.post("/engagements")).json()["id"]
    fs = await _dataset(client, eid, [["1", "Net assets", "X", 1000000, "QAR"]])
    tb = await _dataset(client, eid, [["1", "Net assets", "X", 1000000, "QAR"]])
    r = await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "FS → TB", "source": {"kind": "dataset", "id": fs}, "target": {"kind": "dataset", "id": tb}})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "reconciled" and body["difference"] == pytest.approx(0.0)
    assert body["source_total"] == pytest.approx(1000000.0)


async def test_material_gap_is_unreconciled_and_surfaced(client):
    eid = (await client.post("/engagements")).json()["id"]
    fs = await _dataset(client, eid, [["1", "Net assets", "X", 1000000, "QAR"]])
    tb = await _dataset(client, eid, [["1", "Net assets", "X", 800000, "QAR"]])   # 200k short
    body = (await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "FS → TB", "source": {"kind": "dataset", "id": fs}, "target": {"kind": "dataset", "id": tb}})).json()
    assert body["status"] == "unreconciled" and body["difference"] == pytest.approx(200000.0)   # not hidden


async def test_tb_to_segment_tie_out(client):
    eid = (await client.post("/engagements")).json()["id"]
    tb = await _dataset(client, eid, [
        ["500100", "Revenue", "SERVICES", 500000, "QAR"],
        ["500200", "Revenue", "TRADING", 300000, "QAR"],
    ])
    seg = (await client.post(f"/engagements/{eid}/financial-segments", json={"name": "Services"})).json()["id"]
    await client.post(f"/financial-segments/{seg}/rules",
                      json={"field": "business_unit", "operator": "equals", "value": "SERVICES"})
    # The segment (500k SERVICES) reconciles to a 500k figure with rounding tolerance.
    body = (await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "Segment tie-out", "source": {"kind": "segment", "id": seg},
        "target": {"kind": "dataset", "id": tb}})).json()
    assert body["source_total"] == pytest.approx(500000.0) and body["target_total"] == pytest.approx(800000.0)
    assert body["status"] == "unreconciled"   # the segment is a subset — the difference is visible, not hidden


async def test_reconciliations_listed_and_deletable(client):
    eid = (await client.post("/engagements")).json()["id"]
    a = await _dataset(client, eid, [["1", "x", "X", 100, "QAR"]])
    rec = (await client.post(f"/engagements/{eid}/reconciliations", json={
        "label": "self", "source": {"kind": "dataset", "id": a}, "target": {"kind": "dataset", "id": a}})).json()
    assert len((await client.get(f"/engagements/{eid}/reconciliations")).json()) == 1
    assert (await client.delete(f"/reconciliations/{rec['id']}")).status_code == 204
    assert (await client.get(f"/engagements/{eid}/reconciliations")).json() == []
