"""S9: FAR builder — deterministic aggregation + characterization (§28-31)."""
import uuid

from app.far_builder import build_far_profile, derive_characterization
from app.main import app
from app.models import CanonicalFact


def _profile(functions=(), assets=(), risks_assumed=(), risks_controlled=(), capabilities=()):
    def rows(xs):
        return [{"far_type": x, "evidence_types": ["functional_interview"], "support": ["x"]} for x in xs]
    return {"functions": rows(functions), "assets": rows(assets), "risks_assumed": rows(risks_assumed),
            "risks_controlled": rows(risks_controlled), "capabilities": rows(capabilities), "evidence_types": []}


def test_characterization_is_deterministic_including_undetermined():
    assert derive_characterization(_profile()) == "undetermined"                                  # empty
    assert derive_characterization(_profile(functions=["distribution"])) == "limited_risk_distributor"
    assert derive_characterization(_profile(functions=["distribution"], risks_assumed=["market_risk"])) == "full_fledged_distributor"
    assert derive_characterization(_profile(functions=["service_delivery"])) == "routine_service_provider"
    assert derive_characterization(_profile(functions=["manufacturing"])) == "contract_manufacturer"
    assert derive_characterization(_profile(functions=["manufacturing"], risks_assumed=["capacity_risk"])) == "full_fledged_manufacturer"
    assert derive_characterization(_profile(functions=["research"])) == "ip_owner"
    assert derive_characterization(_profile(assets=["patents"])) == "ip_owner"
    assert derive_characterization(_profile(functions=["fx_management"])) == "financing_entity"


async def _canonical_functional_fact(session, engagement_id, fact_type, far_type, *, transaction_id="txn_1"):
    session.add(CanonicalFact(
        engagement_id=engagement_id, fact_type=fact_type, value_normalized="true", value_type="boolean",
        scope_level="local_entity", far_type=far_type, transaction_id=transaction_id,
        evidence_type="functional_interview", canonical_key=f"k-{fact_type}-{far_type}-{uuid.uuid4().hex[:8]}"))


async def test_build_far_profile_aggregates_traceable_and_endpoint(client):
    eid = uuid.UUID((await client.post("/engagements")).json()["id"])
    async with app.state.session_factory() as session:
        await _canonical_functional_fact(session, eid, "function_performed", "distribution")
        await _canonical_functional_fact(session, eid, "function_performed", "distribution")   # dup → one entry, 2 support
        await _canonical_functional_fact(session, eid, "risk_assumed", "credit_risk")
        await session.commit()

    async with app.state.session_factory() as session:
        profile = await build_far_profile(session, eid, transaction_id="txn_1")
    functions = profile["functions"]
    assert [f["far_type"] for f in functions] == ["distribution"] and len(functions[0]["support"]) == 2   # deduped + traceable
    assert [r["far_type"] for r in profile["risks_assumed"]] == ["credit_risk"]

    # Endpoint returns profile + deterministic characterization (distribution, no market/inventory risk → LRD).
    got = (await client.get(f"/engagements/{eid}/far", params={"transaction_id": "txn_1"})).json()
    assert got["characterization"] == "limited_risk_distributor"
    assert [f["far_type"] for f in got["profile"]["functions"]] == ["distribution"]
