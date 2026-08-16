"""S10: risk control & capability — the six roles per risk + deterministic mismatch status (§12, §40)."""
from app.risk_control import compute_status


def test_status_is_deterministic():
    assert compute_status("NL", "CH", "CH") == "potential_mismatch"   # bearer diverges from control/capability
    assert compute_status("NL", "NL", "NL") == "aligned"
    assert compute_status("NL", None, None) == "undetermined"         # control + capability unknown
    assert compute_status(None, "CH", "CH") == "undetermined"         # bearer unknown
    assert compute_status("NL", "NL", "CH") == "potential_mismatch"   # capability diverges


async def test_risk_control_table_captures_six_roles_and_status(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "foreign_exchange_risk",
         "contractual_bearer_entity_id": "entity_NL", "exposed_entity_id": "entity_NL",
         "decision_maker_entity_id": "entity_CH", "control_entity_id": "entity_CH",
         "capability_entity_id": "entity_CH", "financial_capacity_entity_id": "entity_NL"},
        {"transaction_id": "txn_1", "risk_type": "credit_risk",
         "contractual_bearer_entity_id": "entity_QA", "control_entity_id": "entity_QA",
         "capability_entity_id": "entity_QA"},
    ]})
    assert r.status_code == 201
    by_risk = {row["risk_type"]: row for row in r.json()["risks"]}
    # FX: bearer NL but control/capability CH → potential_mismatch (§12); all six roles preserved.
    fx = by_risk["foreign_exchange_risk"]
    assert fx["status"] == "potential_mismatch"
    assert fx["contractual_bearer_entity_id"] == "entity_NL" and fx["control_entity_id"] == "entity_CH"
    assert fx["financial_capacity_entity_id"] == "entity_NL"
    # Credit: bearer == control == capability → aligned.
    assert by_risk["credit_risk"]["status"] == "aligned"

    # Re-post upserts (not duplicated) and recomputes status.
    r2 = await client.post(f"/engagements/{eid}/risk-control", json={"items": [
        {"transaction_id": "txn_1", "risk_type": "credit_risk",
         "contractual_bearer_entity_id": "entity_QA", "control_entity_id": "entity_CH"}]})
    creds = [row for row in r2.json()["risks"] if row["risk_type"] == "credit_risk"]
    assert len(creds) == 1 and creds[0]["status"] == "potential_mismatch"   # updated, conflict preserved (§32)
