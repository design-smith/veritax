async def test_search_returns_hits_from_embedded_chunks(client):
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "agreements"},
        files={"files": ("doc.txt", ("transfer pricing benchmark study " * 100).encode(), "text/plain")},
    )

    r = await client.get("/search", params={"q": "benchmark study", "engagement_id": eid})
    assert r.status_code == 200
    hits = r.json()
    assert len(hits) >= 1
    assert hits[0]["original_filename"] == "doc.txt"
    assert "distance" in hits[0]
