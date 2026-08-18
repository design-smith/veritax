"""Arm's-length range & conclusion (Class 3 §40-44).

REUSES the Class 1 registry engine — `compute_arm_length_range`, `position_in_range`, `benchmarking_method`
(jurisdiction quartile convention), `evaluate_period_compatibility` (freshness). Class 3 only gathers the
observations (one per accepted comparable) and the tested result, then feeds the deterministic engine and maps
the outcome. The LLM never decides whether a number is inside a range (§44).
"""
from __future__ import annotations

import statistics

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from regulatory import (
    benchmarking_method,
    compute_arm_length_range,
    evaluate_period_compatibility,
    position_in_range,
)

from .models import BenchmarkComparable, BenchmarkSet, TNMMAnalysis, TNMMCalculation

_POSITION = {"within": "within_range", "below": "below_range", "above": "above_range"}


def comparable_observation(pli_values: list | None) -> float | None:
    """One observation per comparable = the mean of its per-year PLI values (None if it has none)."""
    vals = [float(v) for v in (pli_values or []) if v is not None]
    return statistics.fmean(vals) if vals else None


async def compute_range(session: AsyncSession, benchmark_set: BenchmarkSet) -> dict:
    """Compute the arm's-length range for a benchmark set + place the tested result. Deterministic; reproducible."""
    comps = (await session.execute(
        select(BenchmarkComparable).where(BenchmarkComparable.benchmark_set_id == benchmark_set.id)
    )).scalars().all()
    observations = [o for c in comps if c.accepted and (o := comparable_observation(c.pli_values)) is not None]

    analysis = await session.get(TNMMAnalysis, benchmark_set.analysis_id)
    if analysis is not None and analysis.jurisdiction:
        bm = benchmarking_method(analysis.jurisdiction, analysis.period)   # jurisdiction quartile convention (Class 1)
    else:
        bm = {"method": "interquartile_range", "quartile_method": "inclusive"}
    rng = compute_arm_length_range(observations, method=bm["method"], quartile_method=bm["quartile_method"])

    tested = None
    if analysis is not None:
        tested = (await session.execute(
            select(TNMMCalculation.pli_value).where(TNMMCalculation.analysis_id == analysis.id)
            .order_by(TNMMCalculation.created_at.desc()).limit(1)
        )).scalar()
        tested = float(tested) if tested is not None else None

    if rng["status"] in ("unknown", "insufficient"):
        position = "insufficient_data"
    elif tested is None:
        position = "review_required"
    else:
        position = _POSITION.get(position_in_range(tested, rng), "review_required")

    freshness_status = None
    if analysis is not None and analysis.period:
        comp_period = benchmark_set.search_date or (benchmark_set.periods[-1] if benchmark_set.periods else None)
        if comp_period is not None:
            freshness_status = evaluate_period_compatibility(analysis.period, comp_period)["status"]

    return {
        "minimum": min(observations) if observations else None,
        "maximum": max(observations) if observations else None,
        "lower_quartile": rng.get("lower"),
        "median": rng.get("median"),
        "upper_quartile": rng.get("upper"),
        "statistical_method": f'{rng["method"]}:{rng["quartile_method"]}',
        "n": rng["n"],
        "tested_result": tested,
        "position": position,
        "jurisdiction": analysis.jurisdiction if analysis else None,
        "freshness_status": freshness_status,
    }
