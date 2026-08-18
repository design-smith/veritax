"""TNMM PLIs (Class 3 §29-35, §33).

Deterministic profit-level-indicator formulas — the LLM never computes a PLI (§74). Inputs come from the tested
party's reconciled segment (§34). A PLI whose inputs aren't available in v1 returns `None` (undetermined, §46)
rather than a fabricated number. Full precision is preserved; display rounding is the caller's job.
"""
from __future__ import annotations

PLI_TYPES = ("operating_margin", "full_cost_markup", "berry_ratio", "return_on_assets")


def compute_pli(
    pli_type: str, *, revenue: float | None, operating_profit: float | None, total_costs: float | None,
    gross_profit: float | None = None, operating_expenses: float | None = None,
    operating_assets: float | None = None,
) -> float | None:
    """Deterministic PLI value, or None when a required input is missing/zero (undetermined, §46)."""
    if pli_type == "operating_margin":
        if revenue in (None, 0) or operating_profit is None:
            return None
        return operating_profit / revenue
    if pli_type == "full_cost_markup":
        if total_costs in (None, 0) or operating_profit is None:
            return None
        return operating_profit / total_costs
    if pli_type == "berry_ratio":
        if gross_profit is None or operating_expenses in (None, 0):
            return None
        return gross_profit / operating_expenses
    if pli_type == "return_on_assets":
        if operating_profit is None or operating_assets in (None, 0):
            return None
        return operating_profit / operating_assets
    return None
