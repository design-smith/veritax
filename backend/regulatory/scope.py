"""Deterministic transaction scope & materiality (PRD Class 1, S3).

Reuses the S1 condition engine: a controlled-transaction CATEGORY is in scope when its aggregate annual amount
meets the jurisdiction's materiality rule. Amounts are aggregated per category and NOT netted between opposing
flows (income/expense, acquisition/disposal) — so magnitudes are summed absolutely. A missing amount yields
`unknown`, never a guess (PRD §36).
"""
from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass

from .engine import MissingInput, evaluate
from .resolver import _leaf_value, _name_to_code, resolve_rules


@dataclass
class CategoryScope:
    category: str
    amount: float | None
    status: str                      # "in_scope" | "below_threshold" | "unknown"
    missing_input: str | None = None


def _materiality_rule(country: str, fiscal_year: str | int | None):
    code = _name_to_code().get(str(country).lower(), str(country))
    return next((r for r in resolve_rules(code, fiscal_year) if r.rule_category == "materiality"), None)


def evaluate_transaction_scope(transactions: list[dict], country: str, fiscal_year: str | int | None) -> dict:
    """Aggregate controlled transactions by category and decide scope against the jurisdiction materiality rule.

    `transactions`: [{category, amount?, currency?}]. Returns the rule context, per-category results, and a
    summary ("N categories, M in scope, K below threshold"). No materiality rule → summary status "no_rule".
    """
    rule = _materiality_rule(country, fiscal_year)
    if rule is None:
        return {"rule_key": None, "threshold": None, "currency": None, "plain_english": "",
                "categories": [], "summary": {"total": 0, "in_scope": 0, "below_threshold": 0,
                                              "unknown": 0, "status": "no_rule"}}
    threshold, currency = _leaf_value(rule.conditions, "category_annual_amount")

    # Aggregate by category (first-seen order). ponytail: sum |amount| so income/expense don't net to zero.
    agg: "OrderedDict[str, dict]" = OrderedDict()
    for t in transactions:
        slot = agg.setdefault(t["category"], {"amount": 0.0, "has": False, "currency": None})
        if t.get("amount") is not None:
            slot["amount"] += abs(t["amount"])
            slot["has"] = True
        slot["currency"] = slot["currency"] or t.get("currency") or currency

    results: list[CategoryScope] = []
    for cat, slot in agg.items():
        amount = slot["amount"] if slot["has"] else None
        try:
            met = evaluate(rule.conditions, {"category_annual_amount": amount})
            results.append(CategoryScope(cat, amount, "in_scope" if met else "below_threshold"))
        except MissingInput as m:
            results.append(CategoryScope(cat, None, "unknown", m.field))

    counts = {"in_scope": 0, "below_threshold": 0, "unknown": 0}
    for r in results:
        counts[r.status] += 1
    return {
        "rule_key": rule.rule_key,
        "threshold": threshold,
        "currency": currency,
        "plain_english": rule.plain_english,
        "categories": [vars(r) for r in results],
        "summary": {"total": len(results), **counts, "status": "evaluated"},
    }
