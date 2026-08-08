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
            "fiscal_year": "FY2025",
            "website_url": "https://globaltech.example",
            "selected_source_kinds": ["public", "interview"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["entity_name"] == "GlobalTech Netherlands BV"
    assert sorted(body["jurisdictions"]) == ["Germany", "Netherlands"]  # de-duped
    assert body["fiscal_year"] == "FY2025"
    assert body["website_url"] == "https://globaltech.example"
    assert body["selected_source_kinds"] == ["public", "interview"]

    got = (await client.get(f"/engagements/{eid}")).json()
    assert got["entity_name"] == "GlobalTech Netherlands BV"
    assert sorted(got["jurisdictions"]) == ["Germany", "Netherlands"]
    assert got["fiscal_year"] == "FY2025"
    assert got["website_url"] == "https://globaltech.example"
    assert got["selected_source_kinds"] == ["public", "interview"]


async def test_engagement_read_hydrates_selected_sources_from_saved_sources(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/sources",
        json={"kind": "interview", "origin": "connected", "connector_provider": "fireflies"},
    )

    got = (await client.get(f"/engagements/{eid}")).json()
    assert got["selected_source_kinds"] == ["interview"]
    assert got["sources"][0]["kind"] == "interview"
    assert got["sources"][0]["connector_provider"] == "fireflies"


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


async def test_list_returns_named_engagements_newest_first(client):
    a = (await client.post("/engagements")).json()["id"]
    await client.patch(f"/engagements/{a}", json={"entity_name": "Alpha Co", "jurisdictions": ["Netherlands"]})
    b = (await client.post("/engagements")).json()["id"]
    await client.patch(f"/engagements/{b}", json={"entity_name": "Beta Co"})
    unnamed = (await client.post("/engagements")).json()["id"]  # never named — a shell

    r = await client.get("/engagements")
    assert r.status_code == 200
    files = r.json()
    ids = [f["id"] for f in files]
    assert a in ids and b in ids
    assert unnamed not in ids            # unnamed shells stay out of the library
    assert ids.index(b) < ids.index(a)   # newest (Beta, patched last) first
    beta = next(f for f in files if f["id"] == b)
    assert beta["entity_name"] == "Beta Co"
    assert beta["jurisdictions"] == []
    assert beta["fiscal_year"] is None
    alpha = next(f for f in files if f["id"] == a)
    assert alpha["jurisdictions"] == ["Netherlands"]
