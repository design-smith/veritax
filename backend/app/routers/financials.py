"""Financial dataset intake API (Class 3 · S2, §7-11).

Upload an XLSX/CSV financial file → an immutable Document (reusing the existing ingest/provenance path) → a
parsed `financial_datasets` + bulk-inserted `financial_rows` with deterministic source provenance. Read back the
dataset summary and drill into source-linked rows. Column mapping (S3), validation (S4), and classification (S5)
build on this; here detection is default only.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..deps import (
    assert_owner,
    get_column_mapping_suggester,
    get_current_user,
    get_session,
    get_storage,
    require_engagement_owner,
)
from ..financial_intake import CANONICAL_FIELDS, detect_columns, header_signature, parse_financial_file
from ..financial_mapping import ColumnMappingSuggester, find_saved_mapping, save_mapping
from ..financial_store import create_dataset, dataset_summary, reapply_mapping
from ..ingest import get_or_create_uploaded_source, store_upload
from ..models import Engagement, FinancialDataset, FinancialRow, SourceKind
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
        status=ds.status, row_count=ds.row_count,
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
