"""Financial validation & diagnostics (Class 3 §15).

Deterministic checks over a dataset's rows + effective mapping. Invalid rows are FLAGGED, never dropped — each
row gets an `issues` list and the dataset gets a diagnostics summary. Pure function (no DB) so it's trivially
testable and re-runnable on every remap.

v1 checks (unambiguous, low false-positive): blank/unparseable amount, missing account (code and name),
malformed currency, malformed account code, duplicate rows, and missing required columns. Date/period parsing,
debit/credit sanity, and total tie-outs are honest follow-ons (the single-amount canonical model has no separate
debit/credit columns; period is a free-form label).
"""
from __future__ import annotations

import re

_CCY = re.compile(r"^[A-Za-z]{3}$")
_ALNUM = re.compile(r"[A-Za-z0-9]")


def _has_required(field: str, mapping: dict) -> bool:
    if field == "account":
        return bool(mapping.get("account_code") or mapping.get("account_name"))
    return bool(mapping.get(field))


def validate_rows(rows: list[dict], mapping: dict) -> tuple[list[list[str]], dict]:
    """Return (issues_per_row, summary). Each row dict carries derived canonical fields + `raw` (original cells).

    Issue codes: amount_blank, amount_unparseable, missing_account, invalid_currency, malformed_account_code,
    duplicate_row. Dataset-level: missing_required_columns (account + amount).
    """
    amount_header = mapping.get("amount")
    required_missing = [f for f in ("account", "amount") if not _has_required(f, mapping)]

    per_row: list[list[str]] = []
    issue_counts: dict[str, int] = {}
    seen: set[tuple] = set()

    for row in rows:
        raw = row.get("raw") or {}
        issues: list[str] = []

        if amount_header:
            cell = raw.get(amount_header)
            cell_s = "" if cell is None else str(cell).strip()
            if row.get("amount") is None:
                issues.append("amount_blank" if cell_s == "" else "amount_unparseable")

        if not (row.get("account_code") or row.get("account_name")):
            issues.append("missing_account")

        code = row.get("account_code")
        if code and not _ALNUM.search(str(code)):        # present but no alphanumeric char → malformed
            issues.append("malformed_account_code")

        cur = row.get("currency")
        if cur and not _CCY.match(str(cur)):
            issues.append("invalid_currency")

        key = tuple(sorted((raw or {}).items()))
        if key in seen:
            issues.append("duplicate_row")
        else:
            seen.add(key)

        per_row.append(issues)
        for c in issues:
            issue_counts[c] = issue_counts.get(c, 0) + 1

    rows_with_issues = sum(1 for x in per_row if x)
    summary = {
        "status": "issues" if (rows_with_issues or required_missing) else "passed",
        "total_rows": len(rows),
        "rows_with_issues": rows_with_issues,
        "issue_counts": issue_counts,
        "missing_required_columns": required_missing,
    }
    return per_row, summary
