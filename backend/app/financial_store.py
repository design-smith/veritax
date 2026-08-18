"""Persist parsed financials (Class 3 §9-11, §73).

Rows are BULK-inserted via SQLAlchemy Core (no per-row ORM) and summarised via SQL aggregation, so a large GL /
invoice population loads and rolls up without materialising millions of ORM objects or sending rows to an LLM.
(DuckDB/Polars columnar processing is a flagged follow-on if in-memory analytics over huge sets is ever needed.)
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from .financial_intake import ParsedFinancials
from .models import FinancialDataset, FinancialRow


async def create_dataset(
    session: AsyncSession, engagement_id: uuid.UUID, parsed: ParsedFinancials, *,
    document_id: uuid.UUID | None, dataset_type: str, source_filename: str,
    entity_id: str | None = None, period: str | None = None, currency: str | None = None,
) -> FinancialDataset:
    """Create the dataset + bulk-insert its rows. The uploaded Document stays untouched (§9)."""
    ds = FinancialDataset(
        engagement_id=engagement_id, document_id=document_id, entity_id=entity_id,
        dataset_type=dataset_type, source_filename=source_filename, source_sheet=parsed.sheet,
        period=period, currency=currency, columns=parsed.headers, row_count=len(parsed.rows),
    )
    session.add(ds)
    await session.flush()   # assign ds.id

    if parsed.rows:
        locator_base = parsed.sheet or source_filename
        await session.execute(insert(FinancialRow), [
            {
                "dataset_id": ds.id, "row_index": r.row_index,
                "account_code": r.account_code, "account_name": r.account_name, "amount": r.amount,
                "currency": r.currency or currency, "cost_center": r.cost_center,
                "business_unit": r.business_unit, "counterparty": r.counterparty, "period": r.period or period,
                "source_locator": f"{locator_base}!Row {r.row_index}", "raw": r.raw,
            }
            for r in parsed.rows
        ])
    return ds


async def dataset_summary(session: AsyncSession, dataset_id: uuid.UUID) -> dict:
    """Row count + totals by currency, computed in SQL (§73) — never by loading every row."""
    rows = (await session.execute(
        select(FinancialRow.currency, func.count(), func.sum(FinancialRow.amount))
        .where(FinancialRow.dataset_id == dataset_id)
        .group_by(FinancialRow.currency)
    )).all()
    totals = [
        {"currency": cur, "row_count": int(cnt), "total_amount": float(total) if total is not None else None}
        for cur, cnt, total in rows
    ]
    return {"row_count": sum(t["row_count"] for t in totals), "totals_by_currency": totals}
