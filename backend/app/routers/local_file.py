"""Local File project & controlled-transaction population API (Local File spec §2).

The Local File begins with its controlled-transaction population, not document drafting. One project per
(engagement × jurisdiction) — one local entity, one jurisdiction, one fiscal year — auto-ensured from the
engagement. Transactions are entered in the browser AND via the Excel template (download → upload → validate →
preview → import). Direct import: on confirm we create controlled_transaction rows and keep the raw file as an
immutable Document for audit. Aggregated at the TP-category level, never individual ERP postings.
"""
from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import AuthUser
from ..ct_intake import (
    BLOCKING_ISSUES,
    DIRECTIONS,
    build_template,
    canonical_category,
    detect_columns,
    derive_ct_row,
    normalize_country,
    parse_ct_file,
    validate_ct_rows,
)
from ..deps import assert_owner, get_current_user, get_session, get_storage, require_engagement_owner
from ..ingest import get_or_create_uploaded_source, store_upload
from ..models import ControlledTransaction, Engagement, LocalFileProject, SourceKind
from ..storage import Storage

router = APIRouter(tags=["local-file"])

MAX_UPLOAD_MB = 50
_MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
_XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# ── Schemas ────────────────────────────────────────────────────────────────────
class TransactionRead(BaseModel):
    id: uuid.UUID
    local_file_project_id: uuid.UUID
    transaction_category: str
    description: str | None
    associated_enterprise_name: str | None
    associated_enterprise_country: str | None
    direction: str
    local_currency: str | None
    local_currency_amount: float | None
    group_currency: str | None
    group_currency_amount: float | None
    period_start: date | None
    period_end: date | None
    materiality_status: str | None
    notes: str | None
    source_document_id: uuid.UUID | None

    model_config = ConfigDict(from_attributes=True)


class TransactionCreate(BaseModel):
    transaction_category: str
    description: str | None = None
    associated_enterprise_name: str | None = None
    associated_enterprise_country: str | None = None
    direction: str = "payment"
    local_currency: str | None = None
    local_currency_amount: float | None = None
    group_currency: str | None = None
    group_currency_amount: float | None = None
    period_start: date | None = None
    period_end: date | None = None
    materiality_status: str | None = None
    notes: str | None = None


class TransactionUpdate(BaseModel):
    transaction_category: str | None = None
    description: str | None = None
    associated_enterprise_name: str | None = None
    associated_enterprise_country: str | None = None
    direction: str | None = None
    local_currency: str | None = None
    local_currency_amount: float | None = None
    group_currency: str | None = None
    group_currency_amount: float | None = None
    period_start: date | None = None
    period_end: date | None = None
    materiality_status: str | None = None
    notes: str | None = None


class LocalFileProjectRead(BaseModel):
    id: uuid.UUID
    engagement_id: uuid.UUID
    entity_id: uuid.UUID | None
    jurisdiction: str
    fiscal_year: str | None
    statutory_period_start: date | None
    statutory_period_end: date | None
    statutory_currency: str | None
    consolidation_period_start: date | None
    consolidation_period_end: date | None
    group_reporting_currency: str | None
    status: str
    transactions: list[TransactionRead] = []

    model_config = ConfigDict(from_attributes=True)


class LocalFileProjectPatch(BaseModel):
    statutory_period_start: date | None = None
    statutory_period_end: date | None = None
    statutory_currency: str | None = None
    consolidation_period_start: date | None = None
    consolidation_period_end: date | None = None
    group_reporting_currency: str | None = None
    status: str | None = None


class TxnPreview(BaseModel):
    columns: list[str]
    detected_mapping: dict[str, str]
    rows: list[dict]
    diagnostics: dict


class TxnImportResult(BaseModel):
    imported: int
    skipped: int
    diagnostics: dict
    transactions: list[TransactionRead]


# ── Helpers ────────────────────────────────────────────────────────────────────
async def _load_project(session: AsyncSession, project_id: uuid.UUID) -> LocalFileProject | None:
    """Load a project with its transactions eagerly (via the selectin relationship)."""
    return (await session.execute(
        select(LocalFileProject).where(LocalFileProject.id == project_id)
    )).scalar_one_or_none()


async def _owned_project(session: AsyncSession, project_id: uuid.UUID, user: AuthUser) -> LocalFileProject:
    proj = await _load_project(session, project_id)
    if proj is None:
        raise HTTPException(status_code=404, detail="local file project not found")
    await assert_owner(session, proj.engagement_id, user)
    return proj


def _apply_transaction_fields(txn: ControlledTransaction, body: BaseModel) -> None:
    """Apply provided fields to a transaction, normalizing category + country + direction."""
    data = body.model_dump(exclude_unset=True)
    if "transaction_category" in data and data["transaction_category"] is not None:
        cat = canonical_category(data["transaction_category"])
        if cat is None:
            raise HTTPException(status_code=422, detail=f"unknown transaction category: {data['transaction_category']}")
        data["transaction_category"] = cat
    if "direction" in data and data["direction"] is not None and data["direction"] not in DIRECTIONS:
        raise HTTPException(status_code=422, detail=f"unknown direction: {data['direction']}")
    if data.get("associated_enterprise_country"):
        data["associated_enterprise_country"] = (
            normalize_country(data["associated_enterprise_country"]) or data["associated_enterprise_country"]
        )
    for k, v in data.items():
        setattr(txn, k, v)


# ── Project ────────────────────────────────────────────────────────────────────
@router.get("/engagements/{engagement_id}/local-file/{jurisdiction}", response_model=LocalFileProjectRead)
async def get_local_file(
    engagement_id: uuid.UUID,
    jurisdiction: str,
    session: AsyncSession = Depends(get_session),
    eng: Engagement = Depends(require_engagement_owner),
) -> LocalFileProjectRead:
    """Ensure + return the Local File project for this jurisdiction (auto-created from the engagement)."""
    proj = (await session.execute(
        select(LocalFileProject).where(
            LocalFileProject.engagement_id == engagement_id,
            LocalFileProject.jurisdiction == jurisdiction,
        )
    )).scalar_one_or_none()
    if proj is None:
        proj = LocalFileProject(
            engagement_id=engagement_id, entity_id=eng.entity_id, jurisdiction=jurisdiction,
            fiscal_year=eng.fiscal_year,
        )
        session.add(proj)
        await session.commit()
        proj = await _load_project(session, proj.id)
    return LocalFileProjectRead.model_validate(proj)


@router.patch("/local-file-projects/{project_id}", response_model=LocalFileProjectRead)
async def patch_local_file_project(
    project_id: uuid.UUID,
    body: LocalFileProjectPatch,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> LocalFileProjectRead:
    proj = await _owned_project(session, project_id, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(proj, k, v)
    await session.commit()
    return LocalFileProjectRead.model_validate(await _load_project(session, proj.id))


# ── Transactions (browser CRUD) ────────────────────────────────────────────────
@router.post("/local-file-projects/{project_id}/transactions", response_model=TransactionRead, status_code=201)
async def create_transaction(
    project_id: uuid.UUID,
    body: TransactionCreate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TransactionRead:
    proj = await _owned_project(session, project_id, user)
    txn = ControlledTransaction(local_file_project_id=proj.id, transaction_category="other")
    _apply_transaction_fields(txn, body)
    session.add(txn)
    await session.commit()
    await session.refresh(txn)
    return TransactionRead.model_validate(txn)


@router.patch("/controlled-transactions/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: uuid.UUID,
    body: TransactionUpdate,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TransactionRead:
    txn = await session.get(ControlledTransaction, transaction_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="controlled transaction not found")
    proj = await session.get(LocalFileProject, txn.local_file_project_id)
    await assert_owner(session, proj.engagement_id, user)
    _apply_transaction_fields(txn, body)
    await session.commit()
    await session.refresh(txn)
    return TransactionRead.model_validate(txn)


@router.delete("/controlled-transactions/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> None:
    txn = await session.get(ControlledTransaction, transaction_id)
    if txn is None:
        raise HTTPException(status_code=404, detail="controlled transaction not found")
    proj = await session.get(LocalFileProject, txn.local_file_project_id)
    await assert_owner(session, proj.engagement_id, user)
    await session.delete(txn)
    await session.commit()


# ── Excel template + import ────────────────────────────────────────────────────
@router.get("/engagements/{engagement_id}/controlled-transactions-template")
async def download_template(
    engagement_id: uuid.UUID,
    _owner: Engagement = Depends(require_engagement_owner),
) -> Response:
    return Response(
        content=build_template(), media_type=_XLSX_MEDIA,
        headers={"Content-Disposition": 'attachment; filename="controlled-transactions-template.xlsx"'},
    )


def _display_row(d: dict) -> dict:
    """A JSON-serializable view of a derived row for the preview."""
    return {
        **{k: d[k] for k in (
            "description", "associated_enterprise_name", "associated_enterprise_country", "direction",
            "local_currency", "local_currency_amount", "group_currency", "group_currency_amount",
            "materiality_status", "notes",
        )},
        "transaction_category": canonical_category(d["transaction_category"]) or d["transaction_category"],
        "period_start": d["period_start"].isoformat() if d["period_start"] else None,
        "period_end": d["period_end"].isoformat() if d["period_end"] else None,
    }


@router.post("/local-file-projects/{project_id}/transactions/preview", response_model=TxnPreview)
async def preview_transactions(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    user: AuthUser = Depends(get_current_user),
) -> TxnPreview:
    proj = await _owned_project(session, project_id, user)
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"file is over the {MAX_UPLOAD_MB} MB limit")
    try:
        headers, raws = parse_ct_file(file.filename or "transactions.xlsx", data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    mapping = detect_columns(headers)
    derived = [derive_ct_row(r, mapping) for r in raws]
    issues, summary = validate_ct_rows(
        [{**d, "raw": r} for d, r in zip(derived, raws)], mapping,
        statutory_start=proj.statutory_period_start, statutory_end=proj.statutory_period_end,
    )
    rows = [{"values": _display_row(d), "issues": iss} for d, iss in zip(derived, issues)]
    return TxnPreview(columns=headers, detected_mapping=mapping, rows=rows, diagnostics=summary)


@router.post("/local-file-projects/{project_id}/transactions/import", response_model=TxnImportResult, status_code=201)
async def import_transactions(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    storage: Storage = Depends(get_storage),
    user: AuthUser = Depends(get_current_user),
) -> TxnImportResult:
    proj = await _owned_project(session, project_id, user)
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"file is over the {MAX_UPLOAD_MB} MB limit")
    filename = file.filename or "transactions.xlsx"
    try:
        headers, raws = parse_ct_file(filename, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    mapping = detect_columns(headers)
    derived = [derive_ct_row(r, mapping) for r in raws]
    issues, summary = validate_ct_rows(
        [{**d, "raw": r} for d, r in zip(derived, raws)], mapping,
        statutory_start=proj.statutory_period_start, statutory_end=proj.statutory_period_end,
    )

    # Keep the raw upload immutably as a Document (audit) — reuse the normal ingest/provenance path.
    source = await get_or_create_uploaded_source(session, proj.engagement_id, SourceKind.financials)
    doc = await store_upload(session, storage, proj.engagement_id, source.id, filename, file.content_type, data)

    imported = skipped = 0
    for d, raw, iss in zip(derived, raws, issues):
        if any(b in iss for b in BLOCKING_ISSUES):   # can't identify the transaction — skip, count, report
            skipped += 1
            continue
        session.add(ControlledTransaction(
            local_file_project_id=proj.id,
            transaction_category=canonical_category(d["transaction_category"]) or d["transaction_category"],
            description=d["description"], associated_enterprise_name=d["associated_enterprise_name"],
            associated_enterprise_country=(
                normalize_country(d["associated_enterprise_country"]) or d["associated_enterprise_country"]
            ),
            direction=d["direction"] if d["direction"] in DIRECTIONS else "payment",
            local_currency=d["local_currency"], local_currency_amount=d["local_currency_amount"],
            group_currency=d["group_currency"], group_currency_amount=d["group_currency_amount"],
            period_start=d["period_start"], period_end=d["period_end"],
            materiality_status=d["materiality_status"], notes=d["notes"],
            source_document_id=doc.id, raw=raw,
        ))
        imported += 1
    await session.commit()

    txns = (await session.execute(
        select(ControlledTransaction).where(ControlledTransaction.local_file_project_id == proj.id)
        .order_by(ControlledTransaction.created_at)
    )).scalars().all()
    return TxnImportResult(
        imported=imported, skipped=skipped, diagnostics=summary,
        transactions=[TransactionRead.model_validate(t) for t in txns],
    )
