"""Deterministic resolution of a jurisdiction's fixed required-element list.

Requirements are law, not LLM output — loaded from the registry's bundled JSON, same jurisdiction → same list
every time. The assessor judges *against* these; it never authors them. This lives in the regulatory registry
(the single source of truth for jurisdiction rules); `app.requirements` re-exports it for existing callers.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path

_DATA_PATH = Path(__file__).parent / "data" / "jurisdiction_requirements.json"


@dataclass(frozen=True)
class ResolvedElement:
    requirement_key: str  # f"{country}:{order}" — unique within a jurisdiction
    order: int
    element_name: str
    description: str
    sub_requirements: tuple[str, ...]
    required: bool  # False = conditional (only a gap when its trigger applies)
    verified: bool  # True = confirmed against statute; False = needs content-ops review
    evidence_policy: dict | None = None  # {document_type: role}; drives requirement matching. None = not yet policied.
    sufficiency: dict | None = None      # evaluation policy: AND/OR tree over document types. None = any primary.
    requires_executed: bool = False      # soft scope: satisfying evidence must be executed (else invalid)
    requires_fiscal_year: bool = False   # soft scope: satisfying evidence must match the period (else invalid)
    depends_on: tuple[int, ...] = ()     # element orders that must be present, else this is blocked
    severity: str = "medium"             # how badly a gap here hurts: critical | high | medium | low
    research: bool = False               # True = web-sourced value-add section (not doc-gated, never blocks the draft)


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads(_DATA_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=32)
def resolve_requirements(country: str) -> tuple[ResolvedElement, ...]:
    """Merge base template + appended local elements + order-keyed overrides for one jurisdiction.

    Returns () for a jurisdiction not present in the seed data.
    """
    data = _data()
    juris = next((j for j in data["jurisdictions"] if j["country"] == country), None)
    if juris is None:
        return ()

    by_order: dict[int, dict] = {}
    self_contained = juris.get("local_file_elements")
    if self_contained is not None:
        # Jurisdiction carries its own curated element list (no shared base template).
        for el in self_contained:
            by_order[el["order"]] = el
    else:
        base = data["base_templates"][juris["base_template"]]
        # order -> raw element dict; base first, then local elements appended.
        for el in base["elements"]:
            by_order[el["order"]] = el
        for el in juris.get("local_specific_elements", []):
            by_order[el["order"]] = el
        # element_overrides merged by order (shallow field merge).
        for order_str, override in juris.get("element_overrides", {}).items():
            order = int(order_str)
            by_order[order] = {**by_order.get(order, {"order": order}), **override}

    resolved = [
        ResolvedElement(
            requirement_key=f"{country}:{el['order']}",
            order=el["order"],
            element_name=el["element_name"],
            description=el["description"],
            sub_requirements=tuple(el.get("sub_requirements", [])),
            required=el.get("required", True),
            verified=el.get("verified", False),
            evidence_policy=el.get("evidence_policy"),
            sufficiency=el.get("sufficiency"),
            requires_executed=el.get("requires_executed", False),
            requires_fiscal_year=el.get("requires_fiscal_year", False),
            depends_on=tuple(el.get("depends_on", ())),
            severity=el.get("severity", "medium"),
        )
        for el in sorted(by_order.values(), key=lambda e: e["order"])
    ]
    return tuple(resolved)


def available_jurisdictions() -> list[str]:
    return [j["country"] for j in _data()["jurisdictions"]]


# ── Draft-only elements ────────────────────────────────────────────────────────
# Industry Analysis is a Veritax value-add section (not a statutory element): web-sourced, positioned after
# Business Strategy, never doc-gated. It's injected ONLY into the draft (draft_elements), never into
# resolve_requirements — so coverage/assessment/matching are untouched and it never creates a requirement row.
_INDUSTRY_SUBS = (
    "Industry definition and the tested party's products/services",
    "Market overview (size/growth, demand drivers, competitive intensity, maturity, geographic market)",
    "Current-year industry conditions that explain the tested party's margins",
    "Competitive landscape and value drivers",
    "Key industry risks that connect to the FAR/risk analysis",
    "The tested party's position within the industry, and profitability context",
)


def _industry_element(country: str) -> ResolvedElement:
    return ResolvedElement(
        requirement_key=f"{country}:industry_analysis",   # distinct from statutory f"{country}:{order}" keys
        order=0,                                           # display order set by draft_elements()
        element_name="Industry Analysis",
        description=(
            "The commercial environment the tested party actually operates in, and the context for its "
            "profitability — contemporaneous and specific to the entity's industry, not generic country-level filler."
        ),
        sub_requirements=_INDUSTRY_SUBS,
        required=False,
        verified=True,
        research=True,
        severity="low",
    )


@lru_cache(maxsize=32)
def draft_elements(country: str) -> tuple[ResolvedElement, ...]:
    """Statutory elements plus the injected Industry Analysis section, in document order.

    Industry Analysis is placed right after the business-strategy element (or after the entity profile where
    a jurisdiction has no strategy element). Statutory `requirement_key`s are preserved (so the coverage↔draft
    linkage stays intact); only the display `order` is renumbered to make room for the inserted section.
    """
    base = list(resolve_requirements(country))
    if not base:
        return ()
    idx = next((i for i, e in enumerate(base) if "strateg" in e.element_name.lower()), 0)
    ordered = base[: idx + 1] + [_industry_element(country)] + base[idx + 1 :]
    return tuple(replace(e, order=i + 1) for i, e in enumerate(ordered))
