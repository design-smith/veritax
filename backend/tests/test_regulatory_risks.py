"""S7: deterministic regulatory risk findings — rules decide, each finding names its rule. Pure (no DB/LLM)."""
from datetime import date

from app.regulatory_risks import regulatory_findings


def test_filing_deadline_passed_approaching_and_ok():
    # FY2024 → deadline 30 Jun 2025 (Qatar filing rule).
    passed = regulatory_findings("Qatar", "FY2024", as_of=date(2026, 1, 1))
    assert any("filing deadline has passed" in f.title for f in passed)
    assert all(f.kind == "exposure" and f.confidence == "high" for f in passed)
    approaching = regulatory_findings("Qatar", "FY2024", as_of=date(2025, 5, 1))
    assert any("approaching" in f.title for f in approaching)
    ok = regulatory_findings("Qatar", "FY2026", as_of=date(2026, 1, 1))   # deadline 2027-06-30, far off
    assert not any("filing deadline" in f.title for f in ok)


def test_no_finding_without_fiscal_year_or_rule():
    assert regulatory_findings("Qatar", None, as_of=date(2026, 1, 1)) == []          # no fiscal year
    assert regulatory_findings("Netherlands", "FY2020", as_of=date(2026, 1, 1)) == []  # no registry rules


def test_missing_mandatory_transaction_finding_names_the_rule():
    fs = regulatory_findings("Qatar", "FY2024", as_of=date(2020, 1, 1),   # as_of pre-deadline → isolate this finding
                             transactions=[{"category": "Royalties", "amount": 300000}])
    hit = next(f for f in fs if "not documented: Royalties" in f.title)
    assert hit.evidence[0].reference == "transaction_category_materiality"   # names the rule
    # Documenting the category clears the finding.
    cleared = regulatory_findings("Qatar", "FY2024", as_of=date(2020, 1, 1),
                                  transactions=[{"category": "Royalties", "amount": 300000}],
                                  documented_categories=["Royalties"])
    assert not any("not documented" in f.title for f in cleared)


def test_benchmark_outside_range_and_stale_data():
    fs = regulatory_findings("Qatar", "FY2024", as_of=date(2020, 1, 1),
                             benchmark={"results": [1, 2, 3, 4, 5, 6, 7, 8], "tested_result": 0.5,
                                        "comparable_period": 2020})
    assert any("below the arm's-length range" in f.title for f in fs)
    assert any("stale" in f.title.lower() for f in fs)
