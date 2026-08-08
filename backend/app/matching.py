"""Deterministic requirement-matching engine.

Given a requirement's evidence policy (what documents count, in what role) and evaluation policy (how they
combine), decide whether the requirement is substantiated by the classified documents on hand. Pure — no DB,
no model, no LLM — so every status transition is unit-testable in isolation (tests/test_matching.py),
mirroring coverage_readiness.py.

Two policy layers, kept separate:
- evidence policy  : {document_type: role}          role ∈ primary | supporting | background | rejected
- evaluation policy: a nested AND/OR `sufficiency` tree over document types (leaves = {"doc": type})

Statuses: present / partial / missing / invalid. `invalid` = the right kind of evidence exists but is
disqualified by a soft scope check (wrong fiscal year, unexecuted). Hard scope keys (jurisdiction, entity)
that mismatch exclude the evidence entirely. The satisfaction check is deliberately isolated so the V2
capability strategy can replace it without touching scope/role logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .requirements import resolve_requirements

# Roles a document type can play (evidence policy).
PRIMARY = "primary"
REJECTED = "rejected"

# Statuses.
PRESENT = "present"
PARTIAL = "partial"
MISSING = "missing"
INVALID = "invalid"
BLOCKED = "blocked"
CONDITIONAL = "conditional"

# Statuses that block a dependent requirement. present/conditional do not (conditional = not applicable).
_BLOCKING = frozenset({MISSING, PARTIAL, INVALID, BLOCKED})

# Hard scope keys: a definite mismatch on any of these disqualifies evidence outright.
_HARD_SCOPE_KEYS = ("jurisdiction", "entity")

# Where a practitioner can pull a missing document type from (connector display names). Financial records
# come from accounting systems; legal/analytical documents have no connector suggestion.
_ACCOUNTING = ["SAP", "Oracle", "NetSuite", "QuickBooks", "Xero"]
SUGGESTED_SOURCES = {
    "invoice": _ACCOUNTING,
    "ledger": _ACCOUNTING,
    "general_ledger": _ACCOUNTING,
    "trial_balance": _ACCOUNTING,
}


def suggested_sources(doc_types: list[str]) -> list[str]:
    """Connectors that could supply any of these missing document types (ordered, de-duped)."""
    out: list[str] = []
    for dt in doc_types:
        for s in SUGGESTED_SOURCES.get(dt, []):
            if s not in out:
                out.append(s)
    return out


@dataclass(frozen=True)
class ClassifiedDoc:
    """A document as understood by classification: its canonical type and scope. The matcher consumes this;
    it never classifies or resolves entities itself."""

    document_id: object | None
    document_type: str
    jurisdiction: str | None = None
    entity: str | None = None
    fiscal_year: str | None = None
    executed: bool | None = None


@dataclass(frozen=True)
class RequirementPolicy:
    requirement_key: str
    element_name: str
    roles: dict[str, str]  # evidence policy: document_type -> role
    # evaluation policy: nested {"all": [...]}, {"any": [...]}, or leaf {"doc": type}. None => any primary satisfies.
    sufficiency: dict | None = None
    # soft-scope requirements this requirement imposes on its satisfying evidence.
    requires_executed: bool = False
    requires_fiscal_year: bool = False
    # other requirement_keys that must be present; otherwise this requirement is blocked.
    depends_on: tuple[str, ...] = ()
    required: bool = True  # False = conditional (not assessed unless a trigger applies)
    severity: str = "medium"  # how badly a gap here hurts: critical | high | medium | low


@dataclass(frozen=True)
class MatchedEvidence:
    doc: ClassifiedDoc
    role: str


@dataclass(frozen=True)
class MatchResult:
    status: str
    matched: list[MatchedEvidence]     # satisfying evidence, with its role
    missing: list[list[str]]           # groups of acceptable document types still needed (each group = OR)
    explanation: str
    invalid_reason: str | None = None  # set when status == invalid


# ── Scope ─────────────────────────────────────────────────────────────────────
def _hard_in_scope(doc: ClassifiedDoc, scope: dict) -> bool:
    # ponytail: exclude only on a *definite* hard-key mismatch; unknown (None) on the doc is treated as
    # in-scope. Tighten to "unknown = excluded" once classification guarantees these fields.
    for key in _HARD_SCOPE_KEYS:
        want, got = scope.get(key), getattr(doc, key)
        if want is not None and got is not None and got != want:
            return False
    return True


def _soft_reason(doc: ClassifiedDoc, scope: dict, policy: RequirementPolicy) -> str | None:
    """Why this in-scope document is disqualified (→ contributes to `invalid`), or None if it qualifies."""
    if policy.requires_fiscal_year:
        want, got = scope.get("fiscal_year"), doc.fiscal_year
        if want is not None and got is not None and got != want:
            return f"{doc.document_type} is for {got}, not {want}"
    if policy.requires_executed and doc.executed is False:
        return f"{doc.document_type} is not executed"
    return None


# ── Evaluation policy (AND/OR tree over document types) ────────────────────────
def _leaf_types(node: dict) -> list[str]:
    if "all" in node:
        return [t for c in node["all"] for t in _leaf_types(c)]
    if "any" in node:
        return [t for c in node["any"] for t in _leaf_types(c)]
    return [node["doc"]]


def _has(doc_type: str, docs: list[ClassifiedDoc], roles: dict) -> bool:
    return any(d.document_type == doc_type and roles.get(doc_type) != REJECTED for d in docs)


def _satisfied(node: dict, docs: list[ClassifiedDoc], roles: dict) -> bool:
    if "all" in node:
        return all(_satisfied(c, docs, roles) for c in node["all"])
    if "any" in node:
        return any(_satisfied(c, docs, roles) for c in node["any"])
    return _has(node["doc"], docs, roles)


def _missing_groups(node: dict, docs: list[ClassifiedDoc], roles: dict) -> list[list[str]]:
    """Unmet parts of the tree, each as a group of acceptable document types (satisfy any one)."""
    if _satisfied(node, docs, roles):
        return []
    if "all" in node:
        return [g for c in node["all"] for g in _missing_groups(c, docs, roles)]
    if "any" in node:
        # ponytail: assumes `any` children are leaves; nest deeper only when a policy needs it.
        return [[c["doc"] for c in node["any"] if "doc" in c]]
    return [[node["doc"]]]


def _matched(policy: RequirementPolicy, docs: list[ClassifiedDoc]) -> list[MatchedEvidence]:
    """In-scope documents that count toward the verdict: those referenced by the policy, non-rejected."""
    if policy.sufficiency is None:
        return [MatchedEvidence(d, PRIMARY) for d in docs if policy.roles.get(d.document_type) == PRIMARY]
    types = set(_leaf_types(policy.sufficiency))
    return [
        MatchedEvidence(d, policy.roles.get(d.document_type, "supporting"))
        for d in docs
        if d.document_type in types and policy.roles.get(d.document_type) != REJECTED
    ]


def _status_over(policy: RequirementPolicy, docs: list[ClassifiedDoc]) -> str:
    if policy.sufficiency is None:
        return PRESENT if any(policy.roles.get(d.document_type) == PRIMARY for d in docs) else MISSING
    if _satisfied(policy.sufficiency, docs, policy.roles):
        return PRESENT
    any_leaf = any(_has(t, docs, policy.roles) for t in _leaf_types(policy.sufficiency))
    return PARTIAL if any_leaf else MISSING


_RANK = {MISSING: 0, PARTIAL: 1, PRESENT: 2}


def evaluate_requirement(policy: RequirementPolicy, docs: list[ClassifiedDoc], *, scope: dict) -> MatchResult:
    hard = [d for d in docs if _hard_in_scope(d, scope)]
    disqualified = {id(d): _soft_reason(d, scope, policy) for d in hard}
    qualified = [d for d in hard if disqualified[id(d)] is None]

    status = _status_over(policy, qualified)

    # Invalid: qualified evidence is worse than what we'd have with the disqualified docs — i.e. the right
    # document exists but is disqualified by soft scope. Surface that instead of a bare partial/missing.
    if status != PRESENT:
        status_all = _status_over(policy, hard)
        blocking = [disqualified[id(d)] for d in hard if disqualified[id(d)] is not None]
        if blocking and _RANK[status_all] > _RANK[status]:
            reason = "; ".join(sorted(set(blocking)))
            return MatchResult(
                INVALID,
                _matched(policy, qualified),
                _missing_groups(policy.sufficiency, qualified, policy.roles) if policy.sufficiency else [],
                f"Evidence present but disqualified: {reason}.",
                invalid_reason=reason,
            )

    matched = _matched(policy, qualified)
    missing = _missing_groups(policy.sufficiency, qualified, policy.roles) if policy.sufficiency else []
    if status == PRESENT:
        names = ", ".join(sorted({m.doc.document_type for m in matched})) or "policy evidence"
        return MatchResult(PRESENT, matched, [], f"Satisfied by: {names}.")
    need = "; ".join(" or ".join(g) for g in missing) or policy.element_name
    if status == PARTIAL:
        return MatchResult(PARTIAL, matched, missing, f"Partly satisfied. Still need: {need}.")
    return MatchResult(MISSING, [], missing, f"No qualifying evidence. Need: {need}.")


# ── Policy resolution (JSON seed + base-template inheritance) ──────────────────
def resolve_policies(country: str) -> list[RequirementPolicy]:
    """The matchable requirements for a jurisdiction: those carrying an evidence policy. Inheritance
    (shared base template + per-country overrides) is handled by resolve_requirements. depends_on is
    authored as element orders and resolved to jurisdiction-scoped requirement keys here."""
    out: list[RequirementPolicy] = []
    for e in resolve_requirements(country):
        if not e.evidence_policy:
            continue
        out.append(
            RequirementPolicy(
                requirement_key=e.requirement_key,
                element_name=e.element_name,
                roles=dict(e.evidence_policy),
                sufficiency=e.sufficiency,
                requires_executed=bool(e.requires_executed),
                requires_fiscal_year=bool(e.requires_fiscal_year),
                depends_on=tuple(f"{country}:{o}" for o in (e.depends_on or ())),
                required=e.required,
                severity=e.severity,
            )
        )
    return out


# ── Dependencies (blocked overlay) ────────────────────────────────────────────
def resolve_blocked(status_by_key: dict[str, str], deps_by_key: dict[str, list[str]]) -> set[str]:
    """Keys whose dependencies aren't all satisfied. A dependency blocks if its status is blocking
    (missing/partial/invalid/blocked) or itself becomes blocked — computed to a fixpoint (transitive)."""
    blocked: set[str] = set()
    changed = True
    while changed:
        changed = False
        for key, deps in deps_by_key.items():
            if key in blocked:
                continue
            for dep in deps:
                dep_status = BLOCKED if dep in blocked else status_by_key.get(dep, MISSING)
                if dep_status in _BLOCKING:
                    blocked.add(key)
                    changed = True
                    break
    return blocked


def evaluate_over(
    policies: list[RequirementPolicy], docs: list[ClassifiedDoc], *, scope: dict
) -> list[RequirementEvaluation]:
    """Evaluate a set of requirement policies over the classified docs: per-requirement status
    (conditional if not required), then a transitive `blocked` overlay from depends_on."""
    evals: dict[str, RequirementEvaluation] = {}
    for p in policies:
        if not p.required:
            result = MatchResult(CONDITIONAL, [], [], f"{p.element_name} is conditional — not required unless triggered.")
        else:
            result = evaluate_requirement(p, docs, scope=scope)
        evals[p.requirement_key] = RequirementEvaluation(p.requirement_key, p.element_name, result)

    deps_by_key = {p.requirement_key: list(p.depends_on) for p in policies if p.depends_on}
    name_by_key = {p.requirement_key: p.element_name for p in policies}
    status_by_key = {k: e.result.status for k, e in evals.items()}
    blocked = resolve_blocked(status_by_key, deps_by_key)
    for key in blocked:
        e = evals[key]
        unmet = [
            name_by_key.get(d, d)
            for d in deps_by_key.get(key, [])
            if d in blocked or status_by_key.get(d, MISSING) in _BLOCKING
        ]
        evals[key] = RequirementEvaluation(
            key, e.element_name,
            MatchResult(BLOCKED, e.result.matched, e.result.missing, f"Blocked by: {', '.join(unmet)}."),
        )
    return [evals[p.requirement_key] for p in policies]


# ── Providers + engagement-level evaluation ───────────────────────────────────
class ClassifiedDocumentsProvider(Protocol):
    """Supplies classified documents (type + scope) for an engagement/jurisdiction. Classification is the
    matcher's one hard dependency; the real implementation reads storage, the fake drives tests."""

    def documents_for(self, engagement_id, jurisdiction: str) -> list[ClassifiedDoc]: ...


class FakeClassifiedDocumentsProvider:
    """Test double: classified documents keyed by jurisdiction (mirrors FakeAssessor's role)."""

    def __init__(self, by_jurisdiction: dict[str, list[ClassifiedDoc]]):
        self._by_jurisdiction = by_jurisdiction

    def documents_for(self, engagement_id, jurisdiction: str) -> list[ClassifiedDoc]:
        return self._by_jurisdiction.get(jurisdiction, [])


class ClassificationBackedProvider:
    """Production provider. Until Document Classification persists document type + scope, it returns [] —
    graceful degradation, so every requirement evaluates to `missing` rather than erroring.
    ponytail: implement against classification's output (see document_classifier) once that lands."""

    def documents_for(self, engagement_id, jurisdiction: str) -> list[ClassifiedDoc]:
        return []


@dataclass(frozen=True)
class RequirementEvaluation:
    requirement_key: str
    element_name: str
    result: MatchResult


def evaluate_engagement(
    engagement_id, jurisdiction: str, provider: ClassifiedDocumentsProvider, *, scope: dict
) -> list[RequirementEvaluation]:
    """Evaluate every policied requirement for one jurisdiction against the engagement's classified docs,
    including the transitive blocked overlay from dependencies."""
    docs = provider.documents_for(engagement_id, jurisdiction)
    return evaluate_over(resolve_policies(jurisdiction), docs, scope=scope)
