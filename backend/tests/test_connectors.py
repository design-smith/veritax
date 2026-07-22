async def test_connectors_seeded(client):
    r = await client.get("/connectors")
    assert r.status_code == 200
    rows = r.json()
    providers = {c["provider"] for c in rows}
    assert providers == {
        "sap", "oracle", "netsuite", "quickbooks", "xero",
        "fireflies", "otter", "granola",
    }
    by_provider = {c["provider"]: c for c in rows}
    assert by_provider["sap"]["category"] == "accounting"
    assert by_provider["fireflies"]["category"] == "notetaker"
    # All available, none wired yet.
    assert all(c["status"] == "available" for c in rows)
