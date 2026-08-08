import uuid

from sqlalchemy import select

from app.extraction_store import (
    ExpectedFieldInput,
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_expected_field,
    add_extracted_fact,
    create_extraction_run,
    load_extraction_run,
)
from app.main import app
from app.models import Document, ExtractedFact, ExtractionExpectedField, ExtractionRun, FactSource


async def _document(client) -> tuple[str, str]:
    eid = (await client.post("/engagements")).json()["id"]
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Services agreement markup 5 percent", "text/plain")},
        )
    ).json()[0]
    return eid, doc["id"]


async def test_store_extraction_run_fact_and_source(client):
    eid, document_id = await _document(client)

    async with app.state.session_factory() as session:
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=uuid.UUID(eid),
                document_id=uuid.UUID(document_id),
                schema_key="agreement_core",
                schema_version="2026-08-07",
                classification_type="Service Agreement",
                classification_version="rules-v1",
                runner_version="extractor-v1",
                model_version="fake-model",
                fingerprint="fp1",
                status="extracted",
                diagnostics={"field_count": 1},
            ),
        )
        fact = await add_extracted_fact(
            session,
            run.id,
            uuid.UUID(document_id),
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="markup",
                value_raw="5 percent",
                value_normalized="0.05",
                value_type="percentage",
                unit="%",
                period="FY2025",
                scope_level="transaction",
                resolution_status="not_required",
            ),
            sources=[
                FactSourceInput(
                    document_id=uuid.UUID(document_id),
                    page=1,
                    locator="page 1",
                    quote="markup 5 percent",
                )
            ],
        )
        await session.commit()

    async with app.state.session_factory() as session:
        loaded = await load_extraction_run(session, run.id)
        stored_fact = await session.get(ExtractedFact, fact.id)
        sources = (await session.execute(select(FactSource))).scalars().all()
        doc = await session.get(Document, uuid.UUID(document_id))

    assert loaded is not None
    assert loaded.active is True
    assert loaded.status == "extracted"
    assert loaded.diagnostics == {"field_count": 1}
    assert stored_fact.document_id == uuid.UUID(document_id)
    assert stored_fact.extraction_run_id == run.id
    assert stored_fact.value_raw == "5 percent"
    assert sources[0].fact_id == fact.id
    assert sources[0].locator == "page 1"
    assert sources[0].quote == "markup 5 percent"
    assert doc.extraction_status == "extracted"


async def test_extraction_facts_have_no_independent_active_flag(client):
    assert "active" in ExtractionRun.__table__.columns
    assert "active" not in ExtractedFact.__table__.columns


async def test_store_expected_field_diagnostics(client):
    eid, document_id = await _document(client)

    async with app.state.session_factory() as session:
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=uuid.UUID(eid),
                document_id=uuid.UUID(document_id),
                schema_key="agreement_core",
                schema_version="2026-08-07",
                classification_type="Service Agreement",
                classification_version="rules-v1",
                runner_version="extractor-v1",
                model_version="fake-model",
                fingerprint="fp2",
                status="partially_extracted",
            ),
        )
        await add_expected_field(
            session,
            run.id,
            ExpectedFieldInput(field_name="pricing_method", status="missing", reason="No pricing clause found."),
        )
        await session.commit()

    async with app.state.session_factory() as session:
        rows = (await session.execute(select(ExtractionExpectedField))).scalars().all()
        doc = await session.get(Document, uuid.UUID(document_id))

    assert rows[0].extraction_run_id == run.id
    assert rows[0].field_name == "pricing_method"
    assert rows[0].status == "missing"
    assert rows[0].reason == "No pricing clause found."
    assert doc.extraction_status == "partially_extracted"
