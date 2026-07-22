async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


async def test_connected_source_stub(client):
    eid = await _engagement(client)
    r = await client.post(
        f"/engagements/{eid}/sources",
        json={"kind": "financials", "origin": "connected", "connector_provider": "quickbooks"},
    )
    assert r.status_code == 201

    agg = (await client.get(f"/engagements/{eid}")).json()
    connected = [s for s in agg["sources"] if s["origin"] == "connected"]
    assert len(connected) == 1
    assert connected[0]["connector_provider"] == "quickbooks"


async def test_connected_requires_valid_provider(client):
    eid = await _engagement(client)
    missing = await client.post(
        f"/engagements/{eid}/sources", json={"kind": "financials", "origin": "connected"}
    )
    assert missing.status_code == 422
    bad = await client.post(
        f"/engagements/{eid}/sources",
        json={"kind": "financials", "origin": "connected", "connector_provider": "nope"},
    )
    assert bad.status_code == 422


async def test_public_reference_source(client):
    eid = await _engagement(client)
    r = await client.post(
        f"/engagements/{eid}/sources",
        json={"kind": "public", "origin": "reference", "url": "https://example.com"},
    )
    assert r.status_code == 201

    agg = (await client.get(f"/engagements/{eid}")).json()
    ref = [s for s in agg["sources"] if s["origin"] == "reference"]
    assert ref and ref[0]["url"] == "https://example.com"


async def test_reference_requires_url(client):
    eid = await _engagement(client)
    r = await client.post(
        f"/engagements/{eid}/sources", json={"kind": "public", "origin": "reference"}
    )
    assert r.status_code == 422
