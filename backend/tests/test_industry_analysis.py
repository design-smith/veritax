"""S3: Industry Analysis is injected into the DRAFT element list only (never into resolve_requirements),
so coverage/assessment/matching stay untouched and it never creates a requirement row / gates the draft."""
from app.requirements import draft_elements, resolve_requirements


def test_draft_elements_injects_industry_analysis_after_business_strategy():
    els = draft_elements("United Arab Emirates")
    names = [e.element_name for e in els]
    assert "Industry Analysis" in names
    idx = names.index("Industry Analysis")
    assert "strateg" in names[idx - 1].lower()                 # right after Business Strategy
    ind = els[idx]
    assert ind.research is True and ind.required is False       # web-sourced, non-gating
    assert ind.requirement_key == "United Arab Emirates:industry_analysis"   # distinct, no key collision
    # display orders stay contiguous, exactly one more element than the statutory list
    assert [e.order for e in els] == list(range(1, len(els) + 1))
    assert len(els) == len(resolve_requirements("United Arab Emirates")) + 1
    # statutory requirement_keys are preserved (coverage <-> draft linkage intact)
    statutory_keys = {e.requirement_key for e in resolve_requirements("United Arab Emirates")}
    assert statutory_keys.issubset({e.requirement_key for e in els})


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
