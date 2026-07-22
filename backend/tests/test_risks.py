from app.risks import SYSTEM_PROMPT


async def _engagement_with_doc(client, text: bytes) -> str:
    eid = (await client.post("/engagements")).json()["id"]
    await client.post(
        f"/engagements/{eid}/documents",
        data={"kind": "interview"},
        files={"files": ("notes.txt", text, "text/plain")},
    )
    return eid


async def _draft(client, eid: str, jurisdiction: str) -> None:
    await client.post(f"/engagements/{eid}/draft", params={"jurisdiction": jurisdiction})
    # FakeDrafter completes within the request (ASGITransport background).
    await client.get(f"/engagements/{eid}/draft", params={"jurisdiction": jurisdiction})


async def test_risks_blocked_until_draft_complete(client):
    eid = await _engagement_with_doc(client, b"limited-risk distributor; royalty five percent")
    # No draft yet → 409 (mirror of the Requirements rule).
    r = await client.post(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})
    assert r.status_code == 409


async def test_risks_produces_both_kinds_with_evidence(client):
    eid = await _engagement_with_doc(client, b"limited-risk distributor; royalty five percent; services at cost")
    await _draft(client, eid, "Canada")

    started = await client.post(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})
    assert started.status_code == 201

    got = (await client.get(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})).json()
    assert got["status"] == "done"
    kinds = {f["kind"] for f in got["findings"]}
    assert kinds == {"discrepancy", "exposure"}  # both kinds, not collapsed
    # Severity-ordered (worst first): high before medium.
    sevs = [f["severity"] for f in got["findings"]]
    assert sevs == sorted(sevs, key=lambda s: ["critical", "high", "medium", "low"].index(s))
    # Each finding is evidenced, has options, and an estimated exposure flag.
    for f in got["findings"]:
        assert f["evidence"]
        assert f["recommendations"]
        assert f["exposure_estimated"] is True
        assert f["exposure_amount"] is None  # no computed figure this build
    # At least one finding's evidence points at a real document (clickable provenance).
    assert any(e["document_id"] for f in got["findings"] for e in f["evidence"])
    # Summary counts by severity AND kind; no fake total exposure.
    assert got["summary"]["by_kind"] == {"discrepancy": 1, "exposure": 1}
    assert "total" in got["summary"] and got["summary"]["total"] == 2


async def test_get_before_start_is_not_started(client):
    eid = (await client.post("/engagements")).json()["id"]
    got = (await client.get(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})).json()
    assert got["status"] == "not_started"
    assert got["findings"] == []


async def test_rerun_replaces_findings(client):
    eid = await _engagement_with_doc(client, b"placeholder draft material")
    await _draft(client, eid, "Canada")
    await client.post(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})
    await client.post(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})
    got = (await client.get(f"/engagements/{eid}/risks", params={"jurisdiction": "Canada"})).json()
    assert got["summary"]["total"] == 2  # not doubled


def test_system_prompt_encodes_the_laws():
    p = SYSTEM_PROMPT.lower()
    assert "discrepancy" in p and "exposure" in p          # two kinds
    assert "defensible" in p or "exposed" in p              # judges substance
    assert "never" in p and ("invent" in p or "compute" in p)  # L3 numbers
    assert "options" in p and "not instructions" in p       # recommendations as options
    assert "compliant" in p                                 # never say compliant
