from app.drafting import SYSTEM_PROMPT
from app.requirements import resolve_requirements


async def _engagement_with_doc(client, text: bytes) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", text, "text/plain")},
    )
    return eid


async def test_start_draft_creates_sections_and_drafts(client):
    eid = await _engagement_with_doc(client, b"The entity is a limited-risk distributor. Royalty is five percent.")

    started = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201
    # One section per resolved element; structure == requirements.
    assert len(started.json()["sections"]) == len(resolve_requirements("Netherlands"))

    got = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["pending"] == 0
    sec = got["sections"][0]
    assert sec["status"] == "drafted"
    assert sec["content"] and sec["element_name"] in sec["content"]
    # Provenance captured — citation resolves to the uploaded document.
    assert sec["citations"]
    assert sec["citations"][0]["kind"] == "document"
    assert sec["citations"][0]["document_id"]


async def test_start_draft_idempotent(client):
    import asyncio

    eid = await _engagement_with_doc(client, b"placeholder")
    r1, r2 = await asyncio.gather(
        client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"}),
        client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"}),
    )
    assert r1.status_code == 201 and r2.status_code == 201
    sections = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Canada"})).json()["sections"]
    assert len(sections) == 6  # not doubled


async def test_regenerate_section(client):
    eid = await _engagement_with_doc(client, b"management structure and reporting lines")
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    sections = (await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})).json()["sections"]
    sid = sections[0]["id"]

    r = await client.post(f"/draft-sections/{sid}/regenerate")
    assert r.status_code == 200
    assert r.json()["status"] == "drafted"
    assert r.json()["content"]


async def test_unknown_jurisdiction_404(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Narnia"})
    assert r.status_code == 404


def test_system_prompt_encodes_the_laws():
    p = SYSTEM_PROMPT.lower()
    assert "citation" in p                      # L1: cite every claim
    assert "never" in p and "number" in p       # L3: numbers never generated
    assert "web_search only" in p or "gaps" in p  # confidential-first / web gap-filler
    assert "not judge" in p or "correct" in p   # sufficiency not correctness
