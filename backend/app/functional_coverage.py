"""Functional-analysis sufficiency for Requirements (Class 2 §33-34, §51, §54).

Deterministic coverage (NOT an LLM score, §54): from the S9 FAR profile + S10 risk-control rows, decide whether
the functional analysis is `present` / `partial` / `unknown`, and name the specific gaps (§34) — e.g. functions
are evidenced but risk control for FX risk is unresolved. Document existence alone never makes this `present`.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .far_builder import build_far_profile
from .models import RiskControlProfile


async def functional_analysis_summary(session: AsyncSession, engagement_id: uuid.UUID, *,
                                      transaction_id: str | None = None) -> dict:
    profile = await build_far_profile(session, engagement_id, transaction_id=transaction_id)
    functions = [f["far_type"] for f in profile["functions"]]
    assets = [a["far_type"] for a in profile["assets"]]
    risks_assumed = [r["far_type"] for r in profile["risks_assumed"]]

    stmt = select(RiskControlProfile).where(RiskControlProfile.engagement_id == engagement_id)
    if transaction_id is not None:
        stmt = stmt.where(RiskControlProfile.transaction_id == transaction_id)
    rc_rows = (await session.execute(stmt)).scalars().all()
    rc_by_risk = {r.risk_type: r for r in rc_rows}
    resolved = {rt for rt, r in rc_by_risk.items() if r.status in ("aligned", "potential_mismatch")}

    # A risk is "unresolved" if it is assumed but has no resolved control, or its control row is undetermined.
    unresolved = sorted(set(risks_assumed) - resolved)
    unresolved += sorted(rt for rt, r in rc_by_risk.items()
                         if r.status == "undetermined" and rt not in unresolved and rt not in risks_assumed)

    has_evidence = bool(functions or assets or risks_assumed or rc_rows)
    gaps: list[str] = []
    if not has_evidence:
        status = "unknown"
        gaps.append("No functional evidence captured yet (no interviews or questionnaires).")
    elif unresolved:
        status = "partial"
        gaps.extend(f"Risk control for {rt.replace('_', ' ')} remains unclear." for rt in unresolved)
    else:
        status = "present"

    return {
        "status": status,
        "functions_count": len(functions),
        "assets_count": len(assets),
        "risks_count": len(risks_assumed),
        "risk_control": {"resolved": len(resolved), "total": len(set(risks_assumed) | set(rc_by_risk)),
                         "unresolved": unresolved},
        "gaps": gaps,
    }
