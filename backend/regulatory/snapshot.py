"""Regulatory snapshot + deterministic Local Regulations draft content (PRD Class 1, S6).

The snapshot pins the resolved rule versions for an engagement's (jurisdiction, fiscal_year) so Requirements,
Draft, and Risks all reason from the SAME resolved rules (PRD §40). The Local Regulations section is generated
DETERMINISTICALLY from those rules (templated prose, no LLM) — it restates the registry, adds no new claims,
and cites each rule's primary source.
"""
from __future__ import annotations

from .resolver import _name_to_code, regulatory_context, resolve_rules


def regulatory_snapshot(country: str, fiscal_year: str | int | None) -> dict:
    """The resolved rule versions for this engagement — persisted so every stage shares one snapshot."""
    code = _name_to_code().get(str(country).lower(), str(country))
    rules = resolve_rules(code, fiscal_year)
    return {
        "jurisdiction": country,
        "code": code,
        "fiscal_year": None if fiscal_year is None else str(fiscal_year),
        "rules": [
            {"rule_key": r.rule_key, "rule_category": r.rule_category, "version": r.version,
             "verification_status": r.verification_status,
             "effective_from": r.effective_from, "effective_to": r.effective_to}
            for r in rules
        ],
    }


def _label(rule_key: str) -> str:
    return rule_key.replace("_required", "").replace("_", " ").title()


def local_regulations_content(country: str, fiscal_year: str | int | None) -> str | None:
    """Deterministic markdown for the Local Regulations section — None when the jurisdiction has no rules yet."""
    ctx = regulatory_context(country, fiscal_year)
    if not ctx:
        return None
    fy = f" (FY {fiscal_year})" if fiscal_year else ""
    lines = [f"Documentation applicability and materiality for {country}{fy}, resolved from versioned regulatory rules:", ""]
    for c in ctx:
        sources = "; ".join(s["title"] for s in c["sources"]) or "no primary source on file"
        eff = c["effective_from"] + (f"–{c['effective_to']}" if c["effective_to"] else "")
        lines.append(f"- **{_label(c['rule_key'])}** — {c['plain_english']} *({sources}; {c['verification_status']}; effective {eff}.)*")
    lines += ["", "Rules are resolved as of the engagement's fiscal year; applicability against this entity's own facts is shown on the Requirements tab."]
    return "\n".join(lines)
