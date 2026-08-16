"""Class 2 — Functional & Evidence Intelligence: controlled FAR ontology + evidence-backed operational model.

Deterministic where it matters (PRD §45): the ontology fixes the allowed functions/assets/risks/capabilities/
characterizations; the LLM may only classify INTO these values, never invent categories or decide conclusions.
"""

from .facts import FUNCTIONAL_FACT_TYPES, functional_fact_ok, is_functional_fact_type
from .questions import question_modules_version, select_questions
from .ontology import (
    assets,
    capabilities,
    characterizations,
    functions,
    ontology_version,
    risks,
    valid_asset,
    valid_capability,
    valid_characterization,
    valid_far_value,
    valid_function,
    valid_risk,
)

__all__ = [
    "functions", "assets", "risks", "capabilities", "characterizations", "ontology_version",
    "valid_function", "valid_asset", "valid_risk", "valid_capability", "valid_characterization",
    "valid_far_value",
    "FUNCTIONAL_FACT_TYPES", "is_functional_fact_type", "functional_fact_ok",
    "select_questions", "question_modules_version",
]
