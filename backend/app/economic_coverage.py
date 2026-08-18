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

from .models import (
    BenchmarkResult,
    BenchmarkSet,
    FinancialReconciliation,
    FinancialSegment,
    TNMMAnalysis,
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
