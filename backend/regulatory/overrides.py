"""Overlay practitioner overrides onto resolved rule context (PRD Class 1, S8).

Deterministic + auditable: an override overlays `override_value` (a partial dict of fields) onto the matching
rule and marks it `overridden` with a reason — the pre-override values of exactly those fields are preserved in
`original`, so the original is never lost. The registry itself is untouched; overrides live per engagement.
"""
from __future__ import annotations


def apply_overrides(context: list[dict], overrides: list[dict]) -> list[dict]:
    """Return `context` with any matching overrides overlaid. Each entry gains `overridden` / `override_reason`
    / `original`; overridden entries also carry the overlaid fields from `override_value`."""
    by_key = {o["rule_key"]: o for o in overrides}
    out: list[dict] = []
    for c in context:
        o = by_key.get(c["rule_key"])
        if o is None:
            out.append({**c, "overridden": False, "override_reason": None, "original": None})
            continue
        override_value = o.get("override_value") or {}
        original = {k: c.get(k) for k in override_value}       # preserve the pre-override values of overlaid fields
        out.append({**c, **override_value, "overridden": True,
                    "override_reason": o.get("reason"), "original": original})
    return out
