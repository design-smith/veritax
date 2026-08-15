"""S1: the regulatory registry + engine + resolver foundation. Pure/deterministic — no DB, no LLM."""
import pytest

from pathlib import Path

import regulatory.resolver as _resolver
from regulatory import MissingInput, applicable_version, evaluate, evaluate_applicability, resolve_rules
from regulatory.schemas import JurisdictionProfile, RegulatoryRule, RegulatorySource
from regulatory.validators import validate_profile


# ── Condition engine (three-valued: True / False / MissingInput) ──
def test_engine_comparators_and_membership():
    assert evaluate({"field": "x", "operator": ">=", "value": 50}, {"x": 50}) is True
    assert evaluate({"field": "x", "operator": ">", "value": 50}, {"x": 50}) is False
    assert evaluate({"field": "x", "operator": "<", "value": 50}, {"x": 10}) is True
    assert evaluate({"field": "c", "operator": "in", "value": ["QA", "IN"]}, {"c": "QA"}) is True
    assert evaluate({"field": "c", "operator": "in", "value": ["QA", "IN"]}, {"c": "US"}) is False


def test_engine_exists_never_raises():
    assert evaluate({"field": "g", "operator": "exists"}, {"g": 1}) is True
    assert evaluate({"field": "g", "operator": "exists"}, {}) is False


def test_engine_and_or_not_and_three_valued_missing():
    a, b = {"field": "a", "operator": "=", "value": 1}, {"field": "b", "operator": "=", "value": 2}
    assert evaluate({"not": a}, {"a": 9}) is True
    # AND: a decisive False settles it even though b is missing.
    assert evaluate({"all": [a, b]}, {"a": 9}) is False
    # AND: no False, but b missing -> undecidable.
    with pytest.raises(MissingInput) as e:
        evaluate({"all": [a, b]}, {"a": 1})
    assert e.value.field == "b"
    # OR: a decisive True settles it even though b is missing.
    assert evaluate({"any": [a, b]}, {"a": 1}) is True
    # OR: no True, b missing -> undecidable.
    with pytest.raises(MissingInput):
        evaluate({"any": [a, b]}, {"a": 9})


# ── Fiscal-year version selection (PRD §9) ──
def _rule(key, frm, to=None, result=None):
    return RegulatoryRule(rule_key=key, rule_category="threshold", effective_from=frm, effective_to=to, result=result)


def test_applicable_version_picks_the_version_in_force():
    v1 = _rule("thr", "2020-01-01", "2024-12-31", result=100)
    v2 = _rule("thr", "2025-01-01", None, result=200)
    assert [r.result for r in applicable_version([v1, v2], "FY2023")] == [100]
    assert [r.result for r in applicable_version([v1, v2], "2026")] == [200]
    # A future rule never applies to an earlier fiscal year.
    assert applicable_version([v2], "2023") == []


def test_resolve_rules_unknown_jurisdiction_is_empty():
    assert resolve_rules("ZZ", "2024") == []


# ── Qatar registry (seeded content) ──
def test_qatar_profile_resolves_and_validates():
    rules = resolve_rules("QA", "2024")
    keys = {r.rule_key for r in rules}
    assert {"local_file_required", "master_file_required"} <= keys


def test_qatar_local_file_applicability_true_false_unknown():
    rules = resolve_rules("QA", "2024")
    # Over threshold with a foreign associated enterprise -> required.
    over = evaluate_applicability(rules, {"annual_turnover_or_assets": 60_000_000, "has_foreign_associated_enterprise": True})
    lf = next(r for r in over if r.rule_key == "local_file_required")
    assert lf.status == "applied" and lf.result is True
    assert lf.verification_status == "verified" and lf.source_ids and lf.plain_english
    # Below threshold -> not required.
    under = evaluate_applicability(rules, {"annual_turnover_or_assets": 10_000_000, "has_foreign_associated_enterprise": True})
    assert next(r for r in under if r.rule_key == "local_file_required").result is False
    # Missing turnover -> unknown, not a guess (PRD §36).
    missing = evaluate_applicability(rules, {"has_foreign_associated_enterprise": True})
    lf_missing = next(r for r in missing if r.rule_key == "local_file_required")
    assert lf_missing.status == "unknown" and lf_missing.missing_input == "annual_turnover_or_assets" and lf_missing.result is None


def test_qatar_profile_provenance_and_validation():
    raw = (Path(_resolver.__file__).parent / "jurisdictions" / "QA" / "2026.json").read_text(encoding="utf-8")
    profile = JurisdictionProfile.model_validate_json(raw)
    assert validate_profile(profile) == []                       # referential integrity holds
    assert {s.source_id for s in profile.sources} >= {"qa_resolution_4_2020"}


def test_validate_profile_flags_bad_data():
    bad = JurisdictionProfile(
        jurisdiction="QA", name="Qatar",
        sources=[RegulatorySource(source_id="s1", title="t", issuing_authority="a", source_type="statute", jurisdiction="QA")],
        rules=[
            RegulatoryRule(rule_key="r1", rule_category="applicability", effective_from="2020-01-01",
                           source_ids=["missing_source"], verification_status="verified"),
            RegulatoryRule(rule_key="r2", rule_category="applicability", effective_from="2020-01-01",
                           conditions={"field": "x", "operator": "between", "value": 1}),
        ],
    )
    errs = validate_profile(bad)
    assert any("undeclared source" in e for e in errs)
    assert any("unsupported operator" in e for e in errs)
