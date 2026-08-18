"""Class 3 · S11 — benchmark import: a comparable set as structured evidence, preserving accepted AND rejected
comparables with their rejection reasons (the audit trail, §38)."""


async def _analysis(client):
    eid = (await client.post("/engagements")).json()["id"]
    a = (await client.post(f"/engagements/{eid}/tnmm-analyses", json={"pli_type": "operating_margin"})).json()
    return a["id"]


_SET = {
    "source": "Orbis", "search_date": "2026-05-12", "periods": ["2022", "2023", "2024"],
    "geographic_scope": "GCC", "industry_scope": "Business services", "search_strategy": "NACE 70.22 + screens",
    "comparables": [
        {"company_name": "Comparable A", "country": "AE", "accepted": True, "pli_values": [0.041, 0.049, 0.046]},
        {"company_name": "Comparable B", "country": "SA", "accepted": True, "pli_values": [0.052, 0.050, 0.055]},
        {"company_name": "Reject Co", "country": "AE", "accepted": False, "rejection_reason": "related-party sales > 30%", "pli_values": [0.2]},
    ],
}


async def test_import_preserves_full_population_with_rejection_reasons(client):
    aid = await _analysis(client)
    r = await client.post(f"/tnmm-analyses/{aid}/benchmark-sets", json=_SET)
    assert r.status_code == 201
    body = r.json()
    assert body["source"] == "Orbis" and body["periods"] == ["2022", "2023", "2024"]
    assert body["accepted_count"] == 2 and body["rejected_count"] == 1     # rejects are NOT dropped (§38)
    reject = next(c for c in body["comparables"] if not c["accepted"])
    assert reject["company_name"] == "Reject Co" and reject["rejection_reason"] == "related-party sales > 30%"
    accepted = next(c for c in body["comparables"] if c["accepted"] and c["company_name"] == "Comparable A")
    assert accepted["pli_values"] == [0.041, 0.049, 0.046]


async def test_list_and_detail_include_rejects(client):
    aid = await _analysis(client)
    set_id = (await client.post(f"/tnmm-analyses/{aid}/benchmark-sets", json=_SET)).json()["id"]
    listed = (await client.get(f"/tnmm-analyses/{aid}/benchmark-sets")).json()
    assert len(listed) == 1 and listed[0]["rejected_count"] == 1
    detail = (await client.get(f"/benchmark-sets/{set_id}")).json()
    assert len(detail["comparables"]) == 3     # full population, incl. the reject


async def test_delete_benchmark_set(client):
    aid = await _analysis(client)
    set_id = (await client.post(f"/tnmm-analyses/{aid}/benchmark-sets", json=_SET)).json()["id"]
    assert (await client.delete(f"/benchmark-sets/{set_id}")).status_code == 204
    assert (await client.get(f"/tnmm-analyses/{aid}/benchmark-sets")).json() == []
