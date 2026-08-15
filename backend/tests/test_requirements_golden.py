"""S2 behaviour-preserving gate: the subsume re-point must not change resolve_requirements/draft_elements output.

`tests/data/golden_requirements.json` was captured from the pre-migration code for every jurisdiction; these
tests recompute through the registry-owned path and assert byte-identical results (all ResolvedElement fields).
"""
import dataclasses
import json
from pathlib import Path

from app.requirements import available_jurisdictions, draft_elements, resolve_requirements

_GOLDEN = json.loads((Path(__file__).parent / "data" / "golden_requirements.json").read_text(encoding="utf-8"))


def _norm(fn) -> dict:
    # Round-trip through JSON so tuples/None normalise exactly like the captured snapshot.
    return json.loads(json.dumps({c: [dataclasses.asdict(e) for e in fn(c)] for c in available_jurisdictions()}))


def test_resolve_requirements_matches_golden():
    assert _norm(resolve_requirements) == _GOLDEN["resolve"]


def test_draft_elements_matches_golden():
    assert _norm(draft_elements) == _GOLDEN["draft"]
