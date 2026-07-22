"""Deterministic resolution of a jurisdiction's fixed required-element list.

Requirements are law, not LLM output — loaded from the bundled JSON, same jurisdiction → same list
every time. The assessor judges *against* these; it never authors them.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
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

    base = data["base_templates"][juris["base_template"]]
    # order -> raw element dict; base first, then local elements appended.
    by_order: dict[int, dict] = {}
    for el in base["elements"]:
        by_order[el["order"]] = el
    for el in juris.get("local_specific_elements", []):
        by_order[el["order"]] = el
    # element_overrides merged by order (shallow field merge). Empty for all seeded jurisdictions today.
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
        )
        for el in sorted(by_order.values(), key=lambda e: e["order"])
    ]
    return tuple(resolved)


def available_jurisdictions() -> list[str]:
    return [j["country"] for j in _data()["jurisdictions"]]
