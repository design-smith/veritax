from __future__ import annotations

import uuid

from sqlalchemy import select

from app.canonicalization import promote_canonical_facts
from app.entity_resolution import add_entity_alias, resolve_entity_mention
from app.extraction_store import (
    EntityMentionInput,
    ExtractedFactInput,
    FactSourceInput,
    RunInput,
    add_entity_mention,
    add_extracted_fact,
    create_extraction_run,
)
from app.main import app
from app.models import CanonicalFact, ExtractedFact


async def _engagement(client) -> uuid.UUID:
    return uuid.UUID((await client.post("/engagements")).json()["id"])


async def _document(client, engagement_id: uuid.UUID, filename: str = "services.txt") -> uuid.UUID:
    uploaded = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "agreements"},
            files={"files": (filename, b"Provider: ABC Netherlands BV. Pricing: cost plus five percent markup.", "text/plain")},
        )
    ).json()[0]
    return uuid.UUID(uploaded["id"])


async def _markup_fact(engagement_id: uuid.UUID, document_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
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
                fingerprint=f"fp-markup-{document_id}",
                status="extracted",
            ),
        )
        fact = await add_extracted_fact(
            session,
            run.id,
            document_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="markup",
                value_raw="five percent",
                value_normalized="0.05",
                value_type="percentage",
                unit="%",
                period="FY2025",
                scope_level="transaction",
            ),
            sources=[FactSourceInput(document_id=document_id, locator="line 1", quote="five percent markup")],
        )
        await promote_canonical_facts(session, engagement_id)
        canonical = (await session.execute(select(CanonicalFact))).scalars().first()
        await session.commit()
        return fact.id, canonical.id


async def _provider_fact(engagement_id: uuid.UUID, document_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
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
                fingerprint=f"fp-provider-{document_id}",
                status="extracted",
            ),
        )
        fact = await add_extracted_fact(
            session,
            run.id,
            document_id,
            ExtractedFactInput(
                schema_key="agreement_core",
                schema_version="2026-08-07",
                fact_type="provider",
                value_raw="ABC Netherlands BV",
                value_normalized="abc netherlands bv",
                value_type="entity_ref",
                scope_level="counterparty",
                resolution_status="unresolved",
            ),
            sources=[FactSourceInput(document_id=document_id, locator="line 1", quote="Provider: ABC Netherlands BV")],
        )
        mention = await add_entity_mention(
            session,
            run.id,
            document_id,
            fact.id,
            EntityMentionInput(
                raw_name="ABC Netherlands BV",
                role="provider",
                locator="line 1",
                quote="Provider: ABC Netherlands BV",
            ),
        )
        resolved = await resolve_entity_mention(session, mention.id)
        await add_entity_alias(session, resolved.entity_id, "ABC Netherlands")
        await session.commit()
        return fact.id, resolved.entity_id


async def test_document_facts_return_active_extracted_rows_with_canonical_links(client):
    engagement_id = await _engagement(client)
    document_id = await _document(client, engagement_id)
    fact_id, _ = await _markup_fact(engagement_id, document_id)

    response = await client.get(f"/documents/{document_id}/facts")

    assert response.status_code == 200
    payload = response.json()
    assert payload["document_id"] == str(document_id)
    assert len(payload["facts"]) == 1
    row = payload["facts"][0]
    assert row["id"] == str(fact_id)
    assert row["fact_type"] == "markup"
    assert row["value_raw"] == "five percent"
    assert row["value_normalized"] == "0.05"
    assert row["canonical_fact_id"] is not None
    assert row["sources"][0]["locator"] == "line 1"
    assert "diagnostics" not in row
    assert "schema_key" not in row


async def test_fact_detail_returns_entity_resolution_and_source_provenance(client):
    engagement_id = await _engagement(client)
    document_id = await _document(client, engagement_id)
    fact_id, entity_id = await _provider_fact(engagement_id, document_id)

    response = await client.get(f"/facts/{fact_id}")

    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == str(fact_id)
    assert detail["fact_type"] == "provider"
    assert detail["scope_level"] == "counterparty"
    assert detail["entity_mention"]["raw_name"] == "ABC Netherlands BV"
    assert detail["entity_mention"]["resolution_status"] == "resolved"
    assert detail["entity_mention"]["canonical_entity_id"] == str(entity_id)
    assert detail["sources"] == [
        {
            "document_id": str(document_id),
            "page": None,
            "locator": "line 1",
            "quote": "Provider: ABC Netherlands BV",
        }
    ]
    assert "diagnostics" not in detail


async def test_entities_api_returns_engagement_scoped_entities_and_aliases(client):
    engagement_id = await _engagement(client)
    document_id = await _document(client, engagement_id)
    _, entity_id = await _provider_fact(engagement_id, document_id)

    listed = await client.get("/entities", params={"engagement_id": str(engagement_id)})
    detail = await client.get(f"/entities/{entity_id}")

    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()] == [str(entity_id)]
    assert listed.json()[0]["aliases"] == ["ABC Netherlands"]
    assert detail.status_code == 200
    assert detail.json()["legal_name"] == "ABC Netherlands BV"
    assert detail.json()["aliases"] == ["ABC Netherlands"]
    assert "normalized_name" not in detail.json()


async def test_tombstoned_document_facts_are_hidden_from_active_reads(client):
    engagement_id = await _engagement(client)
    document_id = await _document(client, engagement_id)
    fact_id, _ = await _markup_fact(engagement_id, document_id)

    assert (await client.delete(f"/documents/{document_id}")).status_code == 204

    assert (await client.get(f"/documents/{document_id}/facts")).status_code == 404
    assert (await client.get(f"/facts/{fact_id}")).status_code == 404

    async with app.state.session_factory() as session:
        facts = (await session.execute(select(ExtractedFact))).scalars().all()
    assert len(facts) == 1
