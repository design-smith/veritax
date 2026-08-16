"""Deterministic functional Risk findings (PRD Class 2, S13, §41).

Rules decide — no LLM. Each finding NAMES its functional basis (a risk-control row, a functional fact, or the
functional-analysis summary). Inputs that don't exist yet simply produce no finding, never a fabricated one
(§46). Findings reuse the `risks.Finding` shape so they persist through the existing risk pipeline unchanged.

The four finding kinds (§41):
  1. contract-vs-conduct mismatch — a risk-control row whose contractual bearer diverges from who controls it /
     has the capability (post-BEPS conduct-over-contract).
  2. capability gap — the bearer is set but no entity is evidenced as capable of managing the risk (a blind spot
     the mismatch status misses when control coincidentally sits with the bearer).
  3. unsupported risk allocation — a `risk_assumed` functional fact with no risk-control row and no control
     evidence: the allocation is asserted but not yet supported by conduct.
  4. missing-interview evidence — the functional analysis itself is incomplete (summary status unknown/partial).
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .far_builder import build_far_profile
from .functional_coverage import functional_analysis_summary
from .models import RiskControlProfile
from .risks import Evidence, Finding


def _pretty(x: str | None) -> str:
    return (x or "").replace("_", " ")


async def functional_findings(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> list[Finding]:
    """Deterministic functional-conduct findings for an engagement. Only emits where the evidence supports it.

    `jurisdiction` is accepted for parity with the regulatory findings; functional evidence is engagement-scoped.
    """
    out: list[Finding] = []

    rc_rows = (await session.execute(
        select(RiskControlProfile).where(RiskControlProfile.engagement_id == engagement_id)
    )).scalars().all()

    for r in rc_rows:
        basis = f"risk_control_profiles[{r.risk_type}" + (f", txn {r.transaction_id}]" if r.transaction_id else "]")
        detail = (f"status={r.status}, bearer={r.contractual_bearer_entity_id}, "
                  f"control={r.control_entity_id}, capability={r.capability_entity_id}.")

        # 1. Contract-vs-conduct mismatch (the Jayesh point): a contract can't put risk where there's no control.
        if r.status == "potential_mismatch":
            diverge = []
            if r.control_entity_id and r.control_entity_id != r.contractual_bearer_entity_id:
                diverge.append(f"control sits with {r.control_entity_id}")
            if r.capability_entity_id and r.capability_entity_id != r.contractual_bearer_entity_id:
                diverge.append(f"capability sits with {r.capability_entity_id}")
            out.append(Finding(
                kind="discrepancy",
                title=f"Contract-vs-conduct mismatch: {_pretty(r.risk_type)}",
                description=(f"{_pretty(r.risk_type)} is contractually borne by {r.contractual_bearer_entity_id}, "
                            f"but {', and '.join(diverge)} — a contract cannot allocate risk to an entity that does "
                            "not control it or is not capable of managing it (conduct over contract, post-BEPS)."),
                severity="high", exposure_label="Conduct diverges from contract", exposure_estimated=True,
                confidence="high",
                evidence=[Evidence("figure", basis, detail)],
                recommendations=["Reconcile the contractual risk allocation with the conduct, or re-price the arrangement."]))

        # 2. Capability gap: bearer set but capability entity is unevidenced (even an 'aligned' row can hide this).
        if r.contractual_bearer_entity_id and r.capability_entity_id is None:
            out.append(Finding(
                kind="exposure",
                title=f"Capability not evidenced for {_pretty(r.risk_type)}",
                description=(f"{r.contractual_bearer_entity_id} contractually bears {_pretty(r.risk_type)}, but no "
                            "entity is evidenced as having the capability to manage it; the allocation is unsupported."),
                severity="medium", exposure_label="Capability gap", exposure_estimated=True, confidence="high",
                evidence=[Evidence("figure", basis, detail)],
                recommendations=["Evidence the capability to manage this risk, or revisit the allocation."]))

    # 3. Unsupported risk allocation: a risk_assumed fact with no risk-control row and no risk_controlled evidence.
    profile = await build_far_profile(session, engagement_id)
    risks_assumed = {r["far_type"] for r in profile["risks_assumed"]}
    risks_controlled = {r["far_type"] for r in profile["risks_controlled"]}
    rc_risks = {r.risk_type for r in rc_rows}
    for rt in sorted(risks_assumed - rc_risks - risks_controlled):
        out.append(Finding(
            kind="exposure",
            title=f"Unsupported risk allocation: {_pretty(rt)}",
            description=(f"The entity is recorded as assuming {_pretty(rt)}, but there is no risk-control record and "
                        "no evidence it controls the risk — the allocation is not yet supported by conduct."),
            severity="medium", exposure_label="Unsupported risk allocation", exposure_estimated=True, confidence="high",
            evidence=[Evidence("figure", f"canonical_fact[risk_assumed:{rt}]", "assumed with no control evidence.")],
            recommendations=["Capture control/capability evidence for this risk, or reconsider the allocation."]))

    # 4. Missing-interview evidence: the functional analysis itself is incomplete (drives the interview recommendation).
    summary = await functional_analysis_summary(session, engagement_id)
    if summary["status"] in ("unknown", "partial"):
        gaps = summary["gaps"] or ["Functional evidence is incomplete."]
        out.append(Finding(
            kind="exposure",
            title="Functional analysis is incomplete",
            description=("The functional analysis is not fully supported by operational evidence "
                         f"(status: {summary['status']}). " + " ".join(gaps) +
                         " Conduct functional interviews to close these gaps."),
            severity="medium" if summary["status"] == "partial" else "low",
            exposure_label="Incomplete functional evidence", exposure_estimated=True, confidence="high",
            evidence=[Evidence("figure", "functional_analysis_summary",
                               f"status={summary['status']}; functions={summary['functions_count']}, "
                               f"risks={summary['risks_count']}, unresolved={len(summary['risk_control']['unresolved'])}.")],
            recommendations=["Schedule functional interviews / questionnaires to evidence the FAR and risk control."]))

    return out
