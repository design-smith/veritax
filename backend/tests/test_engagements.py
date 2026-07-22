async def test_create_engagement_returns_id(client):
    r = await client.post("/engagements")
    assert r.status_code == 201
    assert "id" in r.json()


async def test_patch_stores_entity_and_jurisdictions(client):
    eid = (await client.post("/engagements")).json()["id"]

    r = await client.patch(
        f"/engagements/{eid}",
        json={
            "entity_name": "GlobalTech Netherlands BV",
            "jurisdictions": ["Netherlands", "Germany", "Netherlands"],
            "website_url": "https://globaltech.example",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["entity_name"] == "GlobalTech Netherlands BV"
    assert sorted(body["jurisdictions"]) == ["Germany", "Netherlands"]  # de-duped
    assert body["website_url"] == "https://globaltech.example"

    got = (await client.get(f"/engagements/{eid}")).json()
    assert got["entity_name"] == "GlobalTech Netherlands BV"
    assert sorted(got["jurisdictions"]) == ["Germany", "Netherlands"]


async def test_patch_reuses_existing_entity(client):
    e1 = (await client.post("/engagements")).json()["id"]
    e2 = (await client.post("/engagements")).json()["id"]
    await client.patch(f"/engagements/{e1}", json={"entity_name": "Acme SA"})
    await client.patch(f"/engagements/{e2}", json={"entity_name": "Acme SA"})
    # Both resolve to the same entity name; no error, both readable.
    assert (await client.get(f"/engagements/{e1}")).json()["entity_name"] == "Acme SA"
    assert (await client.get(f"/engagements/{e2}")).json()["entity_name"] == "Acme SA"


async def test_get_missing_engagement_404(client):
    r = await client.get("/engagements/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
