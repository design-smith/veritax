"""Class 3 · S2 — financial dataset intake: XLSX/CSV → immutable rows with provenance + SQL-aggregated summary."""
import io

import pytest
from openpyxl import Workbook


def _xlsx(headers: list[str], rows: list[list], sheet: str = "Trial Balance") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _upload(client, eid: str, filename: str, data: bytes, dataset_type: str = "trial_balance",
                  period: str | None = "FY2025"):
    form = {"dataset_type": dataset_type}
    if period is not None:
        form["period"] = period
    return await client.post(
        f"/engagements/{eid}/financial-datasets",
        data=form,
        files={"file": (filename, data, "application/octet-stream")},
    )


async def test_xlsx_upload_parses_rows_with_provenance_and_detection(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(
        ["GL Code", "GL Description", "BU", "Currency", "FY24 Actual"],
        [["610100", "Employee Salaries", "SERVICES", "QAR", 4200000],
         ["700200", "Interest Expense", "SERVICES", "QAR", "(1,234)"]],
    )
    r = await _upload(client, eid, "tb.xlsx", data)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["dataset_type"] == "trial_balance" and body["row_count"] == 2
    # Default detection mapped the client headers to canonical fields.
    assert body["detected_columns"]["account_code"] == "GL Code"
    assert body["detected_columns"]["amount"] == "FY24 Actual"
    assert body["detected_columns"]["business_unit"] == "BU"
    # SQL-aggregated totals: 4,200,000 + (-1,234) = 4,198,766 QAR.
    tot = next(t for t in body["totals_by_currency"] if t["currency"] == "QAR")
    assert tot["row_count"] == 2 and tot["total_amount"] == pytest.approx(4198766.0)

    rows = (await client.get(f"/financial-datasets/{body['id']}/rows")).json()["rows"]
    first = rows[0]
    assert first["account_code"] == "610100" and first["account_name"] == "Employee Salaries"
    assert first["amount"] == pytest.approx(4200000.0)
    assert first["source_locator"] == "Trial Balance!Row 1"     # deterministic provenance (§9,§11)
    # Accounting-negative parsed; original cell preserved verbatim in raw (§9 immutability).
    assert rows[1]["amount"] == pytest.approx(-1234.0)
    assert rows[1]["raw"]["FY24 Actual"] == "(1,234)"


async def test_original_source_document_is_stored_immutably(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "Amount", "Currency"], [["100", "500", "USD"]])
    body = (await _upload(client, eid, "acct.xlsx", data)).json()
    # The raw file is preserved as a Document (the intake never mutates the upload, §9).
    assert body["document_id"]
    doc = (await client.get(f"/documents/{body['document_id']}")).json()
    assert doc["original_filename"] == "acct.xlsx"


async def test_csv_upload_parses(client):
    eid = (await client.post("/engagements")).json()["id"]
    csv = b"account_code,account_name,amount,currency\n5000,Revenue,18500000,QAR\n"
    body = (await _upload(client, eid, "seg.csv", csv, dataset_type="segmented_pl")).json()
    assert body["row_count"] == 1 and body["dataset_type"] == "segmented_pl"
    rows = (await client.get(f"/financial-datasets/{body['id']}/rows")).json()["rows"]
    assert rows[0]["account_name"] == "Revenue" and rows[0]["amount"] == pytest.approx(18500000.0)
    assert rows[0]["source_locator"] == "seg.csv!Row 1"          # CSV has no sheet → filename-based locator


async def test_unparseable_amount_stays_null_not_fabricated(client):
    eid = (await client.post("/engagements")).json()["id"]
    csv = b"account_code,amount,currency\n9000,not-a-number,QAR\n"
    body = (await _upload(client, eid, "x.csv", csv)).json()
    rows = (await client.get(f"/financial-datasets/{body['id']}/rows")).json()["rows"]
    assert rows[0]["amount"] is None                             # never invents a 0 (§2)
    assert rows[0]["raw"]["amount"] == "not-a-number"            # original preserved


async def test_large_population_bulk_loads_and_paginates(client):
    eid = (await client.post("/engagements")).json()["id"]
    n = 3000
    rows = [[f"AC{i:05d}", f"Account {i}", "QAR", 100 + i] for i in range(n)]
    data = _xlsx(["GL Code", "GL Description", "Currency", "Amount"], rows, sheet="GL")
    body = (await _upload(client, eid, "gl.xlsx", data, dataset_type="general_ledger")).json()
    assert body["row_count"] == n
    page = (await client.get(f"/financial-datasets/{body['id']}/rows", params={"limit": 50, "offset": 2950})).json()
    assert page["total"] == n and len(page["rows"]) == 50
    assert page["rows"][0]["row_index"] == 2951 and page["rows"][0]["account_code"] == "AC02950"


async def test_unsupported_file_type_is_rejected(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await _upload(client, eid, "statements.pdf", b"%PDF-1.4 ...")
    assert r.status_code == 422 and "XLSX/CSV" in r.json()["detail"]


async def test_datasets_are_listed_for_the_engagement(client):
    eid = (await client.post("/engagements")).json()["id"]
    await _upload(client, eid, "a.csv", b"account_code,amount\n1,10\n")
    await _upload(client, eid, "b.csv", b"account_code,amount\n2,20\n")
    listed = (await client.get(f"/engagements/{eid}/financial-datasets")).json()
    assert len(listed) == 2 and {d["source_filename"] for d in listed} == {"a.csv", "b.csv"}
