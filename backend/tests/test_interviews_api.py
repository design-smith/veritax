"""S4: guided functional interview — deterministic question generation + capture, provenance preserved."""
from app.functional import select_questions


async def _engagement(client) -> str:
    return (await client.post("/engagements")).json()["id"]


def test_select_questions_is_role_and_transaction_aware():
    qs = select_questions("finance", ("services",))
    keys = {q["question_key"] for q in qs}
    assert {"core.functions", "services.fee_approval", "finance.pricing_authority"} <= keys
    assert not any(k.startswith("treasury.") for k in keys)        # unrelated role module excluded
    assert not any(k.startswith("distribution.") for k in keys)    # unrelated transaction module excluded
    seqs = [q["sequence"] for q in qs]
    assert seqs == list(range(1, len(qs) + 1)) and len(keys) == len(qs)   # sequenced + de-duped


async def test_create_interview_generates_scoped_questions(client):
    eid = await _engagement(client)
    r = await client.post(f"/engagements/{eid}/interviews", json={
        "participant_name": "Jane Roe", "participant_title": "Finance Director", "participant_role": "finance",
        "transaction_types": ["services"], "transaction_ids": ["txn_1"], "fiscal_period": "FY2026"})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "not_started" and body["participant_role"] == "finance"
    keys = {q["question_key"] for q in body["questions"]}
    assert {"core.functions", "services.fee_approval", "finance.pricing_authority"} <= keys
    assert not any(k.startswith("treasury.") for k in keys)


async def test_capture_response_findings_and_immutable_raw(client):
    eid = await _engagement(client)
    created = (await client.post(f"/engagements/{eid}/interviews", json={
        "participant_name": "T Lead", "participant_role": "treasury", "transaction_types": ["financing"]})).json()
    iid = created["id"]
    q = next(q for q in created["questions"] if q["question_key"] == "treasury.fx_authority")

    resp = await client.post(f"/interviews/{iid}/responses", json={
        "question_id": q["id"], "response_raw": "Swiss Treasury executes all hedges.",
        "response_summary": "Hedging authority sits with Swiss Treasury."})
    assert resp.status_code == 201 and resp.json()["response_raw"].startswith("Swiss Treasury")

    screen = (await client.get(f"/interviews/{iid}")).json()
    assert screen["status"] == "in_progress"
    answered = next(qq for qq in screen["questions"] if qq["id"] == q["id"])
    assert answered["responses"][0]["response_raw"] == "Swiss Treasury executes all hedges."   # raw preserved (§18)

    findings = (await client.get(f"/interviews/{iid}/findings")).json()
    assert any("hedging" in f.lower() for f in findings["risks"])   # answered risk question surfaces
    assert findings["open_questions"]                                # the rest remain open

    lst = (await client.get(f"/engagements/{eid}/interviews")).json()
    assert lst[0]["question_count"] >= 1 and lst[0]["answered_count"] == 1


async def test_response_rejected_for_foreign_question(client):
    eid = await _engagement(client)
    a = (await client.post(f"/engagements/{eid}/interviews", json={"participant_name": "A"})).json()
    b = (await client.post(f"/engagements/{eid}/interviews", json={"participant_name": "B"})).json()
    foreign_q = b["questions"][0]["id"]
    r = await client.post(f"/interviews/{a['id']}/responses", json={"question_id": foreign_q, "response_raw": "x"})
    assert r.status_code == 404
