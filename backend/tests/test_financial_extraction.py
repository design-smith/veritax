import uuid
from io import BytesIO

from sqlalchemy import select

from app.financial_extraction import (
    extract_general_ledger_document,
    extract_invoice_population_document,
    extract_trial_balance_document,
)
from app.main import app
from app.models import Document, ExtractedFact, ExtractionExpectedField, FactSource


def _xlsx_bytes(rows: list[list[str]], *, sheet_name: str = "Sheet1") -> bytes:
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    for row in rows:
        ws.append(row)
    out = BytesIO()
    wb.save(out)
    return out.getvalue()


async def _financial_doc(client, filename: str, data: bytes, content_type: str) -> tuple[str, Document, bytes]:
    eid = (await client.post("/engagements")).json()["id"]
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={"files": (filename, data, content_type)},
        )
    ).json()[0]
    async with app.state.session_factory() as session:
        doc = await session.get(Document, uuid.UUID(uploaded["id"]))
        assert doc is not None
        return eid, doc, app.state.storage.get(doc.storage_key)


async def test_trial_balance_csv_extracts_row_level_account_amount_and_entity_facts(client):
    data = (
        b"Account Code,Account Name,Debit,Credit,Fiscal Year,Entity,Counterparty\n"
        b"4000,Revenue,0,1200,FY2025,Starbucks Corp,Starbucks Trading BV\n"
    )
    eid, doc, stored = await _financial_doc(client, "trial-balance.csv", data, "text/csv")

    async with app.state.session_factory() as session:
        run = await extract_trial_balance_document(
            session,
            document=doc,
            data=stored,
            classification_type="Trial Balance",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(
                select(ExtractedFact)
                .where(ExtractedFact.extraction_run_id == run.id)
                .order_by(ExtractedFact.fact_type)
            )
        ).scalars().all()
        sources = (
            await session.execute(
                select(FactSource).where(FactSource.fact_id.in_([fact.id for fact in facts]))
            )
        ).scalars().all()
        reloaded_doc = await session.get(Document, doc.id)

    assert run.engagement_id == uuid.UUID(eid)
    assert run.status == "extracted"
    assert reloaded_doc.extraction_status == "extracted"
    assert {fact.fact_type for fact in facts} == {"counterparty_name", "entity_name", "gl_account", "revenue"}
    assert next(fact for fact in facts if fact.fact_type == "revenue").value_normalized == "1200"
    assert next(fact for fact in facts if fact.fact_type == "revenue").period == "FY2025"
    assert {source.locator for source in sources} == {"row 2"}


async def test_trial_balance_xlsx_extracts_sheet_row_provenance(client):
    data = _xlsx_bytes(
        [
            ["Account Code", "Account Name", "Debit", "Credit", "Fiscal Year", "Entity"],
            ["5000", "Marketing expense", "300", "0", "FY2025", "Starbucks Corp"],
        ],
        sheet_name="Trial Balance",
    )
    _, doc, stored = await _financial_doc(
        client,
        "trial-balance.xlsx",
        data,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    async with app.state.session_factory() as session:
        run = await extract_trial_balance_document(
            session,
            document=doc,
            data=stored,
            classification_type="Trial Balance",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.extraction_run_id == run.id))
        ).scalars().all()
        sources = (
            await session.execute(
                select(FactSource).where(FactSource.fact_id.in_([fact.id for fact in facts]))
            )
        ).scalars().all()

    assert run.status == "extracted"
    assert next(fact for fact in facts if fact.fact_type == "expense").value_normalized == "300"
    assert {source.locator for source in sources} == {"Trial Balance!R2"}


async def test_trial_balance_ambiguous_headers_store_partial_diagnostics(client):
    data = b"Column A,Column B\nRevenue,1200\n"
    _, doc, stored = await _financial_doc(client, "trial-balance.csv", data, "text/csv")

    async with app.state.session_factory() as session:
        run = await extract_trial_balance_document(
            session,
            document=doc,
            data=stored,
            classification_type="Trial Balance",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.extraction_run_id == run.id))
        ).scalars().all()
        expected = (
            await session.execute(
                select(ExtractionExpectedField).where(ExtractionExpectedField.extraction_run_id == run.id)
            )
        ).scalars().all()

    assert run.status == "partially_extracted"
    assert run.diagnostics["missing_columns"] == ["account", "amount"]
    assert facts == []
    assert {row.field_name for row in expected if row.status == "missing"} == {"account", "amount"}


async def test_general_ledger_csv_extracts_account_date_amount_and_parties(client):
    data = (
        b"Posting Date,Account Code,Account Name,Amount,Entity,Counterparty\n"
        b"2025-02-01,6100,Service fee,-250,Starbucks Corp,Starbucks Trading BV\n"
    )
    _, doc, stored = await _financial_doc(client, "general-ledger.csv", data, "text/csv")

    async with app.state.session_factory() as session:
        run = await extract_general_ledger_document(
            session,
            document=doc,
            data=stored,
            classification_type="General Ledger",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.extraction_run_id == run.id))
        ).scalars().all()
        sources = (
            await session.execute(
                select(FactSource).where(FactSource.fact_id.in_([fact.id for fact in facts]))
            )
        ).scalars().all()

    assert run.status == "extracted"
    assert {fact.fact_type for fact in facts} == {
        "counterparty_name",
        "entity_name",
        "gl_account",
        "transaction_amount",
        "transaction_date",
    }
    assert next(fact for fact in facts if fact.fact_type == "transaction_amount").value_normalized == "-250"
    assert next(fact for fact in facts if fact.fact_type == "transaction_date").value_raw == "2025-02-01"
    assert {source.locator for source in sources} == {"row 2"}


async def test_invoice_population_xlsx_extracts_invoice_date_amount_and_parties(client):
    data = _xlsx_bytes(
        [
            ["Invoice Number", "Invoice Date", "Amount", "Entity", "Customer"],
            ["INV-100", "2025-03-15", "900", "Starbucks Corp", "Starbucks Trading BV"],
        ],
        sheet_name="Invoices",
    )
    _, doc, stored = await _financial_doc(
        client,
        "invoice-population.xlsx",
        data,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    async with app.state.session_factory() as session:
        run = await extract_invoice_population_document(
            session,
            document=doc,
            data=stored,
            classification_type="Invoice Population",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.extraction_run_id == run.id))
        ).scalars().all()
        sources = (
            await session.execute(
                select(FactSource).where(FactSource.fact_id.in_([fact.id for fact in facts]))
            )
        ).scalars().all()

    assert run.status == "extracted"
    assert {fact.fact_type for fact in facts} == {
        "counterparty_name",
        "entity_name",
        "invoice_amount",
        "invoice_number",
        "transaction_date",
    }
    assert next(fact for fact in facts if fact.fact_type == "invoice_amount").value_normalized == "900"
    assert {source.locator for source in sources} == {"Invoices!R2"}


async def test_general_ledger_missing_columns_store_partial_diagnostics(client):
    data = b"Account Code,Comment\n6100,No values\n"
    _, doc, stored = await _financial_doc(client, "general-ledger.csv", data, "text/csv")

    async with app.state.session_factory() as session:
        run = await extract_general_ledger_document(
            session,
            document=doc,
            data=stored,
            classification_type="General Ledger",
            classification_version="rules-v1",
        )
        await session.commit()

    async with app.state.session_factory() as session:
        facts = (
            await session.execute(select(ExtractedFact).where(ExtractedFact.extraction_run_id == run.id))
        ).scalars().all()
        expected = (
            await session.execute(
                select(ExtractionExpectedField).where(ExtractionExpectedField.extraction_run_id == run.id)
            )
        ).scalars().all()

    assert run.status == "partially_extracted"
    assert run.diagnostics["missing_columns"] == ["date", "amount"]
    assert facts == []
    assert {row.field_name for row in expected if row.status == "missing"} == {"date", "amount"}
