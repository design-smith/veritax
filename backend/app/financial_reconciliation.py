"""Financial reconciliation (Class 3 §25-28).

Deterministic tie-out between two totals (FS → TB → Segment → analysis) with a configurable tolerance. An
unexplained difference is never hidden — it resolves to `unreconciled`; a missing total → `review_required`.
Pure function, trivially testable and re-runnable.
"""
from __future__ import annotations


def reconcile(source_total: float | None, target_total: float | None, *,
              tolerance: float = 0.0, rounding: float = 1.0) -> dict:
    """Compare two totals. status ∈ reconciled | reconciled_with_rounding |
    reconciled_with_explained_difference | unreconciled | review_required (§26-27)."""
    if source_total is None or target_total is None:
        return {"difference": None, "difference_pct": None, "status": "review_required"}
    src, tgt = float(source_total), float(target_total)
    diff = src - tgt
    absdiff = abs(diff)
    pct = (absdiff / abs(src)) if src else None
    if absdiff == 0:
        status = "reconciled"
    elif absdiff <= rounding:
        status = "reconciled_with_rounding"
    elif absdiff <= tolerance:
        status = "reconciled_with_explained_difference"
    else:
        status = "unreconciled"
    return {"difference": diff, "difference_pct": pct, "status": status}
