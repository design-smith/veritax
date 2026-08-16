"""S13: deterministic functional risk findings — the FAR profile + risk-control rows decide, each finding names
its functional basis; nothing is emitted where the evidence doesn't support it (§41/§46)."""
import uuid

from app.functional_risks import functional_findings
from app.main import app
from app.models import CanonicalFact


async def _seed_functional_fact(session, engagement_id, fact_type, far_type):
    session.add(CanonicalFact(
        engagement_id=engagement_id, fact_type=fact_type, value_normalized="true", value_type="boolean",
        scope_level="local_entity", far_type=far_type, transaction_id="txn_1",
        evidence_type="functional_interview", canonical_key=f"k-{fact_type}-{far_type}-{uuid.uuid4().hex[:8]}"))


async def test_contract_vs_conduct_mismatch_names_its_basis(client):
    eid = (await client.post("/engagements")).json()["id"]
    # Bearer A, but control sits with B → potential_mismatch.
    await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "foreign_exchange_risk", "contractual_bearer_entity_id": "A",
         "control_entity_id": "B", "capability_entity_id": "B"}]})
    async with app.state.session_factory() as session:
        findings = await functional_findings(session, uuid.UUID(eid), "Netherlands")

    mismatch = next(f for f in findings if f.title.startswith("Contract-vs-conduct mismatch"))
    assert mismatch.kind == "discrepancy" and mismatch.severity == "high" and mismatch.confidence == "high"
    assert "foreign exchange risk" in mismatch.title
    assert mismatch.evidence[0].reference.startswith("risk_control_profiles[foreign_exchange_risk")  # names its basis
    assert "control sits with B" in mismatch.description


async def test_capability_gap_when_capability_unevidenced(client):
    eid = (await client.post("/engagements")).json()["id"]
    # Bearer A, control A (so status is 'aligned'), capability never evidenced → an 'aligned' row still hides a gap.
    await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "credit_risk", "contractual_bearer_entity_id": "A",
         "control_entity_id": "A"}]})
    async with app.state.session_factory() as session:
        findings = await functional_findings(session, uuid.UUID(eid), "Netherlands")

    gap = next(f for f in findings if f.title.startswith("Capability not evidenced"))
    assert gap.kind == "exposure" and gap.exposure_label == "Capability gap"
    assert "credit risk" in gap.title
    # An aligned row is not a mismatch.
    assert not any(f.title.startswith("Contract-vs-conduct mismatch") for f in findings)


async def test_unsupported_risk_allocation_from_assumed_fact(client):
    eid = (await client.post("/engagements")).json()["id"]
    async with app.state.session_factory() as session:
        await _seed_functional_fact(session, uuid.UUID(eid), "risk_assumed", "market_risk")
        await session.commit()
        findings = await functional_findings(session, uuid.UUID(eid), "Netherlands")

    unsupported = next(f for f in findings if f.title.startswith("Unsupported risk allocation"))
    assert unsupported.kind == "exposure" and "market risk" in unsupported.title
    assert unsupported.evidence[0].reference == "canonical_fact[risk_assumed:market_risk]"


async def test_no_finding_is_fabricated_without_evidence(client):
    # With no functional evidence at all, the ONLY finding is that the analysis is incomplete — no invented risks.
    eid = (await client.post("/engagements")).json()["id"]
    async with app.state.session_factory() as session:
        findings = await functional_findings(session, uuid.UUID(eid), "Netherlands")

    assert len(findings) == 1
    assert findings[0].title == "Functional analysis is incomplete"
    assert findings[0].severity == "low"          # unknown (not partial) → low
    assert findings[0].confidence == "high"


async def test_resolved_risk_control_yields_no_conduct_findings(client):
    # Bearer == control == capability → aligned with capability evidenced: no mismatch, no gap, and (with the
    # risk assumed + resolved) no unsupported-allocation or incomplete-analysis finding.
    eid = (await client.post("/engagements")).json()["id"]
    async with app.state.session_factory() as session:
        await _seed_functional_fact(session, uuid.UUID(eid), "function_performed", "distribution")
        await _seed_functional_fact(session, uuid.UUID(eid), "risk_assumed", "foreign_exchange_risk")
        await session.commit()
    await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "foreign_exchange_risk", "contractual_bearer_entity_id": "A",
         "control_entity_id": "A", "capability_entity_id": "A"}]})
    async with app.state.session_factory() as session:
        findings = await functional_findings(session, uuid.UUID(eid), "Netherlands")

    assert findings == []
