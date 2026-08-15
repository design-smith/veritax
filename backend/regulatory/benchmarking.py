"""Deterministic arm's-length range computation + jurisdiction method selection (PRD Class 1, S5).

Statistical CONFIG + CALC only — NOT comparable search, NOT a TNMM/FAR workflow (PRD §42 non-goals). Given a
set of comparable results and an explicit method, computes the range with reproducible metadata (method,
quartile convention, n, bounds) so the same inputs always reproduce the same range. The default method is a
documented Veritax methodology default (OECD-aligned interquartile range); a jurisdiction that verifiably
mandates a method overrides it via a `benchmarking` registry rule (none seeded yet — no fabricated statute).
"""
from __future__ import annotations

import statistics

from .resolver import _name_to_code, resolve_rules

_DEFAULT_METHOD = {"method": "interquartile_range", "quartile_method": "inclusive"}
_MIN_FOR_IQR = 4  # ponytail: methodology floor; below this an interquartile range isn't meaningful.


def compute_arm_length_range(results, method: str = "interquartile_range", quartile_method: str = "inclusive") -> dict:
    """Compute the arm's-length range from comparable results. Reproducible: same inputs → same output.

    status: "computed" | "insufficient" (too few for an IQR) | "unknown" (no results).
    """
    vals = sorted(float(r) for r in results if r is not None)
    meta = {"method": method, "quartile_method": quartile_method, "n": len(vals)}
    if not vals:
        return {**meta, "status": "unknown", "lower": None, "upper": None, "median": None,
                "reason": "no comparable results provided"}
    if method == "full_range":
        return {**meta, "status": "computed", "lower": vals[0], "upper": vals[-1], "median": statistics.median(vals)}
    if method == "interquartile_range":
        if len(vals) < _MIN_FOR_IQR:
            return {**meta, "status": "insufficient", "lower": None, "upper": None,
                    "median": statistics.median(vals),
                    "reason": f"interquartile range needs at least {_MIN_FOR_IQR} comparables, got {len(vals)}"}
        q1, _q2, q3 = statistics.quantiles(vals, n=4, method=quartile_method)
        return {**meta, "status": "computed", "lower": q1, "upper": q3, "median": statistics.median(vals)}
    raise ValueError(f"unsupported benchmarking method: {method}")


def position_in_range(tested, rng: dict) -> str:
    """Where the tested result sits vs a computed range: within | below | above | unknown."""
    if tested is None or rng.get("lower") is None or rng.get("upper") is None:
        return "unknown"
    t = float(tested)
    return "below" if t < rng["lower"] else "above" if t > rng["upper"] else "within"


def benchmarking_method(country: str, fiscal_year: str | int | None) -> dict:
    """The range method a jurisdiction mandates, if verifiably seeded; else the documented methodology default."""
    code = _name_to_code().get(str(country).lower(), str(country))
    rule = next((r for r in resolve_rules(code, fiscal_year) if r.rule_category == "benchmarking"), None)
    if rule is None:
        return {**_DEFAULT_METHOD, "source": None, "verification_status": "methodology_default",
                "basis": "Veritax methodology default (OECD-aligned interquartile range); no jurisdiction-specific statutory method seeded."}
    res = rule.result if isinstance(rule.result, dict) else {}
    return {"method": res.get("method", _DEFAULT_METHOD["method"]),
            "quartile_method": res.get("quartile_method", _DEFAULT_METHOD["quartile_method"]),
            "source": rule.source_ids, "verification_status": rule.verification_status, "basis": rule.plain_english}
