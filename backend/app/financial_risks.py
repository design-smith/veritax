"""Deterministic financial Risk findings (PRD Class 3, S16, §55).

Rules decide — no LLM. Each finding NAMES its basis; inputs that don't exist produce no finding (§46). Returns
`[]` when the engagement has no Class 3 data, so existing risk runs are unaffected. Reuses the `risks.Finding`
shape so findings persist through the existing pipeline unchanged.

Finding kinds (§55): reconciliation gap · unsupported exclusion · stale benchmark · statistical-method mismatch ·
out-of-range profitability · missing segmentation.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from regulatory import benchmarking_method

from .economic_coverage import economic_analysis_summary
from .models import (
    BenchmarkResult,
    BenchmarkSet,
    FinancialAdjustment,
    FinancialReconciliation,
    FinancialSegment,
    TNMMAnalysis,
)
from .risks import Evidence, Finding


def _fmt(v) -> str:
    return "n/a" if v is None else f"{float(v):,.0f}"


def _pct(v) -> str:
    return "n/a" if v is None else f"{float(v) * 100:.2f}%"


async def financial_findings(session: AsyncSession, engagement_id: uuid.UUID, jurisdiction: str) -> list[Finding]:
    """Deterministic economic/financial findings for an engagement. Only emits where the evidence supports it."""
    out: list[Finding] = []

    # 1. Reconciliation gaps — an unreconciled tie-out means the TP analysis doesn't tie back to source records.
    recs = (await session.execute(
        select(FinancialReconciliation).where(
            FinancialReconciliation.engagement_id == engagement_id,
            FinancialReconciliation.status == "unreconciled",
        )
    )).scalars().all()
    for r in recs:
        out.append(Finding(
            kind="discrepancy",
            title=f"Financial reconciliation gap: {r.label}",
            description=(f"{r.label} is unreconciled — a difference of {_fmt(r.difference)} between source and target "
                        "remains unexplained; the financial analysis does not tie back to the source records."),
            severity="high", exposure_label="Unreconciled difference", exposure_estimated=True, confidence="high",
            evidence=[Evidence("figure", f"financial_reconciliations[{r.label}]",
                               f"difference={_fmt(r.difference)}, status={r.status}.")],
            recommendations=["Investigate and explain the difference, or correct the segmentation/mapping."]))

    # 2. Unsupported exclusions — an amount excluded without a documented rationale.
    adjs = (await session.execute(
        select(FinancialAdjustment).join(FinancialSegment, FinancialAdjustment.segment_id == FinancialSegment.id)
        .where(FinancialSegment.engagement_id == engagement_id)
    )).scalars().all()
    for a in adjs:
        if a.adjustment_type.startswith("exclude") and not (a.reason and a.reason.strip()):
            out.append(Finding(
                kind="exposure",
                title=f"Unsupported exclusion: {a.account_ref or a.adjustment_type.replace('_', ' ')}",
                description=(f"An amount of {_fmt(a.adjustment_amount)} was excluded "
                            f"({a.adjustment_type.replace('_', ' ')}) without a supporting rationale."),
                severity="medium", exposure_label="Unsupported adjustment", exposure_estimated=True, confidence="high",
                evidence=[Evidence("figure", f"financial_adjustments[{a.id}]",
                                   f"type={a.adjustment_type}, amount={_fmt(a.adjustment_amount)}, reason=none.")],
                recommendations=["Document the rationale for the exclusion, or reinstate the amount."]))

    # 3-5. Benchmark-derived findings — the latest computed range per TNMM analysis.
    analyses = (await session.execute(
        select(TNMMAnalysis).where(TNMMAnalysis.engagement_id == engagement_id)
    )).scalars().all()
    for a in analyses:
        result = (await session.execute(
            select(BenchmarkResult).join(BenchmarkSet, BenchmarkResult.benchmark_set_id == BenchmarkSet.id)
            .where(BenchmarkSet.analysis_id == a.id).order_by(BenchmarkResult.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        if result is None:
            continue
        basis = f"benchmark_results[analysis {a.id}]"

        if (result.freshness_status or "") in ("review_required", "incompatible"):
            out.append(Finding(
                kind="exposure", title="Benchmark comparable data may be stale",
                description=("The comparable search period is not contemporaneous with the tested year "
                             f"(freshness: {result.freshness_status}); a stale benchmark weakens the analysis."),
                severity="medium", exposure_label="Stale benchmark", exposure_estimated=True, confidence="high",
                evidence=[Evidence("figure", basis, f"freshness_status={result.freshness_status}.")],
                recommendations=["Refresh the comparable search to a contemporaneous data year."]))

        if a.jurisdiction:
            bm = benchmarking_method(a.jurisdiction, None)
            expected = f"{bm['method']}:{bm['quartile_method']}"
            if result.statistical_method != expected:
                out.append(Finding(
                    kind="discrepancy", title="Benchmark method inconsistent with the jurisdiction",
                    description=(f"The range was computed with '{result.statistical_method}', but "
                                 f"{a.jurisdiction} indicates '{expected}'. Recompute with the jurisdiction's method."),
                    severity="high", exposure_label="Statistical-method mismatch", exposure_estimated=True,
                    confidence="high",
                    evidence=[Evidence("figure", basis, f"stored={result.statistical_method}, expected={expected}.")],
                    recommendations=["Recompute the arm's-length range with the jurisdiction's statistical method."]))

        if result.position in ("below_range", "above_range"):
            out.append(Finding(
                kind="exposure",
                title=f"Tested result is {result.position.replace('_', ' ')}",
                description=(f"The tested result of {_pct(result.tested_result)} is {result.position.replace('_', ' ')} "
                            f"the arm's-length range (LQ {_pct(result.lower_quartile)}, UQ {_pct(result.upper_quartile)}) "
                            "— transfer-pricing exposure."),
                severity="high", exposure_label="Outside arm's-length range", exposure_estimated=True,
                confidence="high",
                evidence=[Evidence("figure", basis,
                                   f"tested={_pct(result.tested_result)}, position={result.position}.")],
                recommendations=["Review the tested party's result and comparable set; consider an adjustment."]))

    # 6. Missing segmentation — an economic analysis exists but no financial segment was prepared for it.
    summary = await economic_analysis_summary(session, engagement_id)
    if summary["status"] != "unknown" and not summary["capabilities"]["financial_segment_available"]:
        out.append(Finding(
            kind="exposure", title="Missing financial segmentation",
            description=("An economic analysis has been started but no financial segment was prepared for the "
                         "tested party — the tested result is not isolated to the controlled transaction."),
            severity="medium", exposure_label="Missing segmentation", exposure_estimated=True, confidence="high",
            evidence=[Evidence("figure", "economic_analysis_summary",
                               f"status={summary['status']}, financial_segment_available=false.")],
            recommendations=["Prepare a financial segment for the tested party's controlled transaction."]))

    return out
