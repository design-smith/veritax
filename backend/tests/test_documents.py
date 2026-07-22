import hashlib


async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


async def test_upload_stores_object_and_metadata(client):
    eid = await _engagement(client)
    content = b"Intercompany royalty agreement between parent and subsidiary. Rate 5 percent."

    r = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "agreements"},
        files={"files": ("royalty.txt", content, "text/plain")},
    )
    assert r.status_code == 201
    docs = r.json()
    assert len(docs) == 1
    doc = docs[0]
    assert doc["original_filename"] == "royalty.txt"
    assert doc["size_bytes"] == len(content)
    assert doc["content_hash"] == hashlib.sha256(content).hexdigest()

    # Bytes actually landed in object storage.
    stored = list(client.storage._objects.values())
    assert content in stored


async def test_upload_embeds_text_into_chunks(client):
    eid = await _engagement(client)
    # Enough words to produce at least one chunk.
    content = ("functional analysis " * 200).encode()

    doc = (
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": ("transcript.txt", content, "text/plain")},
        )
    ).json()[0]

    # Background embedding ran within the request (ASGITransport).
    got = (await client.get(f"/documents/{doc['id']}")).json()
    assert got["status"] == "embedded"
    assert got["error"] is None


async def test_upload_appends_to_same_uploaded_source(client):
    eid = await _engagement(client)
    for name in ("a.txt", "b.txt"):
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "financials"},
            files={"files": (name, b"balance sheet figures", "text/plain")},
        )
    agg = (await client.get(f"/engagements/{eid}")).json()
    fin_sources = [s for s in agg["sources"] if s["kind"] == "financials"]
    assert len(fin_sources) == 1  # one uploaded source per kind
    assert len(fin_sources[0]["documents"]) == 2


async def test_upload_requires_files(client):
    eid = await _engagement(client)
    r = await client.post(f"/engagements/{eid}/documents", data={"kind": "financials"})
    assert r.status_code == 422


async def test_upload_over_size_cap_rejected_with_reason(client, monkeypatch):
    from app.routers import documents as docs_router

    monkeypatch.setattr(docs_router, "_MAX_BYTES", 1024)  # 1 KB cap for the test
    eid = await _engagement(client)
    r = await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "financials"},
        files={"files": ("big.txt", b"x" * 2048, "text/plain")},
    )
    assert r.status_code == 413
    assert "big.txt" in r.json()["detail"]  # names the offending file, no silent failure
