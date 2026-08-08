import uuid

from sqlalchemy import select

from app.extraction_store import (
    EntityMentionInput,
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_entity_mention,
    add_extracted_fact,
    create_extraction_run,
    extracted_fact_promotable,
)
from app.main import app
from app.models import Document, EntityMention, ExtractedFact


async def _document(client) -> tuple[str, str]:
    eid = (await client.post("/engagements")).json()["id"]
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", b"Provider: ABC Switzerland AG", "text/plain")},
        )
    ).json()[0]
    return eid, doc["id"]


async def test_unresolved_entity_mention_links_to_fact_without_rejecting_it(client):
    eid, document_id = await _document(client)
    doc_id = uuid.UUID(document_id)

    async with app.state.session_factory() as session:
        run = await create_extraction_run(
            session,
            RunInput(
                engagement_id=uuid.UUID(eid),
                document_id=doc_id,
                schema_key="agreement_core",
                schema_version="2026-08-07",
                classification_type="Service Agreement",
                classification_version="rules-v1",
                runner_version="extractor-v1",
                model_version="fake-model",
                fingerprint="fp-entity-mention",
                status="partially_extracted",
            ),
        )
        fact = await add_extracted_fact(
            session,
            run.id,
            doc_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="provider",
                value_raw="ABC Switzerland AG",
                value_normalized="abc switzerland ag",
                value_type="entity_ref",
                scope_level="counterparty",
                resolution_status="unresolved",
            ),
            sources=[
                FactSourceInput(
                    document_id=doc_id,
                    locator="line 1",
                    quote="Provider: ABC Switzerland AG",
                )
            ],
        )
        mention = await add_entity_mention(
            session,
            run.id,
            doc_id,
            fact.id,
            EntityMentionInput(
                raw_name="ABC Switzerland AG",
                role="provider",
                locator="line 1",
                quote="Provider: ABC Switzerland AG",
            ),
        )
        await session.commit()

    async with app.state.session_factory() as session:
        stored_fact = await session.get(ExtractedFact, fact.id)
        stored_mention = await session.get(EntityMention, mention.id)
        all_facts = (await session.execute(select(ExtractedFact))).scalars().all()

    assert len(all_facts) == 1
    assert stored_fact.entity_mention_id == mention.id
    assert stored_fact.resolution_status == "unresolved"
    assert stored_mention.engagement_id == uuid.UUID(eid)
    assert stored_mention.document_id == doc_id
    assert stored_mention.extraction_run_id == run.id
    assert stored_mention.extracted_fact_id == fact.id
    assert stored_mention.raw_name == "ABC Switzerland AG"
    assert stored_mention.normalized_name == "abc switzerland ag"
    assert stored_mention.resolution_status == "unresolved"
    assert extracted_fact_promotable(stored_fact) is False
