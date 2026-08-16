"""FAR builder + deterministic characterization (Class 2 §28-31).

Pure engine: aggregate canonical FUNCTIONAL facts into a per-transaction FAR profile (functions/assets/risks/
capabilities), each element traceable to its canonical facts (§29). Characterization is DETERMINISTIC (§30) — a
documented rule cascade returning a controlled value or `undetermined` when evidence is insufficient. No LLM,
no fabricated conclusions (§46); unknown stays unknown. Evidence types are recorded so §31 weighting can apply.

v1 aggregates by (engagement, optional transaction). Entity-level filtering is a follow-on (CanonicalFact has
no entity column; the entity is encoded in the canonical_key via resolution).
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .functional import FUNCTIONAL_FACT_TYPES
from .models import CanonicalFact, RiskControlProfile

_BUCKET = {
    "function_performed": "functions",
    "asset_used": "assets",
    "risk_assumed": "risks_assumed",
    "risk_controlled": "risks_controlled",
    "capability": "capabilities",
}


async def build_far_profile(session: AsyncSession, engagement_id: uuid.UUID, *,
                            transaction_id: str | None = None) -> dict:
    """Aggregate the entity's affirmed functional facts into a traceable FAR profile."""
    stmt = select(CanonicalFact).where(
        CanonicalFact.engagement_id == engagement_id,
        CanonicalFact.active.is_(True),
        CanonicalFact.fact_type.in_(FUNCTIONAL_FACT_TYPES),
        CanonicalFact.value_normalized == "true",   # only affirmed facts ("entity performs/bears/controls X")
    )
    if transaction_id is not None:
        stmt = stmt.where(CanonicalFact.transaction_id == transaction_id)
    rows = (await session.execute(stmt)).scalars().all()

    buckets: dict[str, dict[str, dict]] = {b: {} for b in ("functions", "assets", "risks_assumed", "risks_controlled", "capabilities")}
    evidence_types: set[str] = set()
    for r in rows:
        if not r.far_type:
            continue
        entry = buckets[_BUCKET[r.fact_type]].setdefault(r.far_type, {"far_type": r.far_type, "evidence_types": set(), "support": []})
        entry["support"].append(str(r.id))
        if r.evidence_type:
            entry["evidence_types"].add(r.evidence_type)
            evidence_types.add(r.evidence_type)

    profile = {
        bucket: [
            {"far_type": e["far_type"], "evidence_types": sorted(e["evidence_types"]), "support": e["support"]}
            for e in items.values()
        ]
        for bucket, items in buckets.items()
    }
    profile["evidence_types"] = sorted(evidence_types)
    return profile


async def functional_section_content(session: AsyncSession, engagement_id: uuid.UUID, *,
                                     transaction_id: str | None = None) -> str:
    """Deterministic markdown for the Draft 'Functional Analysis' section (§38-40) — built from the FAR profile +
    risk-control rows; traceable, no LLM. Honest 'not yet established' when there's no functional evidence."""
    profile = await build_far_profile(session, engagement_id, transaction_id=transaction_id)
    functions = [f["far_type"] for f in profile["functions"]]
    assets = [a["far_type"] for a in profile["assets"]]
    risks_assumed = [r["far_type"] for r in profile["risks_assumed"]]
    rc = (
        await session.execute(select(RiskControlProfile).where(RiskControlProfile.engagement_id == engagement_id))
    ).scalars().all()

    if not (functions or assets or risks_assumed or profile["risks_controlled"] or rc):
        return ("Functional analysis is not yet established from operational evidence (no functional interviews, "
                "questionnaires, or agreements captured). This section populates once functional evidence is recorded.")

    def fmt(xs: list[str]) -> str:
        return ", ".join(x.replace("_", " ") for x in xs) or "none evidenced"

    lines = [
        f"**Entity characterization:** {derive_characterization(profile).replace('_', ' ')}.",
        "",
        f"**Functions performed:** {fmt(functions)}.",
        f"**Assets employed:** {fmt(assets)}.",
        f"**Risks assumed:** {fmt(risks_assumed)}.",
    ]
    if rc:
        lines += ["", "**Risk control & decision-making:**", "",
                  "| Risk | Contractual bearer | Control | Capability | Status |",
                  "| --- | --- | --- | --- | --- |"]
        for r in rc:
            lines.append(f"| {r.risk_type.replace('_', ' ')} | {r.contractual_bearer_entity_id or '?'} | "
                         f"{r.control_entity_id or '?'} | {r.capability_entity_id or '?'} | {r.status.replace('_', ' ')} |")
    lines += ["", "Each element above is traceable to the underlying functional evidence."]
    return "\n".join(lines)


def derive_characterization(profile: dict) -> str:
    """Deterministic §30 characterization from a FAR profile, or `undetermined` when insufficient (§30/§46)."""
    functions = {f["far_type"] for f in profile.get("functions", [])}
    assets = {a["far_type"] for a in profile.get("assets", [])}
    risks = {r["far_type"] for r in profile.get("risks_assumed", [])}

    if not (functions or assets or risks or profile.get("risks_controlled")):
        return "undetermined"
    if {"research", "development", "enhancement"} & functions or {"patents", "trademarks"} & assets:
        return "ip_owner"
    if {"funding", "cash_management", "fx_management", "credit_assessment", "debt_management", "guarantee_management"} & functions:
        return "financing_entity"
    if "manufacturing" in functions:
        return "full_fledged_manufacturer" if ({"capacity_risk", "market_risk", "inventory_risk"} & risks) else "contract_manufacturer"
    if "distribution" in functions:
        return "full_fledged_distributor" if ({"market_risk", "inventory_risk"} & risks) else "limited_risk_distributor"
    if (functions & {"customer_support", "service_delivery", "finance", "accounting", "hr", "legal", "it", "administration", "management"}
            and not (functions & {"manufacturing", "distribution", "research", "development", "sales"})):
        return "routine_service_provider"
    return "undetermined"
