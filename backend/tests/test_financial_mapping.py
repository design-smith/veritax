"""Class 3 · S3 — column mapping: reviewable/overridable, re-derived from immutable raw (no re-upload), saved &
reused by header signature, and LLM-assisted suggestions that are validated-only (never auto-applied)."""
import io

import pytest
from openpyxl import Workbook


def _xlsx(headers, rows, sheet="Sheet1") -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = sheet
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _upload(client, eid, filename, data, dataset_type="trial_balance"):
    return await client.post(
        f"/engagements/{eid}/financial-datasets",
        data={"dataset_type": dataset_type},
        files={"file": (filename, data, "application/octet-stream")},
    )


# Headers default detection does NOT recognise for account/name/amount (only "Curr" → currency).
_ODD = ["Ledger", "Narrative", "Net Movement", "Curr"]


async def test_override_remaps_rows_from_raw_without_reupload(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(_ODD, [["610100", "Salaries", 4200000, "QAR"]])
    ds_id = (await _upload(client, eid, "odd.xlsx", data)).json()["id"]

    # Default detection misses the odd headers → account/amount unmapped.
    rows = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"]
    assert rows[0]["account_code"] is None and rows[0]["amount"] is None
    assert rows[0]["currency"] == "QAR"                       # "Curr" was detected

    # Practitioner overrides the mapping → rows re-derive from the preserved raw cells (no re-upload).
    r = await client.put(f"/financial-datasets/{ds_id}/mapping", json={"mapping": {
        "account_code": "Ledger", "account_name": "Narrative", "amount": "Net Movement", "currency": "Curr"}})
    assert r.status_code == 200
    rows = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"]
    assert rows[0]["account_code"] == "610100" and rows[0]["account_name"] == "Salaries"
    assert rows[0]["amount"] == pytest.approx(4200000.0)
    assert rows[0]["raw"]["Net Movement"] == "4200000"        # raw still intact (§9)


async def test_saved_mapping_is_reused_on_matching_headers(client):
    eid = (await client.post("/engagements")).json()["id"]
    a = (await _upload(client, eid, "a.xlsx", _xlsx(_ODD, [["1", "x", 10, "USD"]]))).json()
    # Save an override for this header format.
    await client.put(f"/financial-datasets/{a['id']}/mapping", json={
        "mapping": {"account_code": "Ledger", "amount": "Net Movement", "currency": "Curr"},
        "save": True, "label": "Odd TB format"})

    # A second file with the SAME headers reuses the saved mapping automatically (§14).
    b = (await _upload(client, eid, "b.xlsx", _xlsx(_ODD, [["2", "y", 20, "USD"]]))).json()
    assert b["detected_columns"].get("account_code") is None    # default detection still wouldn't map it
    mapping = (await client.get(f"/financial-datasets/{b['id']}/mapping")).json()["effective"]
    assert mapping["account_code"] == "Ledger" and mapping["amount"] == "Net Movement"
    rows = (await client.get(f"/financial-datasets/{b['id']}/rows")).json()["rows"]
    assert rows[0]["account_code"] == "2" and rows[0]["amount"] == pytest.approx(20.0)


async def test_saved_mapping_versions_and_latest_wins(client):
    eid = (await client.post("/engagements")).json()["id"]
    a = (await _upload(client, eid, "a.xlsx", _xlsx(_ODD, [["1", "x", 10, "USD"]]))).json()
    await client.put(f"/financial-datasets/{a['id']}/mapping", json={
        "mapping": {"amount": "Net Movement"}, "save": True})
    await client.put(f"/financial-datasets/{a['id']}/mapping", json={
        "mapping": {"account_code": "Ledger", "amount": "Net Movement"}, "save": True})  # v2

    c = (await _upload(client, eid, "c.xlsx", _xlsx(_ODD, [["3", "z", 30, "USD"]]))).json()
    effective = (await client.get(f"/financial-datasets/{c['id']}/mapping")).json()["effective"]
    assert effective.get("account_code") == "Ledger"           # latest version applied


async def test_suggestions_are_validated_only_not_auto_applied(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds_id = (await _upload(client, eid, "odd.xlsx", _xlsx(_ODD, [["610100", "Salaries", 4200000, "QAR"]]))).json()["id"]

    sug = (await client.get(f"/financial-datasets/{ds_id}/mapping/suggestions")).json()
    assert sug["suggestions"].get("amount") == "Net Movement"   # suggester found the ambiguous amount column
    assert "account_code" in sug["unmapped_fields"]

    # The suggestion did NOT change the applied mapping — rows are unchanged until the practitioner accepts it.
    rows = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"]
    assert rows[0]["amount"] is None
    # Accepting it (PUT) applies it.
    await client.put(f"/financial-datasets/{ds_id}/mapping", json={"mapping": {"amount": "Net Movement"}})
    rows = (await client.get(f"/financial-datasets/{ds_id}/rows")).json()["rows"]
    assert rows[0]["amount"] == pytest.approx(4200000.0)


async def test_deterministic_detection_still_resolves_known_headers(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["GL Code", "GL Description", "Amount", "Currency"], [["5000", "Revenue", 100, "QAR"]])
    ds_id = (await _upload(client, eid, "std.xlsx", data)).json()["id"]
    got = (await client.get(f"/financial-datasets/{ds_id}/mapping")).json()
    assert got["detected"]["account_code"] == "GL Code" and got["detected"]["amount"] == "Amount"
    assert got["effective"]["amount"] == "Amount"              # applied on upload


async def test_invalid_mapping_is_rejected(client):
    eid = (await client.post("/engagements")).json()["id"]
    ds_id = (await _upload(client, eid, "std.xlsx", _xlsx(["Account", "Amount"], [["1", 10]]))).json()["id"]
    bad_header = await client.put(f"/financial-datasets/{ds_id}/mapping", json={"mapping": {"amount": "Nope"}})
    assert bad_header.status_code == 422
    bad_field = await client.put(f"/financial-datasets/{ds_id}/mapping", json={"mapping": {"widget": "Amount"}})
    assert bad_field.status_code == 422
