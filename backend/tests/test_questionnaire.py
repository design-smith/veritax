"""S6: TP questionnaire answers enter the SAME functional evidence model as interviews (§21-22, no silo)."""
from sqlalchemy import select

from app.main import app
from app.models import CanonicalFact, ExtractedFact


async def test_questionnaire_answers_enter_the_same_functional_model(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.post(f"/engagements/{eid}/questionnaire", json={
        "transaction_ids": ["txn_1"],
        "items": [
            {"question": "Who manages customer relationships?",
             "answer": "The local sales team manages all customer negotiations."},
            {"question": "Who controls FX exposure?",
             "answer": "Swiss Treasury executes all currency hedges."},
        ]})
    assert r.status_code == 200 and r.json()["facts_created"] >= 2

    async with app.state.session_factory() as session:
        efs = (await session.execute(select(ExtractedFact))).scalars().all()
        cfs = (await session.execute(select(CanonicalFact))).scalars().all()
    # Same model as interviews — functional schema, questionnaire evidence_type, interview-style provenance.
    assert efs and all(e.schema_key == "functional" and e.evidence_type == "questionnaire" for e in efs)
    assert all(e.document_id is None and e.interview_response_id is not None for e in efs)
    assert {c.far_type for c in cfs} >= {"sales", "foreign_exchange_risk"}
