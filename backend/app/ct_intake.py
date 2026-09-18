"""Controlled-transaction intake, validation & Excel template (Local File spec §2).

Finance practitioners populate the TP transaction population offline in an Excel template, then upload it:
download → fill → upload → validate → preview → import. Aggregated at the TP-category level (one row per
"Provision of IT services — US Parent — INR 84M"), never individual ERP postings.

Reuses the financials intake plumbing: `parse_financial_file` for XLSX/CSV reading + immutable raw-cell capture,
and `parse_amount` for tolerant amount parsing. Validation is deterministic and low-false-positive — invalid rows
are FLAGGED (per-row issue codes + a diagnostics summary), never silently dropped.
"""
from __future__ import annotations

import io
from datetime import date, datetime

from openpyxl import Workbook

from .financial_intake import _norm, parse_amount, parse_financial_file

# TP transaction categories (spec §2). Canonical, lowercase.
CATEGORIES: tuple[str, ...] = (
    "services", "purchase of goods", "sale of goods", "royalty", "loan",
    "reimbursement", "recharge", "ip/technology", "other",
)
_CATEGORY_ALIASES: dict[str, str] = {
    "service": "services", "provision of services": "services", "it services": "services",
    "goods purchase": "purchase of goods", "purchase goods": "purchase of goods", "purchases": "purchase of goods",
    "goods sale": "sale of goods", "sale goods": "sale of goods", "sales": "sale of goods",
    "royalties": "royalty", "loans": "loan", "financing": "loan", "interest": "loan",
    "reimbursements": "reimbursement", "recharges": "recharge", "cost recharge": "recharge",
    "ip": "ip/technology", "technology": "ip/technology", "intangibles": "ip/technology",
    "ip transaction": "ip/technology", "ip/technology transactions": "ip/technology",
}

DIRECTIONS: tuple[str, ...] = ("payment", "receipt")

# Canonical CT field -> recognised source headers (normalized). Detection is deterministic exact match.
_CT_MAP: dict[str, set[str]] = {
    "transaction_category": {"transaction category", "transaction type", "category", "tp category",
                             "nature of transaction", "transaction", "type"},
    "description": {"description", "details", "narrative", "desc"},
    "associated_enterprise_name": {"associated enterprise", "ae", "ae name", "associated enterprise name",
                                   "related party", "counterparty", "counterparty entity", "related party name"},
    "associated_enterprise_country": {"ae country", "country", "associated enterprise country",
                                      "counterparty country", "country of ae", "ae jurisdiction"},
    "direction": {"direction", "flow", "pay/receive", "payment/receipt", "payment or receipt"},
    "local_currency": {"local currency", "statutory currency", "currency", "local ccy", "local curr"},
    "local_currency_amount": {"local amount", "amount (local)", "local currency amount", "amount local",
                              "statutory amount", "amount"},
    "group_currency": {"group currency", "reporting currency", "group ccy", "group reporting currency"},
    "group_currency_amount": {"group amount", "amount (group)", "group currency amount", "amount group",
                              "reporting amount"},
    "period_start": {"period start", "start", "from", "period from", "start date"},
    "period_end": {"period end", "end", "to", "period to", "end date"},
    "materiality_status": {"materiality", "materiality status", "material"},
    "notes": {"notes", "note", "comments", "remarks"},
}

CT_FIELDS: tuple[str, ...] = tuple(_CT_MAP)
CT_REQUIRED: tuple[str, ...] = ("transaction_category", "associated_enterprise_name")

# Human-facing template header labels (order matters for the template + preview).
TEMPLATE_COLUMNS: list[str] = [
    "Transaction Category", "Description", "Associated Enterprise", "AE Country", "Direction",
    "Local Currency", "Local Amount", "Group Currency", "Group Amount",
    "Period Start", "Period End", "Materiality", "Notes",
]

# ISO-3166 alpha-2 country codes.
_ISO2 = frozenset(
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV "
    "BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES "
    "ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE "
    "IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY "
    "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU "
    "NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM "
    "SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE "
    "VG VI VN VU WF WS YE YT ZA ZM ZW".split()
)
# Common alpha-3 codes + full names -> alpha-2 (the jurisdictions that actually show up in TP work).
_COUNTRY_ALIASES: dict[str, str] = {
    "usa": "US", "us": "US", "united states": "US", "united states of america": "US",
    "uk": "GB", "gbr": "GB", "united kingdom": "GB", "great britain": "GB", "england": "GB",
    "ind": "IN", "india": "IN", "deu": "DE", "germany": "DE", "fra": "FR", "france": "FR",
    "chn": "CN", "china": "CN", "jpn": "JP", "japan": "JP", "nld": "NL", "netherlands": "NL",
    "sgp": "SG", "singapore": "SG", "irl": "IE", "ireland": "IE", "che": "CH", "switzerland": "CH",
    "lux": "LU", "luxembourg": "LU", "aus": "AU", "australia": "AU", "can": "CA", "canada": "CA",
    "bra": "BR", "brazil": "BR", "ita": "IT", "italy": "IT", "esp": "ES", "spain": "ES",
    "mex": "MX", "mexico": "MX", "hkg": "HK", "hong kong": "HK", "kor": "KR", "south korea": "KR",
    "korea": "KR", "are": "AE", "uae": "AE", "united arab emirates": "AE", "zaf": "ZA", "south africa": "ZA",
    "swe": "SE", "sweden": "SE", "bel": "BE", "belgium": "BE", "pol": "PL", "poland": "PL",
}

_ISO_CCY_LEN = 3


def canonical_category(value: str | None) -> str | None:
    """Map an input category to a canonical CATEGORY, or None if unrecognised."""
    if not value:
        return None
    n = _norm(value)
    if n in CATEGORIES:
        return n
    return _CATEGORY_ALIASES.get(n)


def normalize_country(value: str | None) -> str | None:
    """Resolve a country to its ISO alpha-2 code, or None if unrecognised."""
    if not value:
        return None
    s = str(value).strip()
    up = s.upper()
    if up in _ISO2:
        return up
    return _COUNTRY_ALIASES.get(_norm(s))


def is_valid_currency(value: str | None) -> bool:
    return bool(value) and len(str(value).strip()) == _ISO_CCY_LEN and str(value).strip().isalpha()


def parse_date(v: object) -> date | None:
    """Parse a date cell tolerantly. Returns None when unparseable (never a fabricated date)."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    if not s:
        return None
    s = s.split(" ")[0]   # drop the time part of a "2025-04-01 00:00:00" stringified datetime
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def detect_columns(headers: list[str]) -> dict[str, str]:
    """{canonical_ct_field: source_header} for headers we recognise (deterministic exact match)."""
    out: dict[str, str] = {}
    for src in headers:
        n = _norm(src)
        if not n:
            continue
        for field_name, aliases in _CT_MAP.items():
            if field_name not in out and n in aliases:
                out[field_name] = src
                break
    return out


def derive_ct_row(raw: dict, mapping: dict[str, str]) -> dict:
    """Typed CT fields derived from the immutable raw cells via the column mapping."""
    def cell(field: str) -> str | None:
        header = mapping.get(field)
        if not header:
            return None
        v = raw.get(header)
        s = None if v is None else str(v).strip()
        return s or None

    def amount(field: str) -> float | None:
        header = mapping.get(field)
        return parse_amount(raw.get(header)) if header else None

    direction = (cell("direction") or "").lower() or None
    return {
        "transaction_category": cell("transaction_category"),
        "description": cell("description"),
        "associated_enterprise_name": cell("associated_enterprise_name"),
        "associated_enterprise_country": cell("associated_enterprise_country"),
        "direction": direction,
        "local_currency": cell("local_currency"),
        "local_currency_amount": amount("local_currency_amount"),
        "group_currency": cell("group_currency"),
        "group_currency_amount": amount("group_currency_amount"),
        "period_start": parse_date(cell("period_start")),
        "period_end": parse_date(cell("period_end")),
        "materiality_status": cell("materiality_status"),
        "notes": cell("notes"),
    }


# Issue codes a row can carry (spec §2 validation).
BLOCKING_ISSUES = ("missing_category", "missing_associated_enterprise")


def _row_issues(
    d: dict, raw: dict, mapping: dict[str, str], *,
    statutory_start: date | None, statutory_end: date | None,
) -> list[str]:
    issues: list[str] = []

    if not d.get("transaction_category"):
        issues.append("missing_category")
    elif canonical_category(d["transaction_category"]) is None:
        issues.append("unknown_category")

    if not d.get("associated_enterprise_name"):
        issues.append("missing_associated_enterprise")

    country = d.get("associated_enterprise_country")
    if country and normalize_country(country) is None:
        issues.append("invalid_country")

    for ccy in ("local_currency", "group_currency"):
        if d.get(ccy) and not is_valid_currency(d[ccy]):
            issues.append("invalid_currency")
            break

    for amt_field in ("local_currency_amount", "group_currency_amount"):
        header = mapping.get(amt_field)
        cell = "" if not header else str(raw.get(header) or "").strip()
        if cell and d.get(amt_field) is None:
            issues.append("malformed_amount")
            break

    if d.get("direction") and d["direction"] not in DIRECTIONS:
        issues.append("invalid_direction")

    # Fiscal-period mismatch: the row's period must sit inside the project's statutory window (§2).
    if statutory_start and statutory_end:
        for p in (d.get("period_start"), d.get("period_end")):
            if p and not (statutory_start <= p <= statutory_end):
                issues.append("fiscal_period_mismatch")
                break

    return issues


def validate_ct_rows(
    rows: list[dict], mapping: dict[str, str], *,
    statutory_start: date | None = None, statutory_end: date | None = None,
) -> tuple[list[list[str]], dict]:
    """Return (issues_per_row, summary). Each row dict carries derived CT fields + `raw` (original cells)."""
    required_missing = [f for f in CT_REQUIRED if not mapping.get(f)]

    per_row: list[list[str]] = []
    issue_counts: dict[str, int] = {}
    seen: set[tuple] = set()

    for row in rows:
        raw = row.get("raw") or {}
        issues = _row_issues(row, raw, mapping, statutory_start=statutory_start, statutory_end=statutory_end)

        key = (
            canonical_category(row.get("transaction_category")) or row.get("transaction_category"),
            (row.get("associated_enterprise_name") or "").strip().lower(),
            row.get("direction"),
            row.get("local_currency_amount"),
            row.get("period_start"), row.get("period_end"),
        )
        if key in seen:
            issues.append("duplicate_transaction")
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


def parse_ct_file(filename: str, data: bytes) -> tuple[list[str], list[dict]]:
    """Parse an uploaded CT file into (headers, raw_rows). Reuses the financials XLSX/CSV reader."""
    parsed = parse_financial_file(filename, data)
    return parsed.headers, [r.raw for r in parsed.rows]


def build_template() -> bytes:
    """The Excel template finance fills in offline: header row + two worked examples + a reference sheet."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Controlled Transactions"
    ws.append(TEMPLATE_COLUMNS)
    ws.append([
        "services", "Provision of IT services", "US Parent Inc", "US", "receipt",
        "INR", 84000000, "USD", 1000000, "2025-04-01", "2026-03-31", "material", "",
    ])
    ws.append([
        "royalty", "Brand royalty", "German Affiliate GmbH", "DE", "payment",
        "INR", 12000000, "USD", 143000, "2025-04-01", "2026-03-31", "material", "",
    ])

    ref = wb.create_sheet("Reference")
    ref.append(["Allowed transaction categories"])
    for c in CATEGORIES:
        ref.append([c])
    ref.append([])
    ref.append(["Allowed directions"])
    for dirn in DIRECTIONS:
        ref.append([dirn])
    ref.append([])
    ref.append(["Dates: YYYY-MM-DD. Currency: 3-letter ISO (e.g. USD). Country: ISO alpha-2 or name (e.g. US)."])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
