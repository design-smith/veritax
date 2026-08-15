"""S1: the regulatory registry + engine + resolver foundation. Pure/deterministic — no DB, no LLM."""
import pytest

from pathlib import Path

import regulatory.resolver as _resolver

from regulatory import (
    MissingInput,
    apply_overrides,
    applicable_version,
    benchmarking_method,
    compute_arm_length_range,
    evaluate,
    evaluate_applicability,
    evaluate_period_compatibility,
    evaluate_transaction_scope,
    local_regulations_content,
    position_in_range,
    regulatory_context,
    regulatory_snapshot,
    resolve_rules,
)
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


# ── Requirements bridge (S2 Part B): jurisdiction-level context for the Requirements view ──
def test_regulatory_context_maps_country_name_and_iso_code():
    # resolve_requirements keys on 'Qatar'; the registry dir is 'QA' — both must resolve to the same rules.
    by_name = regulatory_context("Qatar", "2024")
    by_code = regulatory_context("QA", "2024")
    assert by_name and {r["rule_key"] for r in by_name} == {r["rule_key"] for r in by_code}
    assert {"local_file_required", "master_file_required"} <= {r["rule_key"] for r in by_name}


def test_regulatory_context_carries_sources_and_is_unknown_without_facts():
    # Foreign AE known but turnover not captured → the single missing input is the turnover.
    lf = next(r for r in regulatory_context("Qatar", "2024", {"has_foreign_associated_enterprise": True})
              if r["rule_key"] == "local_file_required")
    assert lf["plain_english"] and lf["verification_status"] == "verified" and lf["effective_from"] == "2020-01-01"
    assert any("Resolution" in s["title"] for s in lf["sources"])
    # Missing financials → unknown, not a guess (PRD §36).
    assert lf["status"] == "unknown" and lf["missing_input"] == "annual_turnover_or_assets" and lf["result"] is None


def test_regulatory_context_applies_with_facts():
    lf = next(r for r in regulatory_context(
        "Qatar", "2024", {"annual_turnover_or_assets": 60_000_000, "has_foreign_associated_enterprise": True}
    ) if r["rule_key"] == "local_file_required")
    assert lf["status"] == "applied" and lf["result"] is True


def test_regulatory_context_empty_for_unregistered_jurisdiction():
    assert regulatory_context("Netherlands", "2024") == []


# ── Transaction scope & materiality (S3): reuses the S1 engine per controlled-transaction category ──
def test_transaction_scope_in_scope_below_and_unknown():
    out = evaluate_transaction_scope(
        [{"category": "Services", "amount": 250000}, {"category": "Royalties", "amount": 150000}, {"category": "Goods"}],
        "Qatar", "2024",
    )
    assert out["threshold"] == 200000 and out["currency"] == "QAR"
    by = {c["category"]: c for c in out["categories"]}
    assert by["Services"]["status"] == "in_scope"
    assert by["Royalties"]["status"] == "below_threshold"
    assert by["Goods"]["status"] == "unknown" and by["Goods"]["missing_input"] == "category_annual_amount"
    assert out["summary"] == {"total": 3, "in_scope": 1, "below_threshold": 1, "unknown": 1, "status": "evaluated"}


def test_transaction_scope_aggregates_by_category():
    out = evaluate_transaction_scope(
        [{"category": "Services", "amount": 120000}, {"category": "Services", "amount": 120000}], "Qatar", "2024")
    assert out["summary"]["total"] == 1
    assert out["categories"][0]["status"] == "in_scope" and out["categories"][0]["amount"] == 240000


def test_transaction_scope_does_not_net_opposing_flows():
    # Income +300k and expense -300k in one category must NOT net to zero (GTA no-netting rule).
    out = evaluate_transaction_scope(
        [{"category": "Loans", "amount": 300000}, {"category": "Loans", "amount": -300000}], "Qatar", "2024")
    assert out["categories"][0]["amount"] == 600000 and out["categories"][0]["status"] == "in_scope"


def test_transaction_scope_no_rule_for_unregistered_jurisdiction():
    out = evaluate_transaction_scope([{"category": "Services", "amount": 999999}], "Netherlands", "2024")
    assert out["summary"]["status"] == "no_rule" and out["categories"] == []


def test_regulatory_context_includes_materiality_rule():
    mat = [r for r in regulatory_context("Qatar", "2024") if r["rule_category"] == "materiality"]
    assert mat and mat[0]["threshold"] == 200000 and mat[0]["currency"] == "QAR"
    assert mat[0]["verification_status"] == "verified" and mat[0]["sources"]


# ── Fiscal-year compatibility (S4): methodology bands, show-don't-block ──
def test_period_compatibility_bands():
    assert evaluate_period_compatibility("FY2024", "2024")["status"] == "exact"
    assert evaluate_period_compatibility(2024, 2023)["status"] == "acceptable_mismatch"
    assert evaluate_period_compatibility(2024, 2022)["status"] == "review_required"
    inc = evaluate_period_compatibility(2024, 2020)
    assert inc["status"] == "incompatible" and inc["gap_years"] == 4


def test_period_compatibility_business_change_forces_review_even_when_aligned():
    r = evaluate_period_compatibility(2024, 2024, business_change=True)
    assert r["status"] == "review_required" and r["business_change"] is True


def test_period_compatibility_unknown_when_period_missing():
    assert evaluate_period_compatibility(None, 2024)["status"] == "unknown"
    assert evaluate_period_compatibility("no-year", "also none")["status"] == "unknown"


# ── Benchmarking statistical config + calc (S5): reproducible range, no comparable search ──
def test_arm_length_interquartile_range_is_reproducible():
    r = compute_arm_length_range([1, 2, 3, 4, 5, 6, 7, 8])  # default = interquartile / inclusive
    assert r["status"] == "computed" and r["n"] == 8
    assert r["lower"] == pytest.approx(2.75) and r["upper"] == pytest.approx(6.25) and r["median"] == 4.5
    assert r["method"] == "interquartile_range" and r["quartile_method"] == "inclusive"
    # Explicit quartile convention changes the bounds deterministically.
    ex = compute_arm_length_range([1, 2, 3, 4, 5, 6, 7, 8], quartile_method="exclusive")
    assert ex["lower"] == pytest.approx(2.25) and ex["upper"] == pytest.approx(6.75)


def test_arm_length_full_range_and_insufficient_and_unknown():
    assert (compute_arm_length_range([3, 1, 9, 5], method="full_range")["lower"],
            compute_arm_length_range([3, 1, 9, 5], method="full_range")["upper"]) == (1.0, 9.0)
    assert compute_arm_length_range([1, 2, 3])["status"] == "insufficient"   # < 4 for an IQR
    assert compute_arm_length_range([])["status"] == "unknown"


def test_position_in_range():
    rng = compute_arm_length_range([1, 2, 3, 4, 5, 6, 7, 8])  # [2.75, 6.25]
    assert position_in_range(4.0, rng) == "within"
    assert position_in_range(1.0, rng) == "below"
    assert position_in_range(9.0, rng) == "above"
    assert position_in_range(None, rng) == "unknown"


def test_benchmarking_method_defaults_when_no_jurisdiction_rule():
    m = benchmarking_method("Qatar", "2024")   # no benchmarking rule seeded → documented methodology default
    assert m["method"] == "interquartile_range" and m["quartile_method"] == "inclusive"
    assert m["verification_status"] == "methodology_default" and m["source"] is None


# ── Regulatory snapshot + deterministic Local Regulations content (S6) ──
def test_regulatory_snapshot_pins_resolved_rule_versions():
    snap = regulatory_snapshot("Qatar", "2024")
    assert snap["jurisdiction"] == "Qatar" and snap["code"] == "QA" and snap["fiscal_year"] == "2024"
    keys = {r["rule_key"] for r in snap["rules"]}
    assert {"local_file_required", "master_file_required", "transaction_category_materiality"} <= keys
    assert all("version" in r and "verification_status" in r for r in snap["rules"])


def test_local_regulations_content_restates_rules_with_sources():
    md = local_regulations_content("Qatar", "2024")
    assert md and "Local File" in md and "200,000" in md and "Resolution" in md
    assert local_regulations_content("Netherlands", "2024") is None   # no registry rules → no section


# ── Practitioner overrides (S8): overlay + audit, original never lost ──
def test_apply_overrides_overlays_and_preserves_original():
    ctx = [
        {"rule_key": "local_file_required", "status": "unknown", "result": None},
        {"rule_key": "master_file_required", "status": "unknown", "result": None},
    ]
    overrides = [{"rule_key": "local_file_required", "override_value": {"status": "applied", "result": True},
                  "reason": "Confirmed by the controller."}]
    out = apply_overrides(ctx, overrides)
    lf = next(c for c in out if c["rule_key"] == "local_file_required")
    assert lf["overridden"] is True and lf["status"] == "applied" and lf["result"] is True
    assert lf["override_reason"] == "Confirmed by the controller."
    assert lf["original"] == {"status": "unknown", "result": None}      # original preserved for audit
    mf = next(c for c in out if c["rule_key"] == "master_file_required")
    assert mf["overridden"] is False and mf["original"] is None


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
