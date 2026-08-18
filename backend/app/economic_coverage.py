"""Economic-analysis sufficiency for Requirements (Class 3 §50-51).

Deterministic (NOT an LLM score): from the Class 3 structured objects (TNMM analysis, segment, benchmark set +
result, reconciliation), decide whether the economic analysis is `present` / `partial` / `unknown` and name the
specific gaps (§51). Evaluates CONCEPTS — a benchmark PDF's mere existence never makes this `present`. Mirrors the
Class 2 `functional_analysis_summary` shape so it rides the coverage response the same way.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .far_builder import build_far_profile, derive_characterization
from .models import (
    BenchmarkResult,
    BenchmarkSet,
    FinancialReconciliation,
    FinancialSegment,
    TNMMAnalysis,
    TNMMCalculation,
    TPAdjustment,
)

_STALE = {"review_required", "incompatible"}
_CONCLUSIVE = {"within_range", "below_range", "above_range"}


async def economic_analysis_summary(session: AsyncSession, engagement_id: uuid.UUID) -> dict:
    analyses = (await session.execute(
        select(TNMMAnalysis).where(TNMMAnalysis.engagement_id == engagement_id)
    )).scalars().all()

    if not analyses:
        return {
            "status": "unknown",
            "capabilities": {
                "tested_party_identified": False, "financial_segment_available": False, "pli_defined": False,
                "benchmark_available": False, "range_calculated": False, "benchmark_current": False,
                "financial_result_reconciled": False, "arm_length_conclusion_available": False,
            },
            "gaps": ["No economic (TNMM) analysis has been started yet."],
        }

    latest_result = (await session.execute(
        select(BenchmarkResult)
        .join(BenchmarkSet, BenchmarkResult.benchmark_set_id == BenchmarkSet.id)
        .join(TNMMAnalysis, BenchmarkSet.analysis_id == TNMMAnalysis.id)
        .where(TNMMAnalysis.engagement_id == engagement_id)
        .order_by(BenchmarkResult.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    benchmark_set_exists = (await session.execute(
        select(BenchmarkSet.id).join(TNMMAnalysis, BenchmarkSet.analysis_id == TNMMAnalysis.id)
        .where(TNMMAnalysis.engagement_id == engagement_id).limit(1)
    )).first() is not None

    segment_exists = (await session.execute(
        select(FinancialSegment.id).where(FinancialSegment.engagement_id == engagement_id).limit(1)
    )).first() is not None

    reconciled = (await session.execute(
        select(FinancialReconciliation.id).where(
            FinancialReconciliation.engagement_id == engagement_id,
            FinancialReconciliation.status.like("reconciled%"),
        ).limit(1)
    )).first() is not None

    caps = {
        "tested_party_identified": any(a.tested_party_entity_id for a in analyses),
        "financial_segment_available": segment_exists or any(a.segment_id for a in analyses),
        "pli_defined": any(a.pli_type for a in analyses),
        "benchmark_available": benchmark_set_exists,
        "range_calculated": latest_result is not None,
        "benchmark_current": latest_result is not None and (latest_result.freshness_status or "") not in _STALE,
        "financial_result_reconciled": reconciled,
        "arm_length_conclusion_available": latest_result is not None and latest_result.position in _CONCLUSIVE,
    }

    gap_msg = {
        "tested_party_identified": "No tested party identified.",
        "financial_segment_available": "No financial segment prepared for the tested party.",
        "pli_defined": "No PLI selected.",
        "benchmark_available": "No comparable set imported.",
        "range_calculated": "Arm's-length range not yet computed.",
        "benchmark_current": "Benchmark refresh required (comparable data is stale for the tested period).",
        "financial_result_reconciled": "Segmented P&L does not fully reconcile to the source financials.",
        "arm_length_conclusion_available": "No arm's-length conclusion (tested result vs range) yet.",
    }
    gaps = [gap_msg[k] for k, ok in caps.items() if not ok]
    status = "present" if all(caps.values()) else "partial"
    return {"status": status, "capabilities": caps, "gaps": gaps}


def _pct(v) -> str:
    return "n/a" if v is None else f"{float(v) * 100:.2f}%"


def _num(v) -> str:
    return "n/a" if v is None else f"{float(v):,.0f}"


async def economic_section_content(session: AsyncSession, engagement_id: uuid.UUID) -> str:
    """Deterministic markdown for the Draft 'Economic Analysis' section (§52-54) — built ONLY from the stored TNMM/
    benchmark/adjustment rows; numbers are never generated. Honest 'not yet established' note when absent."""
    analyses = (await session.execute(
        select(TNMMAnalysis).where(TNMMAnalysis.engagement_id == engagement_id).order_by(TNMMAnalysis.created_at)
    )).scalars().all()
    analysis = next((a for a in reversed(analyses) if a.tested_party_entity_id), analyses[-1] if analyses else None)
    if analysis is None:
        return ("Economic analysis is not yet established from structured financial evidence (no TNMM analysis "
                "prepared). This section populates once the tested party, PLI, and benchmark are in place.")

    calc = (await session.execute(
        select(TNMMCalculation).where(TNMMCalculation.analysis_id == analysis.id)
        .order_by(TNMMCalculation.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    result = (await session.execute(
        select(BenchmarkResult).join(BenchmarkSet, BenchmarkResult.benchmark_set_id == BenchmarkSet.id)
        .where(BenchmarkSet.analysis_id == analysis.id)
        .order_by(BenchmarkResult.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    adj = (await session.execute(
        select(TPAdjustment).where(TPAdjustment.analysis_id == analysis.id)
        .order_by(TPAdjustment.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    far = derive_characterization(await build_far_profile(session, engagement_id))

    lines = [
        "**Transfer pricing method:** Transactional Net Margin Method (TNMM).",
        f"**Tested party:** {analysis.tested_party_entity_id or 'not specified'}"
        + (f" — {analysis.tested_party_rationale}" if analysis.tested_party_rationale else "")
        + (f" (FAR characterization: {far.replace('_', ' ')})" if far and far != 'undetermined' else "") + ".",
        f"**Profit level indicator:** {analysis.pli_type.replace('_', ' ')}.",
    ]
    if calc is not None:
        lines += ["", "**Financial analysis (tested party segment):**",
                  f"- Revenue: {_num(calc.revenue)}",
                  f"- Total costs: {_num(calc.total_costs)}",
                  f"- Operating profit: {_num(calc.operating_profit)}",
                  f"- {analysis.pli_type.replace('_', ' ')}: {_pct(calc.pli_value)}"]
    if result is not None:
        lines += ["", "**Benchmarking analysis:**",
                  f"- Arm's-length range ({result.statistical_method}, n={result.n}): "
                  f"lower quartile {_pct(result.lower_quartile)}, median {_pct(result.median)}, "
                  f"upper quartile {_pct(result.upper_quartile)}.",
                  "", "**Arm's-length conclusion:**",
                  f"The tested result of {_pct(result.tested_result)} is **{result.position.replace('_', ' ')}** "
                  "the arm's-length range."]
        if adj is not None and adj.adjustment_amount is not None and adj.status != "none_required":
            lines.append(f"An illustrative adjustment to the {adj.target_basis.replace('_', ' ')} "
                         f"({_num(adj.adjustment_amount)}) is available for practitioner review (status: "
                         f"{adj.status.replace('_', ' ')}); it is not posted automatically.")
    else:
        lines += ["", "The arm's-length range has not yet been computed for this analysis."]
    lines += ["", "Every figure above is drawn from the structured TNMM/benchmark result — none are generated."]
    return "\n".join(lines)
