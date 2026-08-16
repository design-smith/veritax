"""Controlled, versioned FAR ontology (PRD Class 2, S1 — §8-10, §30).

The allowed functions/assets/risks/capabilities/characterizations are fixed here so the LLM can only classify
INTO these values, never invent categories (§8 "do not let the LLM invent arbitrary FAR categories"). Extensible
via the JSON + a version bump.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "far_ontology.json"


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads(_DATA_PATH.read_text(encoding="utf-8"))


def ontology_version() -> int:
    return int(_data()["version"])


@lru_cache(maxsize=1)
def functions() -> frozenset[str]:
    """All valid function types, flattened across categories."""
    return frozenset(f for group in _data()["functions"].values() for f in group)


def function_categories() -> dict[str, list[str]]:
    """Functions grouped by category (commercial / operational / corporate_shared / ...), for display."""
    return {k: list(v) for k, v in _data()["functions"].items()}


@lru_cache(maxsize=1)
def assets() -> frozenset[str]:
    return frozenset(_data()["assets"])


@lru_cache(maxsize=1)
def risks() -> frozenset[str]:
    return frozenset(_data()["risks"])


@lru_cache(maxsize=1)
def capabilities() -> frozenset[str]:
    """Risk-control role dimensions (§11): contractual_assumption, economic_exposure, decision_making,
    risk_control, capability, financial_capacity."""
    return frozenset(_data()["capabilities"])


@lru_cache(maxsize=1)
def characterizations() -> frozenset[str]:
    return frozenset(_data()["characterizations"])


def valid_function(value: str) -> bool:
    return value in functions()


def valid_asset(value: str) -> bool:
    return value in assets()


def valid_risk(value: str) -> bool:
    return value in risks()


def valid_capability(value: str) -> bool:
    return value in capabilities()


def valid_characterization(value: str) -> bool:
    return value in characterizations()


# Maps a functional fact_type (§7) to the taxonomy its `far_type` value must belong to.
_FACT_TYPE_TAXONOMY = {
    "function_performed": functions,
    "asset_used": assets,
    "risk_assumed": risks,
    "risk_controlled": risks,
    "capability": capabilities,
}


def valid_far_value(fact_type: str, value: str) -> bool:
    """Is `value` an allowed taxonomy value for this functional fact_type? Unknown fact_type → False."""
    taxonomy = _FACT_TYPE_TAXONOMY.get(fact_type)
    return taxonomy is not None and value in taxonomy()
