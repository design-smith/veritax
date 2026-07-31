import uuid

from app.main import app
from app.models import Document, DocumentStatus


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


async def test_search_ignores_chunks_from_non_embedded_documents(client):
    eid = (await client.post("/engagements")).json()["id"]
    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "agreements"},
            files={"files": ("doc.txt", ("transfer pricing benchmark study " * 100).encode(), "text/plain")},
        )
    ).json()[0]
    async with app.state.session_factory() as session:
        row = await session.get(Document, uuid.UUID(doc["id"]))
        row.status = DocumentStatus.failed
        await session.commit()

    r = await client.get("/search", params={"q": "benchmark study", "engagement_id": eid})

    assert r.status_code == 200
    assert r.json() == []
