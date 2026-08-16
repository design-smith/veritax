"""Which fact_types are functional (Class 2 §7), and validation of their far_type (§8, §46).

A functional assertion is stored as an ExtractedFact/CanonicalFact with a `far_type` naming WHAT (function/
asset/risk) it concerns. Promotion to canonical is gated on the far_type being a known ontology value — the
deterministic guard that prevents the LLM inventing categories or promoting unsupported conclusions (§45).
"""
from __future__ import annotations

from .ontology import valid_far_value

FUNCTIONAL_FACT_TYPES = frozenset(
    {"function_performed", "asset_used", "risk_assumed", "risk_controlled", "capability"}
)


def is_functional_fact_type(fact_type: str) -> bool:
    return fact_type in FUNCTIONAL_FACT_TYPES


def functional_fact_ok(fact_type: str, far_type: str | None) -> bool:
    """A functional fact is valid only if its far_type is a known ontology value; non-functional facts pass."""
    if not is_functional_fact_type(fact_type):
        return True
    return bool(far_type) and valid_far_value(fact_type, far_type)
