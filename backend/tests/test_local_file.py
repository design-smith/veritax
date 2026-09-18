"""Local File spec §2 — controlled-transaction population: per-jurisdiction project, browser CRUD, Excel
template + upload → validate → preview → import."""
import io

from openpyxl import Workbook

COLUMNS = [
    "Transaction Category", "Description", "Associated Enterprise", "AE Country", "Direction",
    "Local Currency", "Local Amount", "Group Currency", "Group Amount",
    "Period Start", "Period End", "Materiality", "Notes",
]


def _row(category="services", desc="", ae="US Parent", country="US", direction="receipt",
         lccy="INR", lamt=84000000, gccy="USD", gamt=1000000,
         pstart="2025-04-01", pend="2026-03-31", mat="material", notes=""):
    return [category, desc, ae, country, direction, lccy, lamt, gccy, gamt, pstart, pend, mat, notes]


def _xlsx(rows: list[list], headers: list[str] = COLUMNS) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Controlled Transactions"
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _project(client, eid: str, jurisdiction: str = "India") -> dict:
    return (await client.get(f"/engagements/{eid}/local-file/{jurisdiction}")).json()


async def test_get_local_file_ensures_one_project_per_jurisdiction(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.get(f"/engagements/{eid}/local-file/India")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["jurisdiction"] == "India" and p["transactions"] == [] and p["status"] == "draft"
    pid = p["id"]
    # idempotent — same (engagement, jurisdiction) returns the same project
    assert (await client.get(f"/engagements/{eid}/local-file/India")).json()["id"] == pid
    # a different jurisdiction is a different project
    assert (await client.get(f"/engagements/{eid}/local-file/Germany")).json()["id"] != pid


async def test_browser_transaction_crud(client):
    eid = (await client.post("/engagements")).json()["id"]
    pid = (await _project(client, eid))["id"]

    body = {
        "transaction_category": "services", "associated_enterprise_name": "US Parent",
        "associated_enterprise_country": "United States", "direction": "receipt",
        "local_currency": "INR", "local_currency_amount": 84000000,
    }
    r = await client.post(f"/local-file-projects/{pid}/transactions", json=body)
    assert r.status_code == 201, r.text
    txn = r.json()
    assert txn["transaction_category"] == "services"
    assert txn["associated_enterprise_country"] == "US"     # normalized to ISO alpha-2
    tid = txn["id"]

    assert len((await _project(client, eid))["transactions"]) == 1

    r = await client.patch(f"/controlled-transactions/{tid}", json={"materiality_status": "immaterial"})
    assert r.status_code == 200 and r.json()["materiality_status"] == "immaterial"

    # an unknown category is rejected (deterministic vocabulary)
    bad = await client.post(f"/local-file-projects/{pid}/transactions",
                            json={"transaction_category": "bogus", "associated_enterprise_name": "x"})
    assert bad.status_code == 422

    r = await client.delete(f"/controlled-transactions/{tid}")
    assert r.status_code == 204
    assert (await _project(client, eid))["transactions"] == []


async def test_patch_project_details(client):
    eid = (await client.post("/engagements")).json()["id"]
    pid = (await _project(client, eid))["id"]
    r = await client.patch(f"/local-file-projects/{pid}", json={
        "statutory_currency": "INR", "status": "in_progress",
        "statutory_period_start": "2025-04-01", "statutory_period_end": "2026-03-31",
        "group_reporting_currency": "USD",
    })
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["statutory_currency"] == "INR" and b["status"] == "in_progress"
    assert b["statutory_period_start"] == "2025-04-01" and b["group_reporting_currency"] == "USD"


async def test_template_download(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.get(f"/engagements/{eid}/controlled-transactions-template")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert r.content[:2] == b"PK"     # a .xlsx is a zip container


async def test_preview_flags_each_validation_case(client):
    eid = (await client.post("/engagements")).json()["id"]
    pid = (await _project(client, eid))["id"]
    # set the statutory window so the fiscal-period-mismatch check has a window to compare against
    await client.patch(f"/local-file-projects/{pid}",
                       json={"statutory_period_start": "2025-04-01", "statutory_period_end": "2026-03-31"})

    rows = [
        _row(),                                                          # 0: valid
        _row(category="widgets", country="Atlantis", lccy="RUPEES", lamt="abc"),  # 1: unknown cat/country/ccy/amount
        _row(ae=""),                                                     # 2: missing AE (blocking)
        _row(),                                                          # 3: duplicate of row 0
        _row(pstart="2020-01-01", pend="2020-12-31"),                    # 4: period outside statutory window
        _row(direction="both"),                                         # 5: invalid direction
    ]
    r = await client.post(f"/local-file-projects/{pid}/transactions/preview",
                          files={"file": ("t.xlsx", _xlsx(rows), "application/octet-stream")})
    assert r.status_code == 200, r.text
    body = r.json()
    codes = {c for row in body["rows"] for c in row["issues"]}
    for expected in ("unknown_category", "invalid_country", "invalid_currency", "malformed_amount",
                     "missing_associated_enterprise", "duplicate_transaction", "fiscal_period_mismatch",
                     "invalid_direction"):
        assert expected in codes, (expected, codes)
    assert body["diagnostics"]["rows_with_issues"] >= 5
    assert body["rows"][0]["issues"] == []      # the valid row is clean
    # nothing was persisted by preview
    assert (await _project(client, eid))["transactions"] == []


async def test_import_persists_valid_rows_skips_blocking_and_keeps_raw(client):
    eid = (await client.post("/engagements")).json()["id"]
    pid = (await _project(client, eid))["id"]
    rows = [_row(), _row(ae="")]   # one valid, one blocking (no associated enterprise)
    r = await client.post(f"/local-file-projects/{pid}/transactions/import",
                          files={"file": ("import.xlsx", _xlsx(rows), "application/octet-stream")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 1 and body["skipped"] == 1
    assert len(body["transactions"]) == 1
    t = body["transactions"][0]
    assert t["transaction_category"] == "services" and t["associated_enterprise_country"] == "US"
    assert t["source_document_id"]      # the raw upload is kept as an immutable Document (audit)
    assert len((await _project(client, eid))["transactions"]) == 1
