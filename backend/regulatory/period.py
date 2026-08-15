"""Deterministic fiscal-year compatibility for benchmarking comparables (PRD Class 1, S4).

Compares the tested party's fiscal year to a comparable/benchmark data year and returns a compatibility band.
The tolerance bands are a Veritax METHODOLOGY default (contemporaneity of comparable data) — NOT a statutory
rule, since no seeded jurisdiction defines a fiscal-year tolerance; a jurisdiction with a specific statutory
tolerance can override later. Missing/unparseable period → `unknown`, never a guess (PRD §36). This informs the
practitioner (it does not block). Feeds the stale-benchmark risk in S7.
"""
from __future__ import annotations

import re

_YEAR = re.compile(r"\d{4}")

# Methodology default bands, by absolute gap in years between tested fiscal year and comparable data year.
_EXPLAIN = {
    "exact": "Comparable data year {c} matches the tested party's fiscal year {t}.",
    "acceptable_mismatch": "Comparable data year {c} is {gap} year from the tested fiscal year {t}; acceptable where current-year data is not yet available, with contemporaneity noted.",
    "review_required": "Comparable data year {c} is {gap} years from the tested fiscal year {t}; review contemporaneity before relying on it.",
    "incompatible": "Comparable data year {c} is {gap} years from the tested fiscal year {t}; too stale to rely on.",
}


def _year(period: str | int | None) -> int | None:
    m = _YEAR.search(str(period if period is not None else ""))
    return int(m.group()) if m else None


def evaluate_period_compatibility(tested_period: str | int | None, comparable_period: str | int | None,
                                  business_change: bool = False) -> dict:
    """Band the compatibility of a comparable data year against the tested fiscal year.

    Returns {status, gap_years, business_change, explanation}. `status` is one of exact / acceptable_mismatch /
    review_required / incompatible / unknown.
    """
    t, c = _year(tested_period), _year(comparable_period)
    if t is None or c is None:
        return {"status": "unknown", "gap_years": None, "business_change": business_change,
                "explanation": "The tested-party or comparable fiscal year is unknown."}
    gap = abs(t - c)
    if business_change:
        return {"status": "review_required", "gap_years": gap, "business_change": True,
                "explanation": f"A business change in the period requires review even where the fiscal years align (gap {gap} year(s))."}
    status = ("exact" if gap == 0 else "acceptable_mismatch" if gap == 1
              else "review_required" if gap == 2 else "incompatible")
    return {"status": status, "gap_years": gap, "business_change": False,
            "explanation": _EXPLAIN[status].format(gap=gap, t=t, c=c)}
