"""S3: Industry Analysis is injected into the DRAFT element list only (never into resolve_requirements),
so coverage/assessment/matching stay untouched and it never creates a requirement row / gates the draft."""
import dataclasses

import pytest

from app.drafting import DraftResult, FakeResearchDrafter, validate_research
from app.requirements import draft_elements, resolve_requirements


def test_fake_research_drafter_produces_card_and_web_citation():
    r = FakeResearchDrafter().draft_research("VOS", "Qatar", "FY2024")
    assert isinstance(r, DraftResult)
    assert r.content.strip() and "FY2024" in r.content
    assert r.research and r.research["market"] == "Qatar" and r.research["period"] == "FY2024"
    assert r.research["sources"] and r.research["sources"][0]["url"]
    assert r.citations and r.citations[0].kind == "web" and r.citations[0].url


# ── Quality guardrails (S5): contemporaneous, specific, sourced — not generic filler ──
def _good() -> DraftResult:
    return FakeResearchDrafter().draft_research("VOS", "Qatar", "FY2024")


def test_validate_research_accepts_a_compliant_analysis():
    validate_research(_good(), "VOS", "FY2024")   # does not raise
    validate_research(_good(), None, None)         # tolerant of missing entity/fiscal-year context


def test_validate_research_rejects_undersourced():
    r = dataclasses.replace(_good(), citations=_good().citations[:1])   # only one web source
    with pytest.raises(RuntimeError, match="sourced"):
        validate_research(r, "VOS", "FY2024")


def test_validate_research_rejects_uncited_claims():
    r = dataclasses.replace(_good(), content="## Industry Analysis\n\nThe tested party grew 9% with no markers.")
    with pytest.raises(RuntimeError, match="citation markers"):
        validate_research(r, "VOS", "FY2024")


def test_validate_research_rejects_no_figures():
    r = dataclasses.replace(_good(), content="## Industry Analysis\n\nGeneric prose about the tested party.[1][2]")
    with pytest.raises(RuntimeError, match="specific figures"):
        validate_research(r, "VOS", "FY2024")


def test_validate_research_rejects_missing_tested_party_linkage():
    r = dataclasses.replace(_good(), content="## Industry Analysis\n\nThe market grew 9%[1] amid wage inflation.[2]")
    with pytest.raises(RuntimeError, match="tested party"):
        validate_research(r, "SomeUnmentionedEntity", "FY2024")


def test_validate_research_rejects_fiscal_year_mismatch():
    with pytest.raises(RuntimeError, match="fiscal year"):
        validate_research(_good(), "VOS", "FY2019")   # engagement FY not present in the analysis


def test_draft_elements_injects_industry_analysis_after_business_strategy():
    els = draft_elements("United Arab Emirates")
    names = [e.element_name for e in els]
    assert "Industry Analysis" in names
    idx = names.index("Industry Analysis")
    assert "strateg" in names[idx - 1].lower()                 # right after Business Strategy
    ind = els[idx]
    assert ind.research is True and ind.required is False       # web-sourced, non-gating
    assert ind.requirement_key == "United Arab Emirates:industry_analysis"   # distinct, no key collision
    # display orders stay contiguous; three more than statutory (Industry + Functional + Economic Analysis)
    assert [e.order for e in els] == list(range(1, len(els) + 1))
    assert len(els) == len(resolve_requirements("United Arab Emirates")) + 3
    # statutory requirement_keys are preserved (coverage <-> draft linkage intact)
    statutory_keys = {e.requirement_key for e in resolve_requirements("United Arab Emirates")}
    assert statutory_keys.issubset({e.requirement_key for e in els})


def test_draft_elements_injects_functional_analysis_after_industry():
    # S12: Functional Analysis is a draft-only value-add section, injected right after Industry Analysis,
    # always present (functional evidence is per-engagement, so gate like Industry, never country-gated).
    els = draft_elements("United Arab Emirates")
    names = [e.element_name for e in els]
    assert "Functional Analysis" in names
    idx = names.index("Functional Analysis")
    assert names[idx - 1] == "Industry Analysis"                # positioned right after Industry Analysis
    fn = els[idx]
    assert fn.functional is True and fn.required is False        # deterministic, non-gating
    assert fn.requirement_key == "United Arab Emirates:functional_analysis"   # distinct, no key collision


def test_resolve_requirements_excludes_the_functional_element():
    # The statutory source of truth (coverage/matching) must not see Functional Analysis.
    els = resolve_requirements("United Arab Emirates")
    assert all(not getattr(e, "functional", False) for e in els)
    assert all(e.requirement_key != "United Arab Emirates:functional_analysis" for e in els)


def test_draft_elements_injects_economic_analysis_after_functional():
    # S15: Economic Analysis is a draft-only value-add section, injected right after Functional Analysis.
    els = draft_elements("United Arab Emirates")
    names = [e.element_name for e in els]
    assert "Economic Analysis" in names
    idx = names.index("Economic Analysis")
    assert names[idx - 1] == "Functional Analysis"              # positioned right after Functional Analysis
    ec = els[idx]
    assert ec.economic is True and ec.required is False          # deterministic, non-gating
    assert ec.requirement_key == "United Arab Emirates:economic_analysis"   # distinct, no key collision


def test_resolve_requirements_excludes_the_economic_element():
    els = resolve_requirements("United Arab Emirates")
    assert all(not getattr(e, "economic", False) for e in els)
    assert all(e.requirement_key != "United Arab Emirates:economic_analysis" for e in els)


def test_draft_elements_falls_after_profile_when_no_strategy_element():
    els = draft_elements("Singapore")                          # IRAS list has no standalone strategy element
    names = [e.element_name for e in els]
    assert names.index("Industry Analysis") == 1               # right after the entity profile (index 0)


def test_resolve_requirements_excludes_the_research_element():
    # The statutory source of truth (coverage/matching) must not see Industry Analysis.
    els = resolve_requirements("United Arab Emirates")
    assert all(not e.research for e in els)
    assert all(e.requirement_key != "United Arab Emirates:industry_analysis" for e in els)


def test_draft_elements_empty_for_unknown_jurisdiction():
    assert draft_elements("Narnia") == ()
