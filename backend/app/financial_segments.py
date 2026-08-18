"""Financial segments — rule-based membership + segmented P&L (Class 3 §16-18, §24).

Membership is computed from segment_rules over the engagement's financial_rows via SQL (rules never mutate rows,
§9). The segmented P&L is a SQL rollup grouped by the S5 account classification with a net operating result, and
it drills to the underlying rows. Precise Revenue/COGS/operating-margin under a chosen PLI is S10 (TNMM).
"""
from __future__ import annotations

from sqlalchemy import and_, false, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    FinancialAdjustment,
    FinancialAllocation,
    FinancialDataset,
    FinancialRow,
    FinancialSegment,
    SegmentRule,
)

RULE_FIELDS = ("account_code", "account_name", "cost_center", "business_unit")
RULE_OPERATORS = ("equals", "in", "contains")
RULE_ACTIONS = ("include", "exclude")
ADJUSTMENT_TYPES = (
    "exclude_non_operating", "reclassify", "gaap_adjustment", "topside_adjustment",
    "manual_adjustment", "tp_true_up",
)
ALLOCATION_BASES = (
    "revenue", "headcount", "fte", "direct_cost", "time_spent", "units", "transaction_volume", "custom",
)

_FIELD_COL = {
    "account_code": FinancialRow.account_code,
    "account_name": FinancialRow.account_name,
    "cost_center": FinancialRow.cost_center,
    "business_unit": FinancialRow.business_unit,
}


def _rule_condition(rule: SegmentRule):
    col = _FIELD_COL.get(rule.field)
    if col is None:
        return None
    if rule.operator == "equals":
        return func.lower(col) == rule.value.strip().lower()
    if rule.operator == "in":
        vals = [v.strip().lower() for v in rule.value.split(",") if v.strip()]
        return func.lower(col).in_(vals) if vals else None
    if rule.operator == "contains":
        return col.ilike(f"%{rule.value.strip()}%")
    return None


def segment_row_filter(rules: list[SegmentRule]):
    """SQL condition selecting a segment's rows: (any include) AND NOT (any exclude). None → no include rules."""
    includes = [c for r in rules if r.action == "include" and (c := _rule_condition(r)) is not None]
    excludes = [c for r in rules if r.action == "exclude" and (c := _rule_condition(r)) is not None]
    if not includes:
        return None
    cond = or_(*includes)
    if excludes:
        cond = and_(cond, not_(or_(*excludes)))
    return cond


def _base_query(select_cols: list, segment: FinancialSegment, rules: list[SegmentRule]):
    cond = segment_row_filter(rules)
    q = (
        select(*select_cols)
        .select_from(FinancialRow)
        .join(FinancialDataset, FinancialRow.dataset_id == FinancialDataset.id)
        .where(FinancialDataset.engagement_id == segment.engagement_id)
    )
    if segment.period:
        q = q.where(or_(FinancialRow.period == segment.period, FinancialDataset.period == segment.period))
    return q.where(cond if cond is not None else false())


async def _rules(session: AsyncSession, segment: FinancialSegment) -> list[SegmentRule]:
    return list((await session.execute(
        select(SegmentRule).where(SegmentRule.segment_id == segment.id).order_by(SegmentRule.created_at)
    )).scalars().all())


async def segment_pnl(session: AsyncSession, segment: FinancialSegment) -> dict:
    """Segmented P&L: net signed sum + row count per classification, with the net operating result (§24).
    Drill via `segment_rows`."""
    rules = await _rules(session, segment)
    rows = (await session.execute(
        _base_query([FinancialRow.classification, func.count(), func.sum(FinancialRow.amount)], segment, rules)
        .group_by(FinancialRow.classification)
    )).all()
    lines = [
        {"classification": cls, "row_count": int(n), "total": float(t) if t is not None else 0.0}
        for cls, n, t in rows
    ]
    lines.sort(key=lambda ln: ln["classification"])
    operating = next((ln["total"] for ln in lines if ln["classification"] == "operating"), 0.0)

    # Adjustments (S7) + allocations (S8) are layered on top of the base P&L — raw rows are never touched (§75).
    adjustments = await segment_adjustments(session, segment)
    adj_total = sum(float(a.adjustment_amount) for a in adjustments)
    allocations = await segment_allocations(session, segment)
    alloc_total = sum(float(a.allocated_amount) for a in allocations)
    return {
        "segment_id": str(segment.id), "name": segment.name, "currency": segment.currency,
        "lines": lines, "operating_result": operating,
        "total": sum(ln["total"] for ln in lines), "row_count": sum(ln["row_count"] for ln in lines),
        "adjustments": [_adjustment_dict(a) for a in adjustments],
        "adjustments_total": adj_total,
        "allocations": [_allocation_dict(a) for a in allocations],
        "allocations_total": alloc_total,
        "adjusted_operating_result": operating + adj_total + alloc_total,
    }


def _allocation_dict(a: FinancialAllocation) -> dict:
    return {
        "id": str(a.id), "cost_pool": a.cost_pool, "pool_amount": float(a.pool_amount),
        "allocation_base": a.allocation_base, "allocation_percentage": float(a.allocation_percentage),
        "allocated_amount": float(a.allocated_amount), "source": a.source, "reason": a.reason,
        "created_by": str(a.created_by) if a.created_by else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


async def segment_allocations(session: AsyncSession, segment: FinancialSegment) -> list[FinancialAllocation]:
    return list((await session.execute(
        select(FinancialAllocation).where(FinancialAllocation.segment_id == segment.id)
        .order_by(FinancialAllocation.created_at)
    )).scalars().all())


def _adjustment_dict(a: FinancialAdjustment) -> dict:
    return {
        "id": str(a.id), "financial_row_id": str(a.financial_row_id) if a.financial_row_id else None,
        "account_ref": a.account_ref, "adjustment_type": a.adjustment_type,
        "original_amount": float(a.original_amount) if a.original_amount is not None else None,
        "adjustment_amount": float(a.adjustment_amount), "reason": a.reason,
        "created_by": str(a.created_by) if a.created_by else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


async def segment_adjustments(session: AsyncSession, segment: FinancialSegment) -> list[FinancialAdjustment]:
    return list((await session.execute(
        select(FinancialAdjustment).where(FinancialAdjustment.segment_id == segment.id)
        .order_by(FinancialAdjustment.created_at)
    )).scalars().all())


async def segment_tnmm_inputs(session: AsyncSession, segment: FinancialSegment) -> dict:
    """TNMM inputs from the segment (§34), under the documented sign convention (income positive, expense
    negative): revenue = Σ operating rows with amount>0; operating_profit = adjusted operating result (net
    operating + adjustments + allocations); total_costs = revenue − operating_profit."""
    rules = await _rules(session, segment)
    revenue = (await session.execute(
        _base_query([func.sum(FinancialRow.amount)], segment, rules)
        .where(FinancialRow.classification == "operating", FinancialRow.amount > 0)
    )).scalar()
    revenue = float(revenue) if revenue is not None else 0.0
    pnl = await segment_pnl(session, segment)
    operating_profit = pnl["adjusted_operating_result"]
    return {"revenue": revenue, "operating_profit": operating_profit, "total_costs": revenue - operating_profit}


async def segment_total(session: AsyncSession, segment: FinancialSegment) -> float | None:
    """SQL sum of the segment's matched-row amounts (for reconciliation, §25). None when nothing matches."""
    rules = await _rules(session, segment)
    total = (await session.execute(_base_query([func.sum(FinancialRow.amount)], segment, rules))).scalar()
    return float(total) if total is not None else None


async def segment_rows(session: AsyncSession, segment: FinancialSegment, *, limit: int, offset: int):
    """Matched rows for drill-down (§24) — original rows, never mutated."""
    rules = await _rules(session, segment)
    total = (await session.execute(_base_query([func.count()], segment, rules))).scalar() or 0
    rows = (await session.execute(
        _base_query([FinancialRow], segment, rules).order_by(FinancialRow.row_index).limit(limit).offset(offset)
    )).scalars().all()
    return int(total), rows
