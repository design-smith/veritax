"""Resolve the regulatory rules applicable to a (jurisdiction, fiscal_year), then evaluate applicability.

Version selection is deterministic (PRD §9): a rule applies to a fiscal year if the year-end falls inside its
[effective_from, effective_to] window; when a rule_key has several versions, the most recent applicable one
wins. 2026 rules never apply to a 2023 file.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

from .engine import MissingInput, evaluate
from .schemas import JurisdictionProfile, RegulatoryRule

_JURISDICTIONS_DIR = Path(__file__).parent / "jurisdictions"


@dataclass
class RuleResult:
    rule_key: str
    status: str                          # "applied" | "unknown"
    result: Any
    plain_english: str
    source_ids: list[str]
    verification_status: str
    missing_input: str | None = None
    rule_category: str = ""


def _fiscal_year_end(fiscal_year: str | int | None) -> date:
    """A fiscal year is 'covered' at its year-end. Falls back to the current year when unparseable."""
    m = re.search(r"\d{4}", str(fiscal_year or ""))
    year = int(m.group()) if m else date.today().year
    return date(year, 12, 31)


def _in_window(rule: RegulatoryRule, as_of: date) -> bool:
    start = date.fromisoformat(rule.effective_from)
    end = date.fromisoformat(rule.effective_to) if rule.effective_to else None
    return start <= as_of and (end is None or as_of <= end)


def applicable_version(rules: list[RegulatoryRule], fiscal_year: str | int | None) -> list[RegulatoryRule]:
    """Pure: pick the version of each rule_key in force at the fiscal year-end (latest effective_from wins)."""
    as_of = _fiscal_year_end(fiscal_year)
    best: dict[str, RegulatoryRule] = {}
    for r in rules:
        if not _in_window(r, as_of):
            continue
        current = best.get(r.rule_key)
        if current is None or date.fromisoformat(r.effective_from) > date.fromisoformat(current.effective_from):
            best[r.rule_key] = r
    return list(best.values())


@lru_cache(maxsize=64)
def _load_profiles(jurisdiction: str) -> tuple[RegulatoryRule, ...]:
    juris_dir = _JURISDICTIONS_DIR / jurisdiction
    if not juris_dir.is_dir():
        return ()
    rules: list[RegulatoryRule] = []
    for path in sorted(juris_dir.glob("*.json")):
        profile = JurisdictionProfile.model_validate_json(path.read_text(encoding="utf-8"))
        rules.extend(profile.rules)
    return tuple(rules)


def resolve_rules(jurisdiction: str, fiscal_year: str | int | None) -> list[RegulatoryRule]:
    """The regulatory rules in force for this jurisdiction + fiscal year (PRD §9). () if none defined."""
    return applicable_version(list(_load_profiles(jurisdiction)), fiscal_year)


@lru_cache(maxsize=1)
def _name_to_code() -> dict[str, str]:
    """Map a jurisdiction's country name AND ISO code → its registry directory. `resolve_requirements` keys on
    country names ('Qatar'); the registry directories are ISO codes ('QA'), so the Requirements surface needs
    this bridge."""
    out: dict[str, str] = {}
    if not _JURISDICTIONS_DIR.is_dir():
        return out
    for d in sorted(_JURISDICTIONS_DIR.iterdir()):
        if not d.is_dir():
            continue
        for p in d.glob("*.json"):
            prof = JurisdictionProfile.model_validate_json(p.read_text(encoding="utf-8"))
            out[prof.name.lower()] = d.name
            out[prof.jurisdiction.lower()] = d.name
    return out


@lru_cache(maxsize=64)
def _sources_for(jurisdiction: str) -> dict[str, Any]:
    juris_dir = _JURISDICTIONS_DIR / jurisdiction
    out: dict[str, Any] = {}
    if not juris_dir.is_dir():
        return out
    for p in sorted(juris_dir.glob("*.json")):
        prof = JurisdictionProfile.model_validate_json(p.read_text(encoding="utf-8"))
        for s in prof.sources:
            out[s.source_id] = s
    return out


def regulatory_context(country: str, fiscal_year: str | int | None, facts: dict[str, Any] | None = None) -> list[dict]:
    """Jurisdiction-level regulatory basis for the Requirements view: the applicability rules in force for this
    country + fiscal year, each with plain-English text, applied/unknown determination, effective period,
    verification status, and resolved primary sources (PRD §11-12). [] when no registry rules exist yet."""
    code = _name_to_code().get(str(country).lower(), str(country))
    applic = [r for r in resolve_rules(code, fiscal_year) if r.rule_category == "applicability"]
    if not applic:
        return []
    sources = _sources_for(code)
    results = {rr.rule_key: rr for rr in evaluate_applicability(applic, facts or {})}
    out: list[dict] = []
    for rule in applic:
        rr = results[rule.rule_key]
        out.append({
            "rule_key": rule.rule_key,
            "plain_english": rule.plain_english,
            "status": rr.status,                 # "applied" | "unknown"
            "result": rr.result,
            "missing_input": rr.missing_input,
            "effective_from": rule.effective_from,
            "effective_to": rule.effective_to,
            "verification_status": rule.verification_status,
            "sources": [
                {"title": s.title, "issuing_authority": s.issuing_authority,
                 "url": s.url, "citation_locator": s.citation_locator}
                for sid in rule.source_ids if (s := sources.get(sid)) is not None
            ],
        })
    return out


def evaluate_applicability(rules: list[RegulatoryRule], facts: dict[str, Any]) -> list[RuleResult]:
    """Evaluate every `applicability` rule against `facts` (PRD §5.2, §36). Missing input -> unknown, not a guess."""
    out: list[RuleResult] = []
    for rule in rules:
        if rule.rule_category != "applicability":
            continue
        try:
            met = evaluate(rule.conditions, facts)
        except MissingInput as m:
            out.append(RuleResult(rule.rule_key, "unknown", None, rule.plain_english, rule.source_ids,
                                  rule.verification_status, missing_input=m.field, rule_category=rule.rule_category))
            continue
        # Boolean applicability: the stated result when conditions hold, its negation when they don't.
        result = rule.result if met else (not rule.result if isinstance(rule.result, bool) else None)
        out.append(RuleResult(rule.rule_key, "applied", result, rule.plain_english, rule.source_ids,
                              rule.verification_status, rule_category=rule.rule_category))
    return out
