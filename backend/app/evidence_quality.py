from __future__ import annotations

import re
from collections.abc import Iterable


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def _has_any(value: str, terms: Iterable[str]) -> bool:
    haystack = _norm(value)
    return any(term in haystack for term in terms)


def evidence_expectations(element_name: str) -> str:
    name = _norm(element_name)
    if _has_any(name, ["amount", "transaction value", "payment", "receipt"]):
        return (
            "Requires transaction-level amounts from a ledger, intercompany transaction schedule, "
            "or payment/receipt listing, broken down by counterparty and tax jurisdiction."
        )
    if _has_any(name, ["agreement", "contract"]):
        return "Requires executed intercompany agreements or a sourced agreement inventory for the local entity."
    if _has_any(name, ["method", "tested party", "arm s length", "comparab", "benchmark", "economic"]):
        return (
            "Requires transfer-pricing policy or economic analysis evidence: controlled transactions, "
            "FAR profile, selected method, tested party, comparable set/search method, financial "
            "indicator, arm's-length range, and tested-party results."
        )
    if _has_any(name, ["financial", "accounts", "tie out", "allocation", "segmented", "reconciliation"]):
        return (
            "Requires local-entity financial statements, tested-party segmented P&L or balance-sheet "
            "data, and reconciliation/tie-out schedules to the accounting records."
        )
    if _has_any(name, ["associated enterprises", "relationships", "controlled transactions"]):
        return (
            "Requires a local-entity controlled-transaction inventory with legal counterparties, "
            "tax residences, relationship mapping, and commercial context."
        )
    return "Requires evidence tied to the specific taxpayer, jurisdiction, fiscal year, and local-file element."


def scoped_query(element, *, entity_name: str | None, jurisdiction: str) -> str:
    subs = " ".join(getattr(element, "sub_requirements", []) or [])
    entity = entity_name or "specific local legal entity"
    return " ".join(
        part
        for part in [
            f"Taxpayer legal entity: {entity}.",
            f"Jurisdiction: {jurisdiction}.",
            "Fiscal year: current local-file fiscal year; do not use unrelated years.",
            f"Required element: {element.element_name}.",
            f"Description: {element.description}",
            f"Sub-requirements: {subs}" if subs else "",
            f"Evidence expectations: {evidence_expectations(element.element_name)}",
        ]
        if part
    )


def assessment_scope_instruction(element, *, entity_name: str | None, jurisdiction: str) -> str:
    entity = entity_name or "the specific local legal entity"
    return (
        f"Scope to taxpayer '{entity}' in {jurisdiction}. Mark 'present' only when the sources "
        "contain concrete evidence for this taxpayer/local entity and this Local File scope. "
        "Group-level annual-report material is background only; by itself it is not enough for "
        "entity-level controlled transactions, FAR, method selection, tested party, financials, "
        "comparables, agreements, or arm's-length conclusions. "
        f"{evidence_expectations(element.element_name)}"
    )


def critical_quality_label(element_name: str) -> str | None:
    name = _norm(element_name)
    if _has_any(name, ["method", "tested party"]):
        return "method/tested-party analysis"
    if _has_any(name, ["comparab", "benchmark", "economic"]):
        return "benchmarking/comparables"
    if _has_any(name, ["arm s length", "application of selected method"]):
        return "arm's-length conclusion"
    if _has_any(name, ["amount", "controlled transactions", "transaction value", "payment", "receipt"]):
        return "controlled-transaction amounts"
    if _has_any(name, ["financial", "accounts", "tie out", "allocation", "segmented", "reconciliation"]):
        return "local financial support"
    if _has_any(name, ["agreement", "contract"]):
        return "intercompany agreements"
    return None


def is_conclusion_element(element_name: str) -> bool:
    name = _norm(element_name)
    return _has_any(name, ["arm s length", "application of selected method"])
