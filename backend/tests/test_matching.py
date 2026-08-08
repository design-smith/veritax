"""Deterministic requirement-matching engine (Slice 1: present/missing, any-primary, hard-scope).

Pure unit tests — no DB, no model, no LLM — mirroring test_coverage_readiness.py.
"""

from __future__ import annotations

from app.matching import (
    ClassifiedDoc,
    FakeClassifiedDocumentsProvider,
    RequirementPolicy,
    evaluate_engagement,
    evaluate_over,
    evaluate_requirement,
    resolve_blocked,
    resolve_policies,
    suggested_sources,
)

SCOPE = {"jurisdiction": "Netherlands", "entity": "NL BV"}

_ROLES = {
    "executed_agreement": "primary",
    "invoice": "supporting",
    "annual_report": "background",
    "investor_presentation": "rejected",
}


def _policy(**kw) -> RequirementPolicy:
    base = dict(
        requirement_key="Netherlands:7",
        element_name="Material intercompany agreements",
        roles=_ROLES,
    )
    base.update(kw)
    return RequirementPolicy(**base)


def _doc(**kw) -> ClassifiedDoc:
    base = dict(
        document_id=None,
        document_type="executed_agreement",
        jurisdiction="Netherlands",
        entity="NL BV",
        fiscal_year="FY2025",
        executed=True,
    )
    base.update(kw)
    return ClassifiedDoc(**base)


def test_present_when_scoped_primary_doc_exists():
    result = evaluate_requirement(_policy(), [_doc()], scope=SCOPE)
    assert result.status == "present"
    assert [(m.doc.document_type, m.role) for m in result.matched] == [("executed_agreement", "primary")]


def test_missing_when_only_non_primary_evidence():
    # An Annual Report (background) is information, not legal evidence — the requirement stays missing.
    docs = [_doc(document_type="annual_report"), _doc(document_type="investor_presentation")]
    result = evaluate_requirement(_policy(), docs, scope=SCOPE)
    assert result.status == "missing"
    assert result.matched == []


def test_primary_doc_for_wrong_jurisdiction_is_excluded():
    result = evaluate_requirement(_policy(), [_doc(jurisdiction="Germany")], scope=SCOPE)
    assert result.status == "missing"


def test_primary_doc_for_wrong_entity_is_excluded():
    result = evaluate_requirement(_policy(), [_doc(entity="DE GmbH")], scope=SCOPE)
    assert result.status == "missing"


# ── Slice 2: evaluation policy (AND/OR), invalid, evidence detail ──────────────

# Material Agreements: Executed Agreement AND (Invoice OR Ledger).
_SUFFICIENCY = {"all": [{"doc": "executed_agreement"}, {"any": [{"doc": "invoice"}, {"doc": "ledger"}]}]}


def test_present_when_evaluation_policy_fully_satisfied():
    docs = [_doc(), _doc(document_type="invoice")]
    result = evaluate_requirement(_policy(sufficiency=_SUFFICIENCY), docs, scope=SCOPE)
    assert result.status == "present"


def test_partial_when_evaluation_policy_only_partly_satisfied():
    # Agreement present, but no evidence of activity (invoice/ledger) → partial, not present.
    result = evaluate_requirement(_policy(sufficiency=_SUFFICIENCY), [_doc()], scope=SCOPE)
    assert result.status == "partial"


def test_missing_when_evaluation_policy_wholly_unsatisfied():
    result = evaluate_requirement(
        _policy(sufficiency=_SUFFICIENCY), [_doc(document_type="annual_report")], scope=SCOPE
    )
    assert result.status == "missing"


def test_partial_reports_matched_role_and_missing_group():
    result = evaluate_requirement(_policy(sufficiency=_SUFFICIENCY), [_doc()], scope=SCOPE)
    assert result.status == "partial"
    assert [(m.doc.document_type, m.role) for m in result.matched] == [("executed_agreement", "primary")]
    assert result.missing == [["invoice", "ledger"]]


# Invalid: right document, disqualified by a soft scope check.
_SCOPE_FY = {**SCOPE, "fiscal_year": "FY2025"}


def _ag_policy(**kw) -> RequirementPolicy:
    return _policy(sufficiency={"doc": "executed_agreement"}, requires_executed=True, requires_fiscal_year=True, **kw)


def test_invalid_when_primary_evidence_is_unexecuted():
    result = evaluate_requirement(_ag_policy(), [_doc(executed=False)], scope=_SCOPE_FY)
    assert result.status == "invalid"
    assert "not executed" in result.invalid_reason


def test_invalid_when_primary_evidence_is_wrong_fiscal_year():
    result = evaluate_requirement(_ag_policy(), [_doc(fiscal_year="FY2024")], scope=_SCOPE_FY)
    assert result.status == "invalid"
    assert "FY2024" in result.invalid_reason


def test_qualified_evidence_wins_over_a_disqualified_duplicate():
    docs = [_doc(), _doc(fiscal_year="FY2024")]  # one in-year, one wrong-year
    result = evaluate_requirement(_ag_policy(), docs, scope=_SCOPE_FY)
    assert result.status == "present"


# ── Slice 3: dependencies (blocked), conditional ──────────────────────────────

def test_resolve_blocked_marks_dependent_when_upstream_not_present():
    assert resolve_blocked({"a": "present", "b": "missing"}, {"a": ["b"]}) == {"a"}


def test_resolve_blocked_is_transitive():
    status = {"a": "present", "b": "present", "c": "missing"}
    deps = {"a": ["b"], "b": ["c"]}
    assert resolve_blocked(status, deps) == {"a", "b"}  # c missing → b blocked → a blocked


def test_present_or_conditional_dependency_does_not_block():
    assert resolve_blocked({"a": "present", "b": "present"}, {"a": ["b"]}) == set()
    assert resolve_blocked({"a": "present", "b": "conditional"}, {"a": ["b"]}) == set()


def test_no_dependencies_never_blocks():
    assert resolve_blocked({"a": "missing", "b": "partial"}, {}) == set()


def _pol(key, name, *, required=True, depends_on=(), sufficiency=None, roles=None) -> RequirementPolicy:
    return RequirementPolicy(
        requirement_key=key, element_name=name, roles=roles or _ROLES,
        sufficiency=sufficiency, depends_on=depends_on, required=required,
    )


def test_evaluate_over_marks_conditional_requirements():
    evals = {e.requirement_key: e for e in evaluate_over([_pol("j:1", "Cond", required=False)], [], scope=SCOPE)}
    assert evals["j:1"].result.status == "conditional"


def test_evaluate_over_blocks_dependent_when_upstream_missing():
    pols = [
        _pol("j:9", "Method selection", sufficiency={"doc": "benchmark_study"}, roles={"benchmark_study": "primary"}),
        _pol("j:15", "Arm's-length conclusion", sufficiency={"doc": "benchmark_study"},
             roles={"benchmark_study": "primary"}, depends_on=("j:9",)),
    ]
    evals = {e.requirement_key: e for e in evaluate_over(pols, [], scope=SCOPE)}  # no evidence
    assert evals["j:9"].result.status == "missing"
    assert evals["j:15"].result.status == "blocked"
    assert "Method selection" in evals["j:15"].result.explanation


def test_evaluate_over_not_blocked_when_upstream_present():
    pols = [
        _pol("j:9", "Method selection", sufficiency={"doc": "benchmark_study"}, roles={"benchmark_study": "primary"}),
        _pol("j:15", "Arm's-length conclusion", sufficiency={"doc": "benchmark_study"},
             roles={"benchmark_study": "primary"}, depends_on=("j:9",)),
    ]
    docs = [_doc(document_type="benchmark_study")]
    evals = {e.requirement_key: e for e in evaluate_over(pols, docs, scope=SCOPE)}
    assert evals["j:9"].result.status == "present"
    assert evals["j:15"].result.status == "present"


def test_resolve_policies_inherits_base_template_evidence_policy():
    # 'Material intercompany agreements' (order 7) is on the shared OECD base template, so every OECD
    # jurisdiction inherits its evidence policy for free via the existing base-template merge.
    policies = {p.requirement_key: p for p in resolve_policies("Netherlands")}
    pol = policies["Netherlands:7"]
    assert pol.element_name == "Material intercompany agreements"
    assert pol.roles.get("executed_agreement") == "primary"
    assert pol.roles.get("investor_presentation") == "rejected"


def test_resolve_policies_only_returns_requirements_with_a_policy():
    # Only requirements carrying an evidence policy are matchable (7 Agreements, 9 Method, 15 Arm's-length).
    keys = {p.requirement_key for p in resolve_policies("Netherlands")}
    assert keys == {"Netherlands:7", "Netherlands:9", "Netherlands:15"}


def test_resolve_policies_resolves_depends_on_to_jurisdiction_keys():
    pol = {p.requirement_key: p for p in resolve_policies("Netherlands")}["Netherlands:15"]
    assert pol.depends_on == ("Netherlands:9",)


# ── Slice 6: recommendations (severity + suggested sources) ───────────────────

def test_suggested_sources_for_financial_docs():
    sources = suggested_sources(["invoice", "ledger"])
    assert "SAP" in sources and "NetSuite" in sources
    assert sources == list(dict.fromkeys(sources))  # de-duped


def test_suggested_sources_none_for_legal_docs():
    assert suggested_sources(["executed_agreement"]) == []


def test_resolve_policies_carries_severity():
    pol = {p.requirement_key: p for p in resolve_policies("Netherlands")}
    assert pol["Netherlands:7"].severity == "critical"
    assert pol["Netherlands:15"].severity == "high"


def test_resolve_policies_carries_evaluation_policy_and_soft_scope():
    pol = {p.requirement_key: p for p in resolve_policies("Netherlands")}["Netherlands:7"]
    assert pol.sufficiency is not None
    assert pol.requires_executed is True
    assert pol.requires_fiscal_year is True


def test_evaluate_engagement_matches_each_policied_requirement():
    # Real Netherlands:7 policy is Agreement AND (Invoice OR Ledger) — supply both for present.
    provider = FakeClassifiedDocumentsProvider({"Netherlands": [_doc(), _doc(document_type="invoice")]})
    evals = {e.requirement_key: e for e in evaluate_engagement("eng1", "Netherlands", provider, scope=SCOPE)}
    assert evals["Netherlands:7"].result.status == "present"
    assert evals["Netherlands:7"].element_name == "Material intercompany agreements"


def test_evaluate_engagement_missing_when_provider_has_no_evidence():
    provider = FakeClassifiedDocumentsProvider({})  # nothing classified for this engagement yet
    evals = {e.requirement_key: e for e in evaluate_engagement("eng1", "Netherlands", provider, scope=SCOPE)}
    assert evals["Netherlands:7"].result.status == "missing"
