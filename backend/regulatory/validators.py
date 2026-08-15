"""Referential-integrity checks over a loaded jurisdiction profile (beyond pydantic's structural validation).

Catches data bugs the schema can't: a rule citing a source that isn't declared, or a condition tree using an
operator outside the deliberately-limited grammar (PRD §6). Returns a list of human-readable errors ([] = ok).
"""
from __future__ import annotations

from typing import Any

from .engine import _COMPARATORS
from .schemas import JurisdictionProfile

_ALLOWED_OPERATORS = set(_COMPARATORS) | {"exists"}


def _condition_errors(cond: dict[str, Any] | None, rule_key: str) -> list[str]:
    if cond is None:
        return []
    for group in ("all", "any"):
        if group in cond:
            errs: list[str] = []
            for sub in cond[group]:
                errs += _condition_errors(sub, rule_key)
            return errs
    if "not" in cond:
        return _condition_errors(cond["not"], rule_key)
    op = str(cond.get("operator", "")).lower()
    if op not in _ALLOWED_OPERATORS:
        return [f"rule '{rule_key}': unsupported operator {cond.get('operator')!r}"]
    if "field" not in cond:
        return [f"rule '{rule_key}': leaf condition missing 'field'"]
    return []


def validate_profile(profile: JurisdictionProfile) -> list[str]:
    errors: list[str] = []
    source_ids = {s.source_id for s in profile.sources}
    seen_keys: set[str] = set()
    for rule in profile.rules:
        for sid in rule.source_ids:
            if sid not in source_ids:
                errors.append(f"rule '{rule.rule_key}' cites undeclared source '{sid}'")
        errors += _condition_errors(rule.conditions, rule.rule_key)
        # A verified rule must be backed by at least one authoritative source (PRD §8).
        if rule.verification_status == "verified" and not rule.source_ids:
            errors.append(f"rule '{rule.rule_key}' is 'verified' but has no source")
        seen_keys.add(rule.rule_key)
    return errors
