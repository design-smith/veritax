import uuid

from sqlalchemy import select

from app.canonicalization import promote_canonical_facts
from app.extraction_store import ExtractedFactInput, FactSourceInput, RunInput, add_extracted_fact, create_extraction_run
from app.main import app
from app.models import CanonicalFact, CanonicalFactSource, Document, ExtractedFact


async def _engagement(client) -> uuid.UUID:
    return uuid.UUID((await client.post("/engagements")).json()["id"])


async def _document(client, engagement_id: uuid.UUID, filename: str = "services.txt") -> uuid.UUID:
    uploaded = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "agreements"},
            files={"files": (filename, b"Pricing: cost plus five percent markup.", "text/plain")},
        )
    ).json()[0]
    return uuid.UUID(uploaded["id"])


async def _fact(
    engagement_id: uuid.UUID,
    document_id: uuid.UUID,
    *,
    fact_type: str = "markup",
    value_raw: str = "five percent",
    value_normalized: str = "0.05",
    value_type: str = "percentage",
    unit: str | None = "%",
    period: str | None = "FY2025",
    scope_level: str = "transaction",
    resolution_status: str = "not_required",
    run_active: bool = True,
    with_source: bool = True,
) -> uuid.UUID:
    async with app.state.session_factory() as session:
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=engagement_id,
                document_id=document_id,
                schema_key="agreement_core",
                schema_version="2026-08-07",
                classification_type="Service Agreement",
                classification_version="rules-v1",
                runner_version="extractor-v1",
                model_version="fake-model",
                fingerprint=f"fp-{document_id}-{value_normalized}-{fact_type}",
                status="extracted",
                active=run_active,
            ),
        )
        fact = await add_extracted_fact(
            session,
            run.id,
            document_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type=fact_type,
                value_raw=value_raw,
                value_normalized=value_normalized,
                value_type=value_type,
                unit=unit,
                period=period,
                scope_level=scope_level,
                resolution_status=resolution_status,
            ),
            sources=(
                [FactSourceInput(document_id=document_id, locator="line 1", quote="five percent markup")]
                if with_source
                else []
            ),
        )
        await session.commit()
        return fact.id


async def test_promotes_exact_duplicate_facts_to_one_canonical_fact_with_multiple_sources(client):
    engagement_id = await _engagement(client)
    first_doc = await _document(client, engagement_id, "services-a.txt")
    second_doc = await _document(client, engagement_id, "services-b.txt")
    first_fact_id = await _fact(engagement_id, first_doc)
    second_fact_id = await _fact(engagement_id, second_doc)

    async with app.state.session_factory() as session:
        result = await promote_canonical_facts(session, engagement_id)
        await session.commit()

    async with app.state.session_factory() as session:
        canonical_facts = (await session.execute(select(CanonicalFact))).scalars().all()
        links = (await session.execute(select(CanonicalFactSource))).scalars().all()

    assert result.promoted == 1
    assert result.linked == 2
    assert len(canonical_facts) == 1
    assert canonical_facts[0].fact_type == "markup"
    assert canonical_facts[0].value_normalized == "0.05"
    assert {link.extracted_fact_id for link in links} == {first_fact_id, second_fact_id}


async def test_conflicting_values_stay_as_separate_canonical_facts(client):
    engagement_id = await _engagement(client)
    first_doc = await _document(client, engagement_id, "services-a.txt")
    second_doc = await _document(client, engagement_id, "services-b.txt")
    await _fact(engagement_id, first_doc, value_normalized="0.05")
    await _fact(engagement_id, second_doc, value_raw="six percent", value_normalized="0.06")

    async with app.state.session_factory() as session:
        await promote_canonical_facts(session, engagement_id)
        await session.commit()

    async with app.state.session_factory() as session:
        values = {
            row.value_normalized for row in (await session.execute(select(CanonicalFact))).scalars().all()
        }

    assert values == {"0.05", "0.06"}


async def test_unresolved_entity_dependent_fact_does_not_promote(client):
    engagement_id = await _engagement(client)
    document_id = await _document(client, engagement_id)
    await _fact(
        engagement_id,
        document_id,
        fact_type="provider",
        value_raw="ABC Netherlands",
        value_normalized="abc netherlands",
        value_type="entity_ref",
        unit=None,
        period=None,
        scope_level="counterparty",
        resolution_status="unresolved",
    )

    async with app.state.session_factory() as session:
        result = await promote_canonical_facts(session, engagement_id)
        await session.commit()

    async with app.state.session_factory() as session:
        canonical_facts = (await session.execute(select(CanonicalFact))).scalars().all()

    assert result.skipped == 1
    assert canonical_facts == []


async def test_inactive_runs_inactive_documents_and_missing_provenance_do_not_promote(client):
    engagement_id = await _engagement(client)
    inactive_run_doc = await _document(client, engagement_id, "inactive-run.txt")
    inactive_doc = await _document(client, engagement_id, "inactive-doc.txt")
    missing_source_doc = await _document(client, engagement_id, "missing-source.txt")
    await _fact(engagement_id, inactive_run_doc, value_normalized="0.01", run_active=False)
    await _fact(engagement_id, inactive_doc, value_normalized="0.02")
    await _fact(engagement_id, missing_source_doc, value_normalized="0.03", with_source=False)

    async with app.state.session_factory() as session:
        doc = await session.get(Document, inactive_doc)
        doc.is_active = False
        await session.commit()

    async with app.state.session_factory() as session:
        result = await promote_canonical_facts(session, engagement_id)
        await session.commit()

    async with app.state.session_factory() as session:
        canonical_facts = (await session.execute(select(CanonicalFact))).scalars().all()
        extracted_facts = (await session.execute(select(ExtractedFact))).scalars().all()

    assert result.skipped == len(extracted_facts)
    assert canonical_facts == []
