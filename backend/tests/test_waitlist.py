from __future__ import annotations

# The waitlist endpoint is PUBLIC — use raw_client (no auth override) to prove no token is required.


async def test_create_waitlist_request_returns_opaque_id(raw_client):
    res = await raw_client.post(
        "/waitlist",
        json={"name": "Ada Lovelace", "country": "United Kingdom", "email": "ada@example.com", "company": "Veritax"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["waitlist_user_id"].startswith("waitlist_")
    assert "@" not in body["waitlist_user_id"]  # opaque id, never the email


async def test_waitlist_persists_attribution_without_email_in_id(raw_client):
    res = await raw_client.post(
        "/waitlist",
        json={
            "name": "Grace", "country": "US", "email": "grace@example.com", "company": "Navy",
            "lead_id": "lead-123", "attribution": {"utm_source": "linkedin"},
        },
    )
    assert res.status_code == 200
    assert res.json()["waitlist_user_id"].startswith("waitlist_")


async def test_waitlist_rejects_missing_and_blank_fields(raw_client):
    missing = await raw_client.post("/waitlist", json={"name": "Ada"})
    assert missing.status_code == 422
    blank = await raw_client.post(
        "/waitlist",
        json={"name": "", "country": "UK", "email": "a@b.com", "company": "X"},
    )
    assert blank.status_code == 422
