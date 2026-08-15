"""Class 1 — Regulatory Intelligence: versioned, deterministic jurisdiction rules.

Deterministic engine only — the LLM never decides applicability/materiality/deadlines (PRD §2). Rules live in
version-controlled JSON under jurisdictions/<CC>/, resolved by (jurisdiction, fiscal_year) and evaluated by a
pure condition engine. Missing input yields `unknown`, never a guess (PRD §36).
"""

from .engine import MissingInput, evaluate
from .resolver import (
    RuleResult,
    applicable_version,
    evaluate_applicability,
    regulatory_context,
    resolve_rules,
)
from .period import evaluate_period_compatibility
from .schemas import JurisdictionProfile, RegulatoryRule, RegulatorySource
from .scope import CategoryScope, evaluate_transaction_scope

__all__ = [
    "MissingInput", "evaluate",
    "RuleResult", "applicable_version", "evaluate_applicability", "regulatory_context", "resolve_rules",
    "CategoryScope", "evaluate_transaction_scope",
    "evaluate_period_compatibility",
    "JurisdictionProfile", "RegulatoryRule", "RegulatorySource",
]
