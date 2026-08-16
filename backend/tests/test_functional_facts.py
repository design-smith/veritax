"""S2: functional assertions ride the existing ExtractedFact→CanonicalFact pipeline (reuse decision).

far_type/transaction_id distinguish otherwise-identical functional facts; an unknown far_type is not promoted
(§46). Existing non-functional facts are unaffected (covered by test_canonical_facts + the full suite)."""
import uuid

from sqlalchemy import select

from app.canonicalization import promote_canonical_facts
from app.extraction_store import ExtractedFactInput, FactSourceInput, RunInput, add_extracted_fact, create_extraction_run
from app.main import app
from app.models import CanonicalFact


async def _engagement(client) -> uuid.UUID:
    return uuid.UUID((await client.post("/engagements")).json()["id"])


async def _doc(client, engagement_id: uuid.UUID, name: str) -> uuid.UUID:
    up = (
        await client.post(
            f"/engagements/{engagement_id}/documents",
            data={"kind": "interview"},
            files={"files": (name, b"The local sales team manages all customer negotiations.", "text/plain")},
        )
    ).json()[0]
    return uuid.UUID(up["id"])


async def _functional_fact(engagement_id, document_id, *, fact_type="function_performed", far_type="sales",
                           transaction_id="txn_1", value_normalized="true", evidence_type="functional_interview",
                           scope_level="local_entity", with_source=True) -> uuid.UUID:
    async with app.state.session_factory() as session:
        run = await create_extraction_run(session, RunInput(
            engagement_id=engagement_id, document_id=document_id, schema_key="functional",
            schema_version="2026-08-16", classification_type="Functional Interview",
            classification_version="rules-v1", runner_version="extractor-v1", model_version="fake-model",
            fingerprint=f"fp-{document_id}", status="extracted", active=True))  # unique per doc, < varchar(64)
        fact = await add_extracted_fact(session, run.id, document_id, ExtractedFactInput(
            schema_key="functional", schema_version="2026-08-16", fact_type=fact_type, value_raw="yes",
            value_normalized=value_normalized, value_type="boolean", scope_level=scope_level,
            far_type=far_type, transaction_id=transaction_id, evidence_type=evidence_type),
            sources=([FactSourceInput(document_id=document_id, locator="Q14",
                                      quote="The local sales team manages all customer negotiations.")]
                     if with_source else []))
        await session.commit()
        return fact.id


async def test_functional_fact_promotes_with_far_dimensions_and_provenance(client):
    engagement_id = await _engagement(client)
    doc = await _doc(client, engagement_id, "interview.txt")
    await _functional_fact(engagement_id, doc)
    async with app.state.session_factory() as session:
        result = await promote_canonical_facts(session, engagement_id)
        await session.commit()
    async with app.state.session_factory() as session:
        rows = (await session.execute(select(CanonicalFact))).scalars().all()
    assert result.promoted == 1 and result.linked == 1 and len(rows) == 1
    c = rows[0]
    assert c.fact_type == "function_performed" and c.far_type == "sales"
    assert c.transaction_id == "txn_1" and c.evidence_type == "functional_interview" and c.value_normalized == "true"


async def test_far_type_and_transaction_distinguish_canonical_facts(client):
    engagement_id = await _engagement(client)
    a = await _doc(client, engagement_id, "a.txt")
    b = await _doc(client, engagement_id, "b.txt")
    d = await _doc(client, engagement_id, "d.txt")
    await _functional_fact(engagement_id, a, far_type="sales", transaction_id="txn_1")
    await _functional_fact(engagement_id, b, far_type="marketing", transaction_id="txn_1")   # different function
    await _functional_fact(engagement_id, d, far_type="sales", transaction_id="txn_2")        # different transaction
    async with app.state.session_factory() as session:
        await promote_canonical_facts(session, engagement_id)
        await session.commit()
    async with app.state.session_factory() as session:
        rows = (await session.execute(select(CanonicalFact))).scalars().all()
    # Not merged into one — each (far_type, transaction) is its own canonical fact.
    assert {(r.far_type, r.transaction_id) for r in rows} == {("sales", "txn_1"), ("marketing", "txn_1"), ("sales", "txn_2")}


async def test_invalid_far_type_is_not_promoted(client):
    engagement_id = await _engagement(client)
    doc = await _doc(client, engagement_id, "interview.txt")
    await _functional_fact(engagement_id, doc, far_type="teleportation")   # not in the FAR ontology (§46)
    async with app.state.session_factory() as session:
        result = await promote_canonical_facts(session, engagement_id)
        await session.commit()
    async with app.state.session_factory() as session:
        rows = (await session.execute(select(CanonicalFact))).scalars().all()
    assert result.skipped == 1 and rows == []
