"""Class 1 — Regulatory Intelligence: versioned, deterministic jurisdiction rules.

Deterministic engine only — the LLM never decides applicability/materiality/deadlines (PRD §2). Rules live in
version-controlled JSON under jurisdictions/<CC>/, resolved by (jurisdiction, fiscal_year) and evaluated by a
pure condition engine. Missing input yields `unknown`, never a guess (PRD §36).
"""

from .engine import MissingInput, evaluate
from .resolver import RuleResult, applicable_version, evaluate_applicability, resolve_rules
from .schemas import JurisdictionProfile, RegulatoryRule, RegulatorySource

__all__ = [
    "MissingInput", "evaluate",
    "RuleResult", "applicable_version", "evaluate_applicability", "resolve_rules",
    "JurisdictionProfile", "RegulatoryRule", "RegulatorySource",
]
