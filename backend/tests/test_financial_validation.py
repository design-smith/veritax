"""Class 3 · S4 — validation & diagnostics: deterministic checks that FLAG invalid rows (never drop them, §15)."""
import io

import pytest
from openpyxl import Workbook

from app.financial_validation import validate_rows


# ── Pure validator (no DB) ────────────────────────────────────────────────────
_MAP = {"account_code": "Account", "amount": "Amount", "currency": "Currency"}


def _row(account="100", amount=10.0, currency="USD", raw=None):
    raw = raw if raw is not None else {"Account": account or "", "Amount": "" if amount is None else str(amount), "Currency": currency or ""}
    return {"account_code": account, "account_name": None, "amount": amount, "currency": currency, "raw": raw}


def test_clean_rows_pass():
    issues, summary = validate_rows([_row(), _row(account="200")], _MAP)
    assert summary["status"] == "passed" and summary["rows_with_issues"] == 0
    assert all(i == [] for i in issues)


def test_blank_vs_unparseable_amount():
    blank = _row(amount=None, raw={"Account": "1", "Amount": "", "Currency": "USD"})
    bad = _row(amount=None, raw={"Account": "1", "Amount": "n/a", "Currency": "USD"})
    issues, summary = validate_rows([blank, bad], _MAP)
    assert issues[0] == ["amount_blank"] and issues[1] == ["amount_unparseable"]
    assert summary["issue_counts"]["amount_unparseable"] == 1


def test_missing_account_and_invalid_currency():
    r = {"account_code": None, "account_name": None, "amount": 5.0, "currency": "Dollars",
         "raw": {"Account": "", "Amount": "5", "Currency": "Dollars"}}
    issues, _ = validate_rows([r], _MAP)
    assert "missing_account" in issues[0] and "invalid_currency" in issues[0]


def test_duplicate_rows_flag_second_occurrence():
    raw = {"Account": "1", "Amount": "10", "Currency": "USD"}
    issues, summary = validate_rows([_row(raw=raw), _row(raw=raw)], _MAP)
    assert issues[0] == [] and issues[1] == ["duplicate_row"]
    assert summary["issue_counts"]["duplicate_row"] == 1


def test_missing_required_columns_when_amount_unmapped():
    _, summary = validate_rows([_row()], {"account_code": "Account"})   # no amount mapped
    assert "amount" in summary["missing_required_columns"] and summary["status"] == "issues"


# ── Integration through the API ───────────────────────────────────────────────
def _xlsx(headers, rows, sheet="Sheet1") -> bytes:
    wb = Workbook(); ws = wb.active; ws.title = sheet
    ws.append(headers)
    for r in rows:
        ws.append(r)
    buf = io.BytesIO(); wb.save(buf); return buf.getvalue()


async def _upload(client, eid, filename, data):
    return await client.post(f"/engagements/{eid}/financial-datasets",
                             data={"dataset_type": "trial_balance"},
                             files={"file": (filename, data, "application/octet-stream")})


async def test_upload_stores_diagnostics_and_flags_rows_without_dropping(client):
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Account", "Amount", "Currency"], [
        ["610100", 4200000, "QAR"],       # clean
        ["700200", "n/a", "QAR"],         # unparseable amount
        ["", 5000, "QAR"],                # missing account
    ])
    body = (await _upload(client, eid, "tb.xlsx", data)).json()
    assert body["row_count"] == 3                       # nothing dropped (§15)
    assert body["diagnostics"]["status"] == "issues"
    assert body["diagnostics"]["issue_counts"]["amount_unparseable"] == 1
    assert body["diagnostics"]["issue_counts"]["missing_account"] == 1

    diag = (await client.get(f"/financial-datasets/{body['id']}/diagnostics")).json()
    assert diag["rows_with_issues"] == 2

    rows = (await client.get(f"/financial-datasets/{body['id']}/rows")).json()["rows"]
    assert rows[0]["issues"] == []
    assert "amount_unparseable" in rows[1]["issues"]
    assert "missing_account" in rows[2]["issues"]


async def test_remap_reruns_validation(client):
    # Amount column not mapped by default → every row flagged; fixing the mapping clears it.
    eid = (await client.post("/engagements")).json()["id"]
    data = _xlsx(["Ledger", "Net Movement", "Curr"], [["1", 10, "USD"], ["2", 20, "USD"]])
    body = (await _upload(client, eid, "odd.xlsx", data)).json()
    assert "amount" in body["diagnostics"]["missing_required_columns"]

    await client.put(f"/financial-datasets/{body['id']}/mapping",
                     json={"mapping": {"account_code": "Ledger", "amount": "Net Movement", "currency": "Curr"}})
    diag = (await client.get(f"/financial-datasets/{body['id']}/diagnostics")).json()
    assert diag["status"] == "passed" and diag["rows_with_issues"] == 0
    assert diag["missing_required_columns"] == []
