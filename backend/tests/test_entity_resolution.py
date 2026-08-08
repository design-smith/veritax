import uuid

from sqlalchemy import select

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
from app.models import CanonicalEntity, EntityAlias, EntityMention, ExtractedFact


async def _mention(client, raw_name: str, role: str = "provider"):
    eid = (await client.post("/engagements")).json()["id"]
    uploaded = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("services.txt", f"Provider: {raw_name}".encode(), "text/plain")},
        )
    ).json()[0]
    doc_id = uuid.UUID(uploaded["id"])
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
                fingerprint=f"fp-{raw_name}",
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
                value_raw=raw_name,
                value_normalized=raw_name.casefold(),
                value_type="entity_ref",
                scope_level="counterparty",
                resolution_status="unresolved",
            ),
            sources=[FactSourceInput(document_id=doc_id, locator="line 1", quote=f"Provider: {raw_name}")],
        )
        mention = await add_entity_mention(
            session,
            run.id,
            doc_id,
            fact.id,
            EntityMentionInput(raw_name=raw_name, role=role, locator="line 1", quote=f"Provider: {raw_name}"),
        )
        await session.commit()
        return uuid.UUID(eid), mention.id, fact.id


async def test_strong_legal_name_mention_creates_canonical_entity(client):
    eid, mention_id, fact_id = await _mention(client, "ABC Netherlands BV")

    async with app.state.session_factory() as session:
        resolved = await resolve_entity_mention(session, mention_id)
        await session.commit()

    async with app.state.session_factory() as session:
        entity = await session.get(CanonicalEntity, resolved.entity_id)
        mention = await session.get(EntityMention, mention_id)
        fact = await session.get(ExtractedFact, fact_id)

    assert resolved.resolved is True
    assert entity.engagement_id == eid
    assert entity.legal_name == "ABC Netherlands BV"
    assert mention.resolution_status == "resolved"
    assert mention.resolved_entity_id == entity.id
    assert fact.resolution_status == "resolved"


async def test_exact_legal_name_and_existing_alias_resolve(client):
    eid, exact_mention_id, _ = await _mention(client, "ABC BV")

    async with app.state.session_factory() as session:
        exact = await resolve_entity_mention(session, exact_mention_id)
        await add_entity_alias(session, exact.entity_id, "ABC Netherlands")
        await session.commit()

    _, alias_mention_id, _ = await _mention(client, "ABC Netherlands")
    async with app.state.session_factory() as session:
        alias_mention = await session.get(EntityMention, alias_mention_id)
        alias_mention.engagement_id = eid
        alias_mention.raw_name = "ABC Netherlands"
        alias_mention.normalized_name = "abc netherlands"
        alias = await resolve_entity_mention(session, alias_mention_id)
        aliases = (await session.execute(select(EntityAlias))).scalars().all()
        await session.commit()

    assert alias.resolved is True
    assert alias.entity_id == exact.entity_id
    assert {row.normalized_alias for row in aliases} == {"abc netherlands"}


async def test_weak_name_and_llm_suggestion_do_not_create_or_resolve(client):
    eid, mention_id, fact_id = await _mention(client, "ABC Netherlands")
    async with app.state.session_factory() as session:
        suggested = CanonicalEntity(
            engagement_id=eid,
            legal_name="ABC Netherlands BV",
            normalized_name="abc netherlands bv",
        )
        session.add(suggested)
        await session.flush()
        result = await resolve_entity_mention(session, mention_id, suggested_entity_id=suggested.id)
        await session.commit()

    async with app.state.session_factory() as session:
        mention = await session.get(EntityMention, mention_id)
        fact = await session.get(ExtractedFact, fact_id)
        entities = (await session.execute(select(CanonicalEntity))).scalars().all()

    assert result.resolved is False
    assert mention.resolution_status == "unresolved"
    assert mention.resolved_entity_id is None
    assert fact.resolution_status == "unresolved"
    assert len([entity for entity in entities if entity.legal_name == "ABC Netherlands"]) == 0
