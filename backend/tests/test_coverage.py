from app.assessment import SYSTEM_PROMPT
from app.requirements import resolve_requirements


async def _engagement_with_doc(client, text: bytes) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", text, "text/plain")},
    )
    return eid


async def test_start_coverage_creates_rows_and_assesses(client):
    eid = await _engagement_with_doc(client, b"management structure and reporting lines of the entity")

    started = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    assert started.status_code == 201
    # Response is built before the background job runs → rows start pending.
    assert len(started.json()["requirements"]) == len(resolve_requirements("Netherlands"))

    # Background assessment ran within the request (ASGITransport) — poll returns assessed rows.
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()
    assert got["summary"]["pending"] == 0
    statuses = {r["status"] for r in got["requirements"]}
    assert statuses & {"present", "partial", "missing"}
    # "Management structure" (order 1) should be present given the doc, with provenance.
    mgmt = next(r for r in got["requirements"] if r["element_order"] == 1)
    assert mgmt["status"] == "present"
    assert "interview" in mgmt["sources_used"]


async def test_evidence_pointers_and_draft_link(client):
    eid = await _engagement_with_doc(client, b"management structure and reporting lines of the entity")
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()
    mgmt = next(r for r in got["requirements"] if r["element_order"] == 1)
    assert mgmt["status"] == "present"
    # provenance pointer: which document + where
    assert mgmt["evidence"]
    ev = mgmt["evidence"][0]
    assert ev["document_id"] and ev["source_label"] == "notes.txt" and ev["locator"]
    assert mgmt["draft_section_id"] is None  # no draft yet

    # Once drafted, the requirement links to its draft section.
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": "Netherlands"})
    got2 = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()
    mgmt2 = next(r for r in got2["requirements"] if r["element_order"] == 1)
    assert mgmt2["draft_section_id"]


async def test_conditional_elements_flagged_and_excluded(client):
    eid = await _engagement_with_doc(client, b"placeholder")
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "France"})
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "France"})).json()

    conditional = [r for r in got["requirements"] if r["is_conditional"]]
    assert len(conditional) == 2
    assert all(r["status"] == "conditional" for r in conditional)
    # Conditionals don't count toward "need attention".
    assert got["summary"]["conditional"] == 2
    assert got["summary"]["required_total"] == got["summary"]["total"] - 2


async def test_start_coverage_is_idempotent(client):
    # React StrictMode fires the effect twice → two concurrent POSTs must not 500 or duplicate rows.
    eid = await _engagement_with_doc(client, b"placeholder")
    import asyncio

    r1, r2 = await asyncio.gather(
        client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Canada"}),
        client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Canada"}),
    )
    assert r1.status_code == 201 and r2.status_code == 201
    rows = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Canada"})).json()["requirements"]
    assert len(rows) == 6  # Canada s.247(4) — not doubled


async def test_multi_document_source_does_not_stall(client):
    # Two files under the SAME source kind → both map to one source_id. The provenance insert must
    # dedupe by source_id, else (coverage_id, source_id) PK violates and the whole batch stalls.
    eid = (await client.post("/engagements")).json()["id"]
    body = b"Property or services, participants and relationships, functions property and risks, data methods analysis, assumptions strategies policies."
    for name in ("a.txt", "b.txt"):
        await client.post(
            f"/engagements/{eid}/documents",
            data={"kind": "interview"},
            files={"files": (name, body, "text/plain")},
        )
    r = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Canada"})
    assert r.status_code == 201
    got = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Canada"})).json()
    assert got["summary"]["pending"] == 0  # completed, not stuck
    for row in got["requirements"]:
        assert row["sources_used"].count("interview") <= 1  # provenance de-duped


async def test_unknown_jurisdiction_404(client):
    eid = (await client.post("/engagements")).json()["id"]
    r = await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Narnia"})
    assert r.status_code == 404


async def test_text_supplement_reassesses_row(client):
    # Sparse doc → "Management structure" comes back missing.
    eid = await _engagement_with_doc(client, b"placeholder text with nothing relevant")
    await client.post(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})
    rows = (await client.get(f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"})).json()["requirements"]
    mgmt = next(r for r in rows if r["element_order"] == 1)
    assert mgmt["status"] == "missing"

    # Supplement the gap in place → that one row re-assesses to present.
    r = await client.post(
        f"/coverage/{mgmt['id']}/supplements",
        data={"kind": "text", "text": "The management structure and reporting lines are as follows."},
    )
    assert r.status_code == 201
    assert r.json()["status"] == "present"

    # And it landed in the corpus as a supplement-kind source (flows into Draft).
    agg = (await client.get(f"/engagements/{eid}")).json()
    assert any(s["kind"] == "supplement" for s in agg["sources"])


def test_system_prompt_refuses_correctness():
    p = SYSTEM_PROMPT.lower()
    assert "must not" in p and "arm's-length" in p and "sufficiency" in p
