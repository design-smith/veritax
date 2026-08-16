"""S5: interview responses → §46-validated functional facts on the shared pipeline (interview provenance)."""
from sqlalchemy import select

from app.interview_extraction import FunctionalCandidate
from app.main import app
from app.models import CanonicalFact, ExtractedFact


async def _interview_with_response(client, response_text, *, role="treasury", txn_types=("financing",)):
    eid = (await client.post("/engagements")).json()["id"]
    created = (await client.post(f"/engagements/{eid}/interviews", json={
        "participant_name": "P", "participant_role": role, "transaction_types": list(txn_types),
        "transaction_ids": ["txn_1"]})).json()
    q = created["questions"][0]
    await client.post(f"/interviews/{created['id']}/responses", json={"question_id": q["id"], "response_raw": response_text})
    return eid, created["id"]


async def test_interview_extraction_creates_provenance_linked_functional_facts(client):
    _eid, iid = await _interview_with_response(client, "Swiss Treasury executes all currency hedges.")
    r = await client.post(f"/interviews/{iid}/extract")
    assert r.status_code == 200 and r.json()["facts_created"] >= 1

    async with app.state.session_factory() as session:
        cfs = (await session.execute(select(CanonicalFact))).scalars().all()
        efs = (await session.execute(select(ExtractedFact))).scalars().all()
    # A functional canonical fact was promoted from the interview response.
    assert any(c.fact_type == "risk_controlled" and c.far_type == "foreign_exchange_risk" for c in cfs)
    # The extracted fact carries interview provenance, not a document (Option A).
    ef = next(e for e in efs if e.far_type == "foreign_exchange_risk")
    assert ef.document_id is None and ef.interview_response_id is not None
    assert ef.evidence_type == "functional_interview" and ef.transaction_id == "txn_1"
    assert ef.sources[0].quote.startswith("Swiss Treasury")   # response text preserved as the quote (§19)


async def test_ungrounded_far_type_is_not_promoted(client):
    class _BogusExtractor:
        def extract(self, question_text: str, response_text: str):
            return [FunctionalCandidate("function_performed", "teleportation", True)]   # not in the ontology

    previous = app.state.interview_extractor
    app.state.interview_extractor = _BogusExtractor()
    try:
        _eid, iid = await _interview_with_response(client, "some answer")
        r = await client.post(f"/interviews/{iid}/extract")
        assert r.json()["facts_created"] == 0   # §46 gate rejects the unsupported far_type
        async with app.state.session_factory() as session:
            assert (await session.execute(select(CanonicalFact))).scalars().all() == []
    finally:
        app.state.interview_extractor = previous
