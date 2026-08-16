"""S7: org-chart intelligence — key roles + reporting lines as scoped evidence; never proves control (§24-25)."""
import uuid

from sqlalchemy import select

from app.main import app
from app.models import ExtractedFact


async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


async def test_org_chart_ingest_builds_reporting_graph_scoped(client):
    eid = await _engagement(client)
    r = await client.post(f"/engagements/{eid}/org-chart", json={"roles": [
        {"person_name": "Group CFO", "job_title": "Group CFO", "location": "Switzerland", "management_level": "C-suite"},
        {"person_name": "Regional Finance Director", "job_title": "Regional Finance Director",
         "reports_to": "Group CFO", "location": "UAE"},
        {"person_name": "Finance Manager", "job_title": "Finance Manager Qatar",
         "reports_to": "Regional Finance Director", "department": "Finance", "location": "Qatar"},
    ]})
    assert r.status_code == 201
    roles = {role["job_title"]: role for role in r.json()["roles"]}
    assert set(roles) == {"Group CFO", "Regional Finance Director", "Finance Manager Qatar"}
    # Reporting edges resolved: Qatar → Regional → Group CFO; top role reports to no one.
    assert roles["Finance Manager Qatar"]["reports_to_role_id"] == roles["Regional Finance Director"]["id"]
    assert roles["Regional Finance Director"]["reports_to_role_id"] == roles["Group CFO"]["id"]
    assert roles["Group CFO"]["reports_to_role_id"] is None
    assert all(role["scope_level"] == "local_entity" for role in roles.values())   # §47


async def test_org_chart_alone_does_not_establish_functional_facts_or_control(client):
    eid = await _engagement(client)
    await client.post(f"/engagements/{eid}/org-chart", json={"roles": [
        {"person_name": "Treasury Director", "job_title": "Treasury Director", "location": "Switzerland"},
    ]})
    # §25: an org chart is supporting evidence only — it must not emit functional/risk-control facts by itself.
    async with app.state.session_factory() as session:
        facts = (await session.execute(
            select(ExtractedFact).where(ExtractedFact.engagement_id == uuid.UUID(eid)))).scalars().all()
    assert facts == []


async def test_org_chart_graph_is_readable(client):
    eid = await _engagement(client)
    await client.post(f"/engagements/{eid}/org-chart", json={"roles": [{"job_title": "GM", "person_name": "A"}]})
    got = (await client.get(f"/engagements/{eid}/org-chart")).json()
    assert [r["job_title"] for r in got["roles"]] == ["GM"]
