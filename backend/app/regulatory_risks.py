"""Deterministic regulatory Risk findings (PRD Class 1, S7).

Rules decide — no LLM. Each finding NAMES the rule it derives from. Inputs that don't exist yet (structured
transactions, comparable sets) simply produce no finding — never a fabricated one (PRD §36). Findings reuse the
`risks.Finding` shape so they persist through the existing risk pipeline unchanged.
"""
from __future__ import annotations

import re
from datetime import date

from regulatory import (
    compute_arm_length_range,
    evaluate_period_compatibility,
    evaluate_transaction_scope,
    position_in_range,
    resolve_rules,
)
from regulatory.resolver import _name_to_code

from .risks import Evidence, Finding


def _year(period) -> int | None:
    m = re.search(r"\d{4}", str(period if period is not None else ""))
    return int(m.group()) if m else None


def _filing_findings(rules, jurisdiction: str, fiscal_year, as_of: date | None) -> list[Finding]:
    rule = next((r for r in rules if r.rule_category == "filing"), None)
    fy = _year(fiscal_year)
    if rule is None or fy is None or not isinstance(rule.result, dict):
        return []
    try:
        deadline = date(fy + int(rule.result.get("year_offset", 1)),
                        int(rule.result["due_month"]), int(rule.result["due_day"]))
    except (KeyError, ValueError, TypeError):
        return []
    ref = as_of or date.today()
    src = "; ".join(rule.source_ids)
    ev = [Evidence("rule", rule.rule_key, f"Deadline {deadline.isoformat()} per {src}.")]
    if ref > deadline:
        return [Finding(
            kind="exposure", title=f"{jurisdiction} Local File filing deadline has passed",
            description=(f"The Local File was due {deadline.isoformat()} ({rule.plain_english}) As of "
                         f"{ref.isoformat()} the deadline has passed; late documentation can expose the taxpayer to penalties."),
            severity="high", exposure_label="Late filing", exposure_estimated=True, confidence="high",
            evidence=ev,
            recommendations=["Confirm the filing status; if unfiled, prioritise submission and assess penalty exposure."])]
    if (deadline - ref).days <= 90:
        return [Finding(
            kind="exposure", title=f"{jurisdiction} Local File filing deadline is approaching",
            description=(f"The Local File is due {deadline.isoformat()} ({rule.plain_english}) As of "
                         f"{ref.isoformat()} that is within 90 days."),
            severity="medium", exposure_label="Upcoming deadline", exposure_estimated=True, confidence="high",
            evidence=ev,
            recommendations=["Ensure the documentation is complete before the deadline."])]
    return []


def regulatory_findings(jurisdiction: str, fiscal_year, *, as_of: date | None = None,
                        transactions: list[dict] | None = None, documented_categories: list[str] | None = None,
                        benchmark: dict | None = None) -> list[Finding]:
    """Deterministic regulatory findings for an engagement. Only emits a finding where inputs support it."""
    code = _name_to_code().get(str(jurisdiction).lower(), str(jurisdiction))
    rules = resolve_rules(code, fiscal_year)
    out: list[Finding] = []
    out += _filing_findings(rules, jurisdiction, fiscal_year, as_of)

    # A controlled-transaction category in scope by materiality but not documented.
    if transactions is not None:
        scope = evaluate_transaction_scope(transactions, jurisdiction, fiscal_year)
        documented = {c.lower() for c in (documented_categories or [])}
        cur = scope["currency"] or ""
        for cat in scope["categories"]:
            if cat["status"] == "in_scope" and cat["category"].lower() not in documented:
                out.append(Finding(
                    kind="exposure", title=f"Controlled transaction not documented: {cat['category']}",
                    description=(f"The '{cat['category']}' category (~{cat['amount']:.0f} {cur}) is at or above the "
                                 f"materiality threshold ({scope['rule_key']}) and must be covered in the Local File, "
                                 "but no documentation was found."),
                    severity="high", exposure_label="Undocumented in-scope transaction", exposure_estimated=True,
                    confidence="high",
                    evidence=[Evidence("rule", scope["rule_key"], f"In scope at >= {scope['threshold']} {cur}.")],
                    recommendations=[f"Document the {cat['category']} category or explain why it is out of scope."]))

    # Benchmark: tested result outside the arm's-length range, and/or stale comparable data.
    if benchmark:
        rng = compute_arm_length_range(benchmark["results"], method=benchmark.get("method", "interquartile_range"),
                                       quartile_method=benchmark.get("quartile_method", "inclusive"))
        pos = position_in_range(benchmark.get("tested_result"), rng)
        if pos in ("below", "above"):
            out.append(Finding(
                kind="exposure", title=f"Tested result is {pos} the arm's-length range",
                description=(f"The tested result {benchmark['tested_result']} is {pos} the {rng['method']} range "
                             f"[{rng['lower']}, {rng['upper']}] (n={rng['n']}); a result outside the range indicates "
                             "transfer-pricing exposure."),
                severity="high", exposure_label="Outside arm's-length range", exposure_estimated=True, confidence="high",
                evidence=[Evidence("figure", "arm_length_range",
                                   f"{rng['method']} [{rng['lower']}, {rng['upper']}], tested {benchmark['tested_result']}.")],
                recommendations=["Review the comparable set and the tested party's result; consider an adjustment."]))
        comp_period = benchmark.get("comparable_period")
        if comp_period is not None:
            comp = evaluate_period_compatibility(fiscal_year, comp_period)
            if comp["status"] in ("review_required", "incompatible"):
                out.append(Finding(
                    kind="exposure", title="Benchmark comparable data may be stale",
                    description=f"{comp['explanation']} Stale comparable data weakens the benchmarking analysis.",
                    severity="medium" if comp["status"] == "review_required" else "high",
                    exposure_label="Stale benchmark", exposure_estimated=True, confidence="high",
                    evidence=[Evidence("figure", "fiscal_year_compatibility", comp["explanation"])],
                    recommendations=["Refresh the comparable search to a contemporaneous data year."]))
    return out
