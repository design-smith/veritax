"""Class 3 · S5 — account classification: deterministic-first, validated-only suggestions, audited override."""
import io

from openpyxl import Workbook

from app.financial_classification import classify_account


# ── Pure classifier (no DB) ───────────────────────────────────────────────────
def test_deterministic_signals():
    assert classify_account("700200", "Interest Expense") == ("financing", "deterministic")
    assert classify_account("800100", "Income Tax") == ("tax", "deterministic")
    assert classify_account("900300", "Impairment of goodwill") == ("exceptional", "deterministic")
    assert classify_account("500100", "Revenue") == ("operating", "deterministic")
    assert classify_account("510100", "Employee Salaries") == ("operating", "deterministic")
    assert classify_account("610900", "Dividend income") == ("non_operating", "deterministic")


def test_unknown_and_blank():
    assert classify_account("Z999", "Sundry misc line") == ("review_required", "default")
    assert classify_account(None, None) == ("unallocated", "default")


# ── Integration ───────────────────────────────────────────────────────────────
def _xlsx(headers, rows) -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = "TB"
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _upload(client, eid, data, filename="tb.xlsx"):
    return await client.post(f"/engagements/{eid}/financial-datasets",
                             data={"dataset_type": "trial_balance"},
                             files={"file": (filename, data, "application/octet-stream")})


async def test_rows_carry_classification_on_upload(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "GL Description", "Amount", "Currency"], [
        ["700200", "Interest Expense", 1000, "QAR"],
        ["500100", "Revenue", 18500000, "QAR"],
        ["Z999", "Sundry misc line", 42, "QAR"],
    ])
    ds_id = (await _upload(client, eid, data)).json()["id"]
    rows = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"]
    by_code = {r["account_code"]: r for r in rows}
    assert by_code["700200"]["classification"] == "financing"
    assert by_code["700200"]["classification_source"] == "deterministic"
    assert by_code["500100"]["classification"] == "operating"
    assert by_code["Z999"]["classification"] == "review_required"


async def test_override_records_audit_and_preserves_original(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "GL Description", "Amount"], [["700200", "Interest Expense", 1000]])
    ds_id = (await _upload(client, eid, data)).json()["id"]
    row = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"][0]
    assert row["classification"] == "financing"

    r = await client.put(f"/financial-rows/{row['id']}/classification",
                         json={"classification": "non_operating", "reason": "reclassified per group policy"})
    assert r.status_code == 200
    upd = r.json()
    assert upd["classification"] == "non_operating"
    assert upd["classification_source"] == "override"
    assert upd["classification_original"] == "financing"          # original preserved (audit)
    assert upd["classification_reason"] == "reclassified per group policy"
    assert upd["classification_overridden_by"] and upd["classification_overridden_at"]


async def test_override_rejects_unknown_class(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds_id = (await _upload(client, eid, _xlsx(["Account", "Amount"], [["1", 10]]))).json()["id"]
    row = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"][0]
    r = await client.put(f"/financial-rows/{row['id']}/classification", json={"classification": "bogus"})
    assert r.status_code == 422


async def test_suggestions_are_validated_only(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "GL Description", "Amount"], [["Z100", "Miscellaneous other charge", 5]])
    ds_id = (await _upload(client, eid, data)).json()["id"]
    # The misc row defaulted to review_required → it gets a suggestion.
    sug = (await client.get(f"/financial-datasets/{ds_id}/classification/suggestions")).json()
    assert sug["suggestions"] and sug["suggestions"][0]["suggestion"] is not None
    assert sug["suggestions"][0]["current"] == "review_required"
    # The suggestion did NOT change the stored classification.
    row = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"][0]
    assert row["classification"] == "review_required"


async def test_remap_preserves_override(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "GL Description", "Amount"], [["700200", "Interest Expense", 1000]])
    ds_id = (await _upload(client, eid, data)).json()["id"]
    row = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"][0]
    await client.put(f"/financial-rows/{row['id']}/classification", json={"classification": "tax"})
    # Remap (same columns) → the override survives; auto rows would re-classify.
    await client.put(f"/financial-datasets/{ds_id}/mapping",
                     json={"mapping": {"account_code": "Account", "account_name": "GL Description", "amount": "Amount"}})
    after = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"][0]
    assert after["classification"] == "tax" and after["classification_source"] == "override"
