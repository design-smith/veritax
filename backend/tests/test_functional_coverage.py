"""S11: Requirements evaluates functional-analysis sufficiency (deterministic; §34/§54)."""
import uuid

from sqlalchemy import select

from app.functional_coverage import functional_analysis_summary
from app.main import app
from app.models import CanonicalFact


async def _seed_functional_fact(session, engagement_id, fact_type, far_type):
    session.add(CanonicalFact(
        engagement_id=engagement_id, fact_type=fact_type, value_normalized="true", value_type="boolean",
        scope_level="local_entity", far_type=far_type, transaction_id="txn_1",
        evidence_type="functional_interview", canonical_key=f"k-{fact_type}-{far_type}-{uuid.uuid4().hex[:8]}"))


async def test_unknown_when_no_functional_evidence(client):
    eid = uuid.UUID((await client.post("/engagements")).json()["id"])
    async with app.state.session_factory() as session:
        summary = await functional_analysis_summary(session, eid)
    assert summary["status"] == "unknown" and summary["gaps"]


async def test_partial_when_risk_control_unresolved(client):
    eid = uuid.UUID((await client.post("/engagements")).json()["id"])
    async with app.state.session_factory() as session:
        await _seed_functional_fact(session, eid, "function_performed", "distribution")
        await _seed_functional_fact(session, eid, "risk_assumed", "foreign_exchange_risk")  # assumed, no control row
        await session.commit()
        summary = await functional_analysis_summary(session, eid)
    assert summary["status"] == "partial"
    assert "foreign_exchange_risk" in summary["risk_control"]["unresolved"]
    assert any("foreign exchange risk" in g for g in summary["gaps"])   # §34 specific gap


async def test_present_when_risk_control_resolved_and_surfaced_on_coverage(client):
    eid_s = (await client.post("/engagements")).json()["id"]
    eid = uuid.UUID(eid_s)
    async with app.state.session_factory() as session:
        await _seed_functional_fact(session, eid, "function_performed", "distribution")
        await _seed_functional_fact(session, eid, "risk_assumed", "foreign_exchange_risk")
        await session.commit()
    # Resolve the risk control (bearer == control == capability → aligned).
    await client.post(f"/engagements/{eid_s}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "foreign_exchange_risk", "contractual_bearer_entity_id": "QA",
         "control_entity_id": "QA", "capability_entity_id": "QA"}]})
    async with app.state.session_factory() as session:
        summary = await functional_analysis_summary(session, eid)
    assert summary["status"] == "present" and not summary["gaps"]

    # And it rides the coverage response (Requirements view consumes it).
    got = (await client.get(f"/engagements/{eid_s}/coverage", params={"jurisdiction": "Qatar"})).json()
    assert got["functional_analysis"]["status"] == "present"
