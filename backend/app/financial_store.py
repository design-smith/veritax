"""Persist parsed financials (Class 3 §9-11, §73).

Rows are BULK-inserted via SQLAlchemy Core (no per-row ORM) and summarised via SQL aggregation, so a large GL /
invoice population loads and rolls up without materialising millions of ORM objects or sending rows to an LLM.
Canonical fields are DERIVED from the immutable `raw` cells via the effective column mapping — so a remap (S3)
re-derives rows in place with no re-upload. (DuckDB/Polars columnar is a flagged follow-on if ever needed.)
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .financial_classification import classify_account
from .financial_intake import ParsedFinancials, derive_from_mapping
from .financial_validation import validate_rows
from .models import FinancialDataset, FinancialRow


async def create_dataset(
    session: AsyncSession, engagement_id: uuid.UUID, parsed: ParsedFinancials, *,
    document_id: uuid.UUID | None, dataset_type: str, source_filename: str, mapping: dict[str, str],
    entity_id: str | None = None, period: str | None = None, currency: str | None = None,
) -> FinancialDataset:
    """Create the dataset + bulk-insert its rows, deriving canonical fields from raw via `mapping`. Upload stays
    untouched (§9)."""
    ds = FinancialDataset(
        engagement_id=engagement_id, document_id=document_id, entity_id=entity_id,
        dataset_type=dataset_type, source_filename=source_filename, source_sheet=parsed.sheet,
        period=period, currency=currency, columns=parsed.headers, column_mapping=mapping,
        row_count=len(parsed.rows),
    )
    session.add(ds)
    await session.flush()   # assign ds.id

    if parsed.rows:
        locator_base = parsed.sheet or source_filename
        derived = [derive_from_mapping(r.raw, mapping) for r in parsed.rows]
        for d, r in zip(derived, parsed.rows):
            d["currency"] = d["currency"] or currency
            d["period"] = d["period"] or period
        issues, summary = validate_rows([{**d, "raw": r.raw} for d, r in zip(derived, parsed.rows)], mapping)
        ds.diagnostics = summary
        rows_to_insert = []
        for d, r, iss in zip(derived, parsed.rows, issues):
            cls, source = classify_account(d["account_code"], d["account_name"])
            rows_to_insert.append({
                "dataset_id": ds.id, "row_index": r.row_index, **d,
                "source_locator": f"{locator_base}!Row {r.row_index}", "raw": r.raw, "issues": iss,
                "classification": cls, "classification_source": source, "classification_original": cls,
            })
        await session.execute(insert(FinancialRow), rows_to_insert)
    else:
        _, ds.diagnostics = validate_rows([], mapping)
    return ds


async def reapply_mapping(session: AsyncSession, dataset: FinancialDataset, mapping: dict[str, str]) -> None:
    """Re-derive every row's canonical fields from its immutable `raw` cells using a new mapping (§9 — no
    re-upload). Bulk UPDATE by primary key (no per-row round trip)."""
    dataset.column_mapping = mapping
    rows = (await session.execute(
        select(FinancialRow.id, FinancialRow.raw, FinancialRow.classification_source)
        .where(FinancialRow.dataset_id == dataset.id)
    )).all()
    derived = []
    for _rid, raw, _src in rows:
        d = derive_from_mapping(raw, mapping)
        d["currency"] = d["currency"] or dataset.currency
        d["period"] = d["period"] or dataset.period
        derived.append(d)
    issues, summary = validate_rows([{**d, "raw": raw} for d, (_rid, raw, _src) in zip(derived, rows)], mapping)
    dataset.diagnostics = summary
    updates = []
    for d, (rid, _raw, src), iss in zip(derived, rows, issues):
        upd = {"id": rid, **d, "issues": iss}
        if src != "override":   # preserve a practitioner override; re-classify only auto rows on a remap
            cls, source = classify_account(d["account_code"], d["account_name"])
            upd.update(classification=cls, classification_source=source, classification_original=cls)
        updates.append(upd)
    if updates:
        await session.execute(update(FinancialRow), updates)


async def dataset_total(session: AsyncSession, dataset_id: uuid.UUID) -> float | None:
    """SQL sum of a dataset's row amounts (for reconciliation, §25). None when the dataset has no amounts."""
    total = (await session.execute(
        select(func.sum(FinancialRow.amount)).where(FinancialRow.dataset_id == dataset_id)
    )).scalar()
    return float(total) if total is not None else None


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
