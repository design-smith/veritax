"""Pure, deterministic condition engine (PRD §6). Three-valued: True / False / MissingInput.

A leaf raises MissingInput when the fact it needs is absent — but `all`/`any` short-circuit on a decisive
branch first (an available False decides an `all`; an available True decides an `any`), so a missing fact only
surfaces as `unknown` when it actually changes the answer (PRD §36). Deliberately NOT a general language (PRD §6).
"""
from __future__ import annotations

from typing import Any

_COMPARATORS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "=": lambda a, b: a == b,
    "in": lambda a, b: a in b,
}


class MissingInput(Exception):
    """Raised when a required fact is absent and its value would change the result."""

    def __init__(self, field: str) -> None:
        self.field = field
        super().__init__(field)


def evaluate(conditions: dict[str, Any] | None, facts: dict[str, Any]) -> bool:
    """Evaluate a condition tree against `facts`. Returns bool; raises MissingInput when undecidable."""
    if conditions is None:
        return True

    if "all" in conditions:
        missing: MissingInput | None = None
        for c in conditions["all"]:
            try:
                if not evaluate(c, facts):
                    return False            # one decisive False settles the AND
            except MissingInput as m:
                missing = m
        if missing:
            raise missing                   # no False found, but a branch was undecidable
        return True

    if "any" in conditions:
        missing = None
        for c in conditions["any"]:
            try:
                if evaluate(c, facts):
                    return True             # one decisive True settles the OR
            except MissingInput as m:
                missing = m
        if missing:
            raise missing
        return False

    if "not" in conditions:
        return not evaluate(conditions["not"], facts)

    # Leaf: {"field", "operator", "value"?}
    field = conditions["field"]
    operator = str(conditions["operator"]).lower()
    if operator == "exists":
        return field in facts and facts[field] is not None
    if field not in facts or facts[field] is None:
        raise MissingInput(field)
    op = _COMPARATORS.get(operator)
    if op is None:
        raise ValueError(f"unsupported operator: {conditions['operator']}")
    return bool(op(facts[field], conditions.get("value")))
