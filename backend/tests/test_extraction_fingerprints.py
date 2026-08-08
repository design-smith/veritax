import uuid

from sqlalchemy import select

from app.extraction_store import (
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_extracted_fact,
    extraction_fingerprint,
    get_or_create_extraction_run,
)
from app.main import app
from app.models import ExtractedFact, ExtractionRun


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


def test_extraction_fingerprint_excludes_general_engagement_scope_by_default():
    base = extraction_fingerprint(
        document_hash="abc",
        classification_type="Service Agreement",
        classification_version="rules-v1",
        schema_version="2026-08-07",
        runner_version="extractor-v1",
        model_version="fake-model",
        scope_values={"jurisdiction": "Netherlands", "fiscal_year": "FY2025"},
    )
    changed_scope = extraction_fingerprint(
        document_hash="abc",
        classification_type="Service Agreement",
        classification_version="rules-v1",
        schema_version="2026-08-07",
        runner_version="extractor-v1",
        model_version="fake-model",
        scope_values={"jurisdiction": "Germany", "fiscal_year": "FY2024"},
    )
    changed_model = extraction_fingerprint(
        document_hash="abc",
        classification_type="Service Agreement",
        classification_version="rules-v1",
        schema_version="2026-08-07",
        runner_version="extractor-v1",
        model_version="better-model",
    )

    assert base == changed_scope
    assert base != changed_model


async def test_matching_completed_extraction_run_is_reused(client):
    eid, document_id = await _document(client)
    payload = RunInput(
        engagement_id=uuid.UUID(eid),
        document_id=uuid.UUID(document_id),
        schema_key="agreement_core",
        schema_version="2026-08-07",
        classification_type="Service Agreement",
        classification_version="rules-v1",
        runner_version="extractor-v1",
        model_version="fake-model",
        fingerprint="fp-reuse",
        status="extracted",
    )

    async with app.state.session_factory() as session:
        first = await get_or_create_extraction_run(session, payload)
        second = await get_or_create_extraction_run(session, payload)
        await session.commit()

    assert first.reused is False
    assert second.reused is True
    assert first.run.id == second.run.id


async def test_changed_fingerprint_supersedes_old_run_without_deleting_old_facts(client):
    eid, document_id = await _document(client)
    doc_id = uuid.UUID(document_id)
    first_payload = RunInput(
        engagement_id=uuid.UUID(eid),
        document_id=doc_id,
        schema_key="agreement_core",
        schema_version="2026-08-07",
        classification_type="Service Agreement",
        classification_version="rules-v1",
        runner_version="extractor-v1",
        model_version="fake-model",
        fingerprint="fp-old",
        status="extracted",
    )
    second_payload = first_payload.model_copy(update={"fingerprint": "fp-new", "model_version": "better-model"})

    async with app.state.session_factory() as session:
        first = await get_or_create_extraction_run(session, first_payload)
        await add_extracted_fact(
            session,
            first.run.id,
            doc_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="markup",
                value_raw="5 percent",
                value_normalized="0.05",
                value_type="percentage",
                unit="%",
                scope_level="transaction",
            ),
            sources=[FactSourceInput(document_id=doc_id, page=1, locator="page 1", quote="markup 5 percent")],
        )
        second = await get_or_create_extraction_run(session, second_payload)
        await session.commit()

    async with app.state.session_factory() as session:
        runs = (await session.execute(select(ExtractionRun).order_by(ExtractionRun.created_at))).scalars().all()
        facts = (await session.execute(select(ExtractedFact))).scalars().all()

    assert second.reused is False
    assert len(runs) == 2
    assert runs[0].active is False
    assert runs[0].superseded_at is not None
    assert runs[1].active is True
    assert len(facts) == 1
    assert facts[0].extraction_run_id == runs[0].id
