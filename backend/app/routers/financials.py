"""Financial dataset intake API (Class 3 · S2, §7-11).

Upload an XLSX/CSV financial file → an immutable Document (reusing the existing ingest/provenance path) → a
parsed `financial_datasets` + bulk-inserted `financial_rows` with deterministic source provenance. Read back the
dataset summary and drill into source-linked rows. Column mapping (S3), validation (S4), and classification (S5)
build on this; here detection is default only.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..deps import (
    assert_owner,
    get_classification_suggester,
    get_column_mapping_suggester,
    get_current_user,
    get_session,
    get_storage,
    require_engagement_owner,
)
from ..financial_classification import CLASSIFICATIONS, ClassificationSuggester
from ..financial_intake import CANONICAL_FIELDS, detect_columns, header_signature, parse_financial_file
from ..financial_mapping import ColumnMappingSuggester, find_saved_mapping, save_mapping
from ..far_builder import build_far_profile, derive_characterization
from ..financial_reconciliation import reconcile
from ..financial_segments import (
    ADJUSTMENT_TYPES,
    ALLOCATION_BASES,
    RULE_ACTIONS,
    RULE_FIELDS,
    RULE_OPERATORS,
    segment_adjustments,
    segment_allocations,
    segment_pnl,
    segment_rows,
    segment_tnmm_inputs,
    segment_total,
)
from ..financial_store import create_dataset, dataset_summary, dataset_total, reapply_mapping
from ..financial_tnmm import PLI_TYPES, compute_pli
from ..ingest import get_or_create_uploaded_source, store_upload
from ..models import (
    BenchmarkComparable,
    BenchmarkSet,
    Engagement,
    FinancialAdjustment,
    FinancialAllocation,
    FinancialDataset,
    FinancialReconciliation,
    FinancialRow,
    FinancialSegment,
    SegmentRule,
    SourceKind,
    TNMMAnalysis,
    TNMMCalculation,
)
from ..storage import Storage

router = APIRouter(tags=["financials"])

MAX_UPLOAD_MB = 50
_MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024


class CurrencyTotal(BaseModel):
    currency: str | None
    row_count: int
    total_amount: float | None


class DatasetRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    document_id: uuid.UUID | None
    entity_id: str | None
    dataset_type: str
    source_filename: str | None
    source_sheet: str | None
    period: str | None
    currency: str | None
    columns: list[str]
    detected_columns: dict[str, str] | None = None
    status: str
    row_count: int
    diagnostics: dict | None = None
    totals_by_currency: list[CurrencyTotal] = []

    model_config = ConfigDict(from_attributes=True)


class RowRead(BaseModel):
    id: uuid.UUID
    row_index: int
    account_code: str | None
    account_name: str | None
    amount: float | None
    currency: str | None
    cost_center: str | None
    business_unit: str | None
    counterparty: str | None
    period: str | None
    source_locator: str
    raw: dict
    issues: list[str] = []
    classification: str
    classification_source: str
    classification_original: str | None = None
    classification_reason: str | None = None
    classification_overridden_by: uuid.UUID | None = None
    classification_overridden_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RowsPage(BaseModel):
    dataset_id: uuid.UUID
    total: int
    limit: int
    offset: int
    rows: list[RowRead]


async def _owned_dataset(session: AsyncSession, dataset_id: uuid.UUID, user: AuthUser) -> FinancialDataset:
    ds = await session.get(FinancialDataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="financial dataset not found")
    await assert_owner(session, ds.engagement_id, user)
    return ds


async def _to_read(session: AsyncSession, ds: FinancialDataset, *, detected: dict | None = None) -> DatasetRead:
    summary = await dataset_summary(session, ds.id)
    return DatasetRead(
        id=ds.id, engagement_id=ds.engagement_id, document_id=ds.document_id, entity_id=ds.entity_id,
        dataset_type=ds.dataset_type, source_filename=ds.source_filename, source_sheet=ds.source_sheet,
        period=ds.period, currency=ds.currency, columns=list(ds.columns or []), detected_columns=detected,
        status=ds.status, row_count=ds.row_count, diagnostics=ds.diagnostics,
        totals_by_currency=[CurrencyTotal(**t) for t in summary["totals_by_currency"]],
    )


@router.post("/engagements/{engagement_id}/financial-datasets", response_model=DatasetRead, status_code=201)
async def upload_financial_dataset(
    engagement_id: uuid.UUID,
    file: UploadFile = File(...),
    dataset_type: str = Form(...),
    period: str | None = Form(default=None),
    entity_id: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    user: AuthUser = Depends(get_current_user),
    _owner: Engagement = Depends(require_engagement_owner),
) -> DatasetRead:
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"file is over the {MAX_UPLOAD_MB} MB limit")
    filename = file.filename or "financials.xlsx"
    try:
        parsed = parse_financial_file(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Store the raw file immutably on the normal document path (SourceKind.financials).
    source = await get_or_create_uploaded_source(session, engagement_id, SourceKind.financials)
    doc = await store_upload(session, storage, engagement_id, source.id, filename, file.content_type, data)

    # Reuse a saved mapping for this source format if one exists (§14), else default detection (S3).
    saved = await find_saved_mapping(session, user.id, header_signature(parsed.headers))
    effective = saved if saved is not None else parsed.detected

    ds = await create_dataset(
        session, engagement_id, parsed, document_id=doc.id, dataset_type=dataset_type,
        source_filename=filename, mapping=effective, entity_id=entity_id, period=period,
    )
    await session.commit()
    return await _to_read(session, ds, detected=parsed.detected)


@router.get("/engagements/{engagement_id}/financial-datasets", response_model=list[DatasetRead])
async def list_financial_datasets(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[DatasetRead]:
    datasets = (await session.execute(
        select(FinancialDataset).where(FinancialDataset.engagement_id == engagement_id)
        .order_by(FinancialDataset.created_at.desc())
    )).scalars().all()
    return [await _to_read(session, ds) for ds in datasets]


@router.get("/financial-datasets/{dataset_id}", response_model=DatasetRead)
async def get_financial_dataset(
    dataset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> DatasetRead:
    ds = await _owned_dataset(session, dataset_id, user)
    return await _to_read(session, ds)


@router.get("/financial-datasets/{dataset_id}/rows", response_model=RowsPage)
async def get_financial_rows(
    dataset_id: uuid.UUID,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> RowsPage:
    ds = await _owned_dataset(session, dataset_id, user)
    rows = (await session.execute(
        select(FinancialRow).where(FinancialRow.dataset_id == ds.id)
        .order_by(FinancialRow.row_index).limit(limit).offset(offset)
    )).scalars().all()
    return RowsPage(
        dataset_id=ds.id, total=ds.row_count, limit=limit, offset=offset,
        rows=[RowRead.model_validate(r) for r in rows],
    )


@router.get("/financial-datasets/{dataset_id}/diagnostics")
async def get_diagnostics(
    dataset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    """Validation summary for the dataset (§15): status, counts by issue type, missing required columns."""
    ds = await _owned_dataset(session, dataset_id, user)
    return ds.diagnostics or {"status": "passed", "total_rows": ds.row_count, "rows_with_issues": 0,
                              "issue_counts": {}, "missing_required_columns": []}


class MappingRead(BaseModel):
    dataset_id: uuid.UUID
    headers: list[str]
    canonical_fields: list[str]
    detected: dict[str, str]    # default deterministic detection
    effective: dict[str, str]   # the mapping currently applied to the rows


class MappingUpdate(BaseModel):
    mapping: dict[str, str]
    save: bool = False
    label: str | None = None


class SuggestionsRead(BaseModel):
    dataset_id: uuid.UUID
    unmapped_fields: list[str]
    suggestions: dict[str, str]   # {canonical_field: source_header} — a SUGGESTION only, never auto-applied


def _validate_mapping(mapping: dict[str, str], headers: list[str]) -> None:
    unknown_fields = [f for f in mapping if f not in CANONICAL_FIELDS]
    if unknown_fields:
        raise HTTPException(status_code=422, detail=f"unknown canonical field(s): {', '.join(unknown_fields)}")
    bad_headers = [h for h in mapping.values() if h not in headers]
    if bad_headers:
        raise HTTPException(status_code=422, detail=f"mapping references missing column(s): {', '.join(bad_headers)}")


@router.get("/financial-datasets/{dataset_id}/mapping", response_model=MappingRead)
async def get_mapping(
    dataset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> MappingRead:
    ds = await _owned_dataset(session, dataset_id, user)
    headers = list(ds.columns or [])
    return MappingRead(
        dataset_id=ds.id, headers=headers, canonical_fields=list(CANONICAL_FIELDS),
        detected=detect_columns(headers), effective=dict(ds.column_mapping or {}),
    )


@router.put("/financial-datasets/{dataset_id}/mapping", response_model=DatasetRead)
async def update_mapping(
    dataset_id: uuid.UUID,
    body: MappingUpdate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> DatasetRead:
    ds = await _owned_dataset(session, dataset_id, user)
    headers = list(ds.columns or [])
    _validate_mapping(body.mapping, headers)
    await reapply_mapping(session, ds, body.mapping)   # re-derive rows from immutable raw (§9 — no re-upload)
    if body.save:
        await save_mapping(session, user.id, header_signature(headers), body.mapping, body.label)
    await session.commit()
    return await _to_read(session, ds, detected=detect_columns(headers))


@router.get("/financial-datasets/{dataset_id}/mapping/suggestions", response_model=SuggestionsRead)
async def suggest_mapping(
    dataset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
    suggester: ColumnMappingSuggester = Depends(get_column_mapping_suggester),
) -> SuggestionsRead:
    ds = await _owned_dataset(session, dataset_id, user)
    headers = list(ds.columns or [])
    effective = dict(ds.column_mapping or {})
    unmapped = [f for f in CANONICAL_FIELDS if f not in effective]
    # Suggestion ONLY — never auto-applied; the practitioner accepts it via PUT /mapping (§13, §74).
    return SuggestionsRead(
        dataset_id=ds.id, unmapped_fields=unmapped, suggestions=suggester.suggest(headers, unmapped),
    )


# ── Account classification (S5, §19) ──────────────────────────────────────────
class ClassificationUpdate(BaseModel):
    classification: str
    reason: str | None = None


class ClassificationSuggestion(BaseModel):
    row_id: uuid.UUID
    account_code: str | None
    account_name: str | None
    current: str
    suggestion: str | None


class ClassificationSuggestionsRead(BaseModel):
    dataset_id: uuid.UUID
    suggestions: list[ClassificationSuggestion]


async def _owned_row(session: AsyncSession, row_id: uuid.UUID, user: AuthUser) -> FinancialRow:
    row = await session.get(FinancialRow, row_id)
    if row is None:
        raise HTTPException(status_code=404, detail="financial row not found")
    ds = await session.get(FinancialDataset, row.dataset_id)
    await assert_owner(session, ds.engagement_id, user)
    return row


@router.put("/financial-rows/{row_id}/classification", response_model=RowRead)
async def override_classification(
    row_id: uuid.UUID,
    body: ClassificationUpdate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> RowRead:
    if body.classification not in CLASSIFICATIONS:
        raise HTTPException(status_code=422, detail=f"unknown classification: {body.classification}")
    row = await _owned_row(session, row_id, user)
    if row.classification_original is None:
        row.classification_original = row.classification   # preserve the pre-override value (audit)
    row.classification = body.classification
    row.classification_source = "override"
    row.classification_reason = body.reason
    row.classification_overridden_by = user.id
    row.classification_overridden_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(row)
    return RowRead.model_validate(row)


@router.get("/financial-datasets/{dataset_id}/classification/suggestions", response_model=ClassificationSuggestionsRead)
async def suggest_classifications(
    dataset_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
    suggester: ClassificationSuggester = Depends(get_classification_suggester),
) -> ClassificationSuggestionsRead:
    ds = await _owned_dataset(session, dataset_id, user)
    # Only the ambiguous rows (needs-review / defaulted, never overridden) get a suggestion — validated-only (§74).
    rows = (await session.execute(
        select(FinancialRow).where(
            FinancialRow.dataset_id == ds.id,
            FinancialRow.classification_source.in_(("default",)),
        ).order_by(FinancialRow.row_index)
    )).scalars().all()
    out = [
        ClassificationSuggestion(
            row_id=r.id, account_code=r.account_code, account_name=r.account_name,
            current=r.classification, suggestion=suggester.suggest(r.account_code, r.account_name),
        )
        for r in rows
    ]
    return ClassificationSuggestionsRead(dataset_id=ds.id, suggestions=out)


# ── Segments + segmented P&L (S6, §16-18, §24) ────────────────────────────────
class SegmentCreate(BaseModel):
    name: str
    entity_id: str | None = None
    period: str | None = None
    currency: str | None = None
    transaction_ids: list[str] = []


class SegmentRuleCreate(BaseModel):
    field: str
    operator: str
    value: str
    action: str = "include"
    reason: str | None = None


class SegmentRuleRead(BaseModel):
    id: uuid.UUID
    field: str
    operator: str
    value: str
    action: str
    reason: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SegmentRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    entity_id: str | None
    name: str
    period: str | None
    currency: str | None
    transaction_ids: list[str]
    status: str
    rules: list[SegmentRuleRead] = []

    model_config = ConfigDict(from_attributes=True)


async def _owned_segment(session: AsyncSession, segment_id: uuid.UUID, user: AuthUser) -> FinancialSegment:
    seg = await session.get(FinancialSegment, segment_id)
    if seg is None:
        raise HTTPException(status_code=404, detail="financial segment not found")
    await assert_owner(session, seg.engagement_id, user)
    return seg


async def _segment_read(session: AsyncSession, seg: FinancialSegment) -> SegmentRead:
    rules = (await session.execute(
        select(SegmentRule).where(SegmentRule.segment_id == seg.id).order_by(SegmentRule.created_at)
    )).scalars().all()
    return SegmentRead(
        id=seg.id, engagement_id=seg.engagement_id, entity_id=seg.entity_id, name=seg.name,
        period=seg.period, currency=seg.currency, transaction_ids=list(seg.transaction_ids or []),
        status=seg.status, rules=[SegmentRuleRead.model_validate(r) for r in rules],
    )


@router.post("/engagements/{engagement_id}/financial-segments", response_model=SegmentRead, status_code=201)
async def create_segment(
    engagement_id: uuid.UUID,
    body: SegmentCreate,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> SegmentRead:
    seg = FinancialSegment(
        engagement_id=engagement_id, name=body.name, entity_id=body.entity_id, period=body.period,
        currency=body.currency, transaction_ids=body.transaction_ids,
    )
    session.add(seg)
    await session.commit()
    return await _segment_read(session, seg)


@router.get("/engagements/{engagement_id}/financial-segments", response_model=list[SegmentRead])
async def list_segments(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[SegmentRead]:
    segs = (await session.execute(
        select(FinancialSegment).where(FinancialSegment.engagement_id == engagement_id)
        .order_by(FinancialSegment.created_at)
    )).scalars().all()
    return [await _segment_read(session, s) for s in segs]


@router.get("/financial-segments/{segment_id}", response_model=SegmentRead)
async def get_segment(
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> SegmentRead:
    return await _segment_read(session, await _owned_segment(session, segment_id, user))


@router.delete("/financial-segments/{segment_id}", status_code=204)
async def delete_segment(
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    seg = await _owned_segment(session, segment_id, user)
    await session.delete(seg)
    await session.commit()


@router.post("/financial-segments/{segment_id}/rules", response_model=SegmentRead, status_code=201)
async def add_segment_rule(
    segment_id: uuid.UUID,
    body: SegmentRuleCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> SegmentRead:
    seg = await _owned_segment(session, segment_id, user)
    if body.field not in RULE_FIELDS:
        raise HTTPException(status_code=422, detail=f"unknown field: {body.field}")
    if body.operator not in RULE_OPERATORS:
        raise HTTPException(status_code=422, detail=f"unknown operator: {body.operator}")
    if body.action not in RULE_ACTIONS:
        raise HTTPException(status_code=422, detail=f"unknown action: {body.action}")
    session.add(SegmentRule(
        segment_id=seg.id, field=body.field, operator=body.operator, value=body.value,
        action=body.action, reason=body.reason,
    ))
    await session.commit()
    return await _segment_read(session, seg)


@router.delete("/segment-rules/{rule_id}", status_code=204)
async def delete_segment_rule(
    rule_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    rule = await session.get(SegmentRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="segment rule not found")
    seg = await session.get(FinancialSegment, rule.segment_id)
    await assert_owner(session, seg.engagement_id, user)
    await session.delete(rule)
    await session.commit()


@router.get("/financial-segments/{segment_id}/pnl")
async def get_segment_pnl(
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> dict:
    seg = await _owned_segment(session, segment_id, user)
    return await segment_pnl(session, seg)


@router.get("/financial-segments/{segment_id}/rows", response_model=RowsPage)
async def get_segment_rows(
    segment_id: uuid.UUID,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> RowsPage:
    seg = await _owned_segment(session, segment_id, user)
    total, rows = await segment_rows(session, seg, limit=limit, offset=offset)
    return RowsPage(
        dataset_id=seg.id, total=total, limit=limit, offset=offset,
        rows=[RowRead.model_validate(r) for r in rows],
    )


# ── Adjustments (S7, §20-21, §61, §75) ────────────────────────────────────────
class AdjustmentCreate(BaseModel):
    adjustment_type: str
    adjustment_amount: float
    financial_row_id: uuid.UUID | None = None
    account_ref: str | None = None
    original_amount: float | None = None
    reason: str | None = None


class AdjustmentRead(BaseModel):
    id: uuid.UUID
    segment_id: uuid.UUID
    financial_row_id: uuid.UUID | None
    account_ref: str | None
    adjustment_type: str
    original_amount: float | None
    adjustment_amount: float
    reason: str | None
    created_by: uuid.UUID | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


@router.post("/financial-segments/{segment_id}/adjustments", response_model=AdjustmentRead, status_code=201)
async def add_adjustment(
    segment_id: uuid.UUID,
    body: AdjustmentCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> AdjustmentRead:
    seg = await _owned_segment(session, segment_id, user)
    if body.adjustment_type not in ADJUSTMENT_TYPES:
        raise HTTPException(status_code=422, detail=f"unknown adjustment type: {body.adjustment_type}")
    adj = FinancialAdjustment(
        segment_id=seg.id, financial_row_id=body.financial_row_id, account_ref=body.account_ref,
        adjustment_type=body.adjustment_type, original_amount=body.original_amount,
        adjustment_amount=body.adjustment_amount, reason=body.reason, created_by=user.id,
    )
    session.add(adj)
    await session.commit()
    await session.refresh(adj)
    return AdjustmentRead.model_validate(adj)


@router.get("/financial-segments/{segment_id}/adjustments", response_model=list[AdjustmentRead])
async def list_adjustments(
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> list[AdjustmentRead]:
    seg = await _owned_segment(session, segment_id, user)
    return [AdjustmentRead.model_validate(a) for a in await segment_adjustments(session, seg)]


@router.delete("/financial-adjustments/{adjustment_id}", status_code=204)
async def delete_adjustment(
    adjustment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    adj = await session.get(FinancialAdjustment, adjustment_id)
    if adj is None:
        raise HTTPException(status_code=404, detail="adjustment not found")
    seg = await session.get(FinancialSegment, adj.segment_id)
    await assert_owner(session, seg.engagement_id, user)
    await session.delete(adj)
    await session.commit()


# ── Allocations (S8, §22-23) ──────────────────────────────────────────────────
class AllocationCreate(BaseModel):
    cost_pool: str
    pool_amount: float
    allocation_base: str
    allocation_percentage: float
    source: str | None = None
    reason: str | None = None


class AllocationRead(BaseModel):
    id: uuid.UUID
    segment_id: uuid.UUID
    cost_pool: str
    pool_amount: float
    allocation_base: str
    allocation_percentage: float
    allocated_amount: float
    source: str | None
    reason: str | None
    created_by: uuid.UUID | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


@router.post("/financial-segments/{segment_id}/allocations", response_model=AllocationRead, status_code=201)
async def add_allocation(
    segment_id: uuid.UUID,
    body: AllocationCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> AllocationRead:
    seg = await _owned_segment(session, segment_id, user)
    if body.allocation_base not in ALLOCATION_BASES:
        raise HTTPException(status_code=422, detail=f"unknown allocation base: {body.allocation_base}")
    # Compute the allocated amount server-side — never trust a client-supplied result (§74).
    allocated = round(body.pool_amount * body.allocation_percentage / 100.0, 2)
    alloc = FinancialAllocation(
        segment_id=seg.id, cost_pool=body.cost_pool, pool_amount=body.pool_amount,
        allocation_base=body.allocation_base, allocation_percentage=body.allocation_percentage,
        allocated_amount=allocated, source=body.source, reason=body.reason, created_by=user.id,
    )
    session.add(alloc)
    await session.commit()
    await session.refresh(alloc)
    return AllocationRead.model_validate(alloc)


@router.get("/financial-segments/{segment_id}/allocations", response_model=list[AllocationRead])
async def list_allocations(
    segment_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> list[AllocationRead]:
    seg = await _owned_segment(session, segment_id, user)
    return [AllocationRead.model_validate(a) for a in await segment_allocations(session, seg)]


@router.delete("/financial-allocations/{allocation_id}", status_code=204)
async def delete_allocation(
    allocation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    alloc = await session.get(FinancialAllocation, allocation_id)
    if alloc is None:
        raise HTTPException(status_code=404, detail="allocation not found")
    seg = await session.get(FinancialSegment, alloc.segment_id)
    await assert_owner(session, seg.engagement_id, user)
    await session.delete(alloc)
    await session.commit()


# ── Reconciliation / financial tie-out (S9, §25-28) ───────────────────────────
class ReconcileRef(BaseModel):
    kind: str   # dataset|segment
    id: uuid.UUID


class ReconciliationCreate(BaseModel):
    label: str
    source: ReconcileRef
    target: ReconcileRef
    tolerance: float = 0.0
    rounding: float = 1.0
    explanation: str | None = None


class ReconciliationRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    label: str
    source_kind: str
    source_id: uuid.UUID
    target_kind: str
    target_id: uuid.UUID
    source_total: float | None
    target_total: float | None
    difference: float | None
    difference_pct: float | None
    tolerance: float
    rounding: float
    status: str
    explanation: str | None
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


async def _ref_total(session: AsyncSession, engagement_id: uuid.UUID, ref: ReconcileRef) -> float | None:
    """Server-side total for a reconciliation reference; 404 if it isn't in this engagement, 422 for a bad kind."""
    if ref.kind == "dataset":
        ds = await session.get(FinancialDataset, ref.id)
        if ds is None or ds.engagement_id != engagement_id:
            raise HTTPException(status_code=404, detail="dataset not found in this engagement")
        return await dataset_total(session, ds.id)
    if ref.kind == "segment":
        seg = await session.get(FinancialSegment, ref.id)
        if seg is None or seg.engagement_id != engagement_id:
            raise HTTPException(status_code=404, detail="segment not found in this engagement")
        return await segment_total(session, seg)
    raise HTTPException(status_code=422, detail=f"unknown reference kind: {ref.kind}")


@router.post("/engagements/{engagement_id}/reconciliations", response_model=ReconciliationRead, status_code=201)
async def create_reconciliation(
    engagement_id: uuid.UUID,
    body: ReconciliationCreate,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> ReconciliationRead:
    src_total = await _ref_total(session, engagement_id, body.source)
    tgt_total = await _ref_total(session, engagement_id, body.target)
    result = reconcile(src_total, tgt_total, tolerance=body.tolerance, rounding=body.rounding)
    rec = FinancialReconciliation(
        engagement_id=engagement_id, label=body.label,
        source_kind=body.source.kind, source_id=body.source.id,
        target_kind=body.target.kind, target_id=body.target.id,
        source_total=src_total, target_total=tgt_total,
        difference=result["difference"], difference_pct=result["difference_pct"],
        tolerance=body.tolerance, rounding=body.rounding, status=result["status"], explanation=body.explanation,
    )
    session.add(rec)
    await session.commit()
    await session.refresh(rec)
    return ReconciliationRead.model_validate(rec)


@router.get("/engagements/{engagement_id}/reconciliations", response_model=list[ReconciliationRead])
async def list_reconciliations(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[ReconciliationRead]:
    recs = (await session.execute(
        select(FinancialReconciliation).where(FinancialReconciliation.engagement_id == engagement_id)
        .order_by(FinancialReconciliation.created_at)
    )).scalars().all()
    return [ReconciliationRead.model_validate(r) for r in recs]


@router.delete("/reconciliations/{reconciliation_id}", status_code=204)
async def delete_reconciliation(
    reconciliation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    rec = await session.get(FinancialReconciliation, reconciliation_id)
    if rec is None:
        raise HTTPException(status_code=404, detail="reconciliation not found")
    await assert_owner(session, rec.engagement_id, user)
    await session.delete(rec)
    await session.commit()


# ── TNMM analysis (S10, §29-35, §64) ──────────────────────────────────────────
TNMM_STATUSES = (
    "not_started", "data_preparation", "segmentation_required", "ready_for_analysis",
    "analysis_in_progress", "review_required", "complete",
)


class TNMMCreate(BaseModel):
    pli_type: str
    tested_party_entity_id: str | None = None
    tested_party_rationale: str | None = None
    segment_id: uuid.UUID | None = None
    transaction_id: str | None = None
    jurisdiction: str | None = None
    period: str | None = None


class TNMMPatch(BaseModel):
    pli_type: str | None = None
    tested_party_entity_id: str | None = None
    tested_party_rationale: str | None = None
    segment_id: uuid.UUID | None = None
    status: str | None = None


class TNMMCalculationRead(BaseModel):
    revenue: float | None
    total_costs: float | None
    operating_profit: float | None
    pli_value: float | None
    calculation_version: str
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TNMMAnalysisRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    transaction_id: str | None
    tested_party_entity_id: str | None
    tested_party_rationale: str | None
    tested_party_selected_by: uuid.UUID | None
    segment_id: uuid.UUID | None
    pli_type: str
    jurisdiction: str | None
    period: str | None
    status: str
    far_characterization: str | None = None   # Class 2 FAR link (informs the tested-party rationale)
    calculation: TNMMCalculationRead | None = None


async def _owned_analysis(session: AsyncSession, analysis_id: uuid.UUID, user: AuthUser) -> TNMMAnalysis:
    a = await session.get(TNMMAnalysis, analysis_id)
    if a is None:
        raise HTTPException(status_code=404, detail="TNMM analysis not found")
    await assert_owner(session, a.engagement_id, user)
    return a


async def _analysis_read(session: AsyncSession, a: TNMMAnalysis) -> TNMMAnalysisRead:
    latest = (await session.execute(
        select(TNMMCalculation).where(TNMMCalculation.analysis_id == a.id)
        .order_by(TNMMCalculation.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    far = derive_characterization(await build_far_profile(session, a.engagement_id))
    return TNMMAnalysisRead(
        id=a.id, engagement_id=a.engagement_id, transaction_id=a.transaction_id,
        tested_party_entity_id=a.tested_party_entity_id, tested_party_rationale=a.tested_party_rationale,
        tested_party_selected_by=a.tested_party_selected_by, segment_id=a.segment_id, pli_type=a.pli_type,
        jurisdiction=a.jurisdiction, period=a.period, status=a.status, far_characterization=far,
        calculation=TNMMCalculationRead.model_validate(latest) if latest else None,
    )


@router.post("/engagements/{engagement_id}/tnmm-analyses", response_model=TNMMAnalysisRead, status_code=201)
async def create_tnmm_analysis(
    engagement_id: uuid.UUID,
    body: TNMMCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
    _owner: Engagement = Depends(require_engagement_owner),
) -> TNMMAnalysisRead:
    if body.pli_type not in PLI_TYPES:
        raise HTTPException(status_code=422, detail=f"unknown PLI: {body.pli_type}")
    a = TNMMAnalysis(
        engagement_id=engagement_id, pli_type=body.pli_type, transaction_id=body.transaction_id,
        tested_party_entity_id=body.tested_party_entity_id, tested_party_rationale=body.tested_party_rationale,
        tested_party_selected_by=user.id if body.tested_party_entity_id else None,   # practitioner-selected (§31)
        segment_id=body.segment_id, jurisdiction=body.jurisdiction, period=body.period,
    )
    session.add(a)
    await session.commit()
    return await _analysis_read(session, a)


@router.get("/engagements/{engagement_id}/tnmm-analyses", response_model=list[TNMMAnalysisRead])
async def list_tnmm_analyses(
    engagement_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _owner: Engagement = Depends(require_engagement_owner),
) -> list[TNMMAnalysisRead]:
    rows = (await session.execute(
        select(TNMMAnalysis).where(TNMMAnalysis.engagement_id == engagement_id).order_by(TNMMAnalysis.created_at)
    )).scalars().all()
    return [await _analysis_read(session, a) for a in rows]


@router.get("/tnmm-analyses/{analysis_id}", response_model=TNMMAnalysisRead)
async def get_tnmm_analysis(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TNMMAnalysisRead:
    return await _analysis_read(session, await _owned_analysis(session, analysis_id, user))


@router.patch("/tnmm-analyses/{analysis_id}", response_model=TNMMAnalysisRead)
async def patch_tnmm_analysis(
    analysis_id: uuid.UUID,
    body: TNMMPatch,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TNMMAnalysisRead:
    a = await _owned_analysis(session, analysis_id, user)
    if body.pli_type is not None:
        if body.pli_type not in PLI_TYPES:
            raise HTTPException(status_code=422, detail=f"unknown PLI: {body.pli_type}")
        a.pli_type = body.pli_type
    if body.status is not None:
        if body.status not in TNMM_STATUSES:
            raise HTTPException(status_code=422, detail=f"unknown status: {body.status}")
        a.status = body.status
    if body.tested_party_entity_id is not None:
        a.tested_party_entity_id = body.tested_party_entity_id
        a.tested_party_selected_by = user.id            # practitioner-selected (§31)
    if body.tested_party_rationale is not None:
        a.tested_party_rationale = body.tested_party_rationale
    if body.segment_id is not None:
        a.segment_id = body.segment_id
    await session.commit()
    return await _analysis_read(session, a)


@router.post("/tnmm-analyses/{analysis_id}/compute", response_model=TNMMAnalysisRead)
async def compute_tnmm_analysis(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TNMMAnalysisRead:
    a = await _owned_analysis(session, analysis_id, user)
    if a.segment_id is None:
        raise HTTPException(status_code=422, detail="select a segment before computing the PLI")
    seg = await session.get(FinancialSegment, a.segment_id)
    if seg is None:
        raise HTTPException(status_code=422, detail="the analysis segment no longer exists")
    inputs = await segment_tnmm_inputs(session, seg)
    pli = compute_pli(
        a.pli_type, revenue=inputs["revenue"], operating_profit=inputs["operating_profit"],
        total_costs=inputs["total_costs"],
    )
    session.add(TNMMCalculation(
        analysis_id=a.id, revenue=inputs["revenue"], total_costs=inputs["total_costs"],
        operating_profit=inputs["operating_profit"], pli_value=pli, calculation_version="tnmm-v1",
    ))
    await session.commit()
    return await _analysis_read(session, a)


# ── Benchmark import (S11, §36-39, §70) ───────────────────────────────────────
class ComparableIn(BaseModel):
    company_name: str
    country: str | None = None
    accepted: bool = True
    rejection_reason: str | None = None
    pli_values: list[float] = []
    financial_values: dict | None = None
    years: list | None = None


class BenchmarkSetCreate(BaseModel):
    source: str
    search_date: str | None = None
    periods: list = []
    geographic_scope: str | None = None
    industry_scope: str | None = None
    search_strategy: str | None = None
    comparables: list[ComparableIn] = []


class ComparableRead(BaseModel):
    id: uuid.UUID
    company_name: str
    country: str | None
    accepted: bool
    rejection_reason: str | None
    pli_values: list[float]
    financial_values: dict | None
    years: list | None

    model_config = ConfigDict(from_attributes=True)


class BenchmarkSetRead(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    source: str
    search_date: str | None
    periods: list
    geographic_scope: str | None
    industry_scope: str | None
    search_strategy: str | None
    accepted_count: int
    rejected_count: int
    comparables: list[ComparableRead] = []

    model_config = ConfigDict(from_attributes=True)


async def _benchmark_read(session: AsyncSession, bs: BenchmarkSet, *, include_comparables: bool = True) -> BenchmarkSetRead:
    comps = (await session.execute(
        select(BenchmarkComparable).where(BenchmarkComparable.benchmark_set_id == bs.id)
        .order_by(BenchmarkComparable.company_name)
    )).scalars().all()
    return BenchmarkSetRead(
        id=bs.id, analysis_id=bs.analysis_id, source=bs.source, search_date=bs.search_date,
        periods=list(bs.periods or []), geographic_scope=bs.geographic_scope, industry_scope=bs.industry_scope,
        search_strategy=bs.search_strategy,
        accepted_count=sum(1 for c in comps if c.accepted), rejected_count=sum(1 for c in comps if not c.accepted),
        comparables=[ComparableRead.model_validate(c) for c in comps] if include_comparables else [],
    )


async def _owned_benchmark_set(session: AsyncSession, set_id: uuid.UUID, user: AuthUser) -> BenchmarkSet:
    bs = await session.get(BenchmarkSet, set_id)
    if bs is None:
        raise HTTPException(status_code=404, detail="benchmark set not found")
    analysis = await session.get(TNMMAnalysis, bs.analysis_id)
    await assert_owner(session, analysis.engagement_id, user)
    return bs


@router.post("/tnmm-analyses/{analysis_id}/benchmark-sets", response_model=BenchmarkSetRead, status_code=201)
async def import_benchmark_set(
    analysis_id: uuid.UUID,
    body: BenchmarkSetCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> BenchmarkSetRead:
    analysis = await _owned_analysis(session, analysis_id, user)
    bs = BenchmarkSet(
        analysis_id=analysis.id, source=body.source, search_date=body.search_date, periods=body.periods,
        geographic_scope=body.geographic_scope, industry_scope=body.industry_scope,
        search_strategy=body.search_strategy,
    )
    session.add(bs)
    await session.flush()
    for c in body.comparables:   # preserve the FULL population — accepted AND rejected (§38)
        session.add(BenchmarkComparable(
            benchmark_set_id=bs.id, company_name=c.company_name, country=c.country, accepted=c.accepted,
            rejection_reason=c.rejection_reason, pli_values=c.pli_values, financial_values=c.financial_values,
            years=c.years,
        ))
    await session.commit()
    return await _benchmark_read(session, bs)


@router.get("/tnmm-analyses/{analysis_id}/benchmark-sets", response_model=list[BenchmarkSetRead])
async def list_benchmark_sets(
    analysis_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> list[BenchmarkSetRead]:
    analysis = await _owned_analysis(session, analysis_id, user)
    sets = (await session.execute(
        select(BenchmarkSet).where(BenchmarkSet.analysis_id == analysis.id).order_by(BenchmarkSet.created_at)
    )).scalars().all()
    return [await _benchmark_read(session, bs) for bs in sets]


@router.get("/benchmark-sets/{set_id}", response_model=BenchmarkSetRead)
async def get_benchmark_set(
    set_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> BenchmarkSetRead:
    return await _benchmark_read(session, await _owned_benchmark_set(session, set_id, user))


@router.delete("/benchmark-sets/{set_id}", status_code=204)
async def delete_benchmark_set(
    set_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    bs = await _owned_benchmark_set(session, set_id, user)
    await session.delete(bs)
    await session.commit()
