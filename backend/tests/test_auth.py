"""Auth gate + per-user data scoping — exercised against the real JWT verification (no override).

Tokens are HS256, signed with a test secret set on the settings singleton. `supabase_url` is unset in
tests, so issuer verification is skipped; only signature + audience + expiry are checked.
"""

from __future__ import annotations

import time
import uuid

import jwt
import pytest

from app.config import settings

SECRET = "test-jwt-secret"


def _token(sub: uuid.UUID, *, secret: str = SECRET, aud: str = "authenticated", exp_delta: int = 3600) -> str:
    return jwt.encode(
        {"sub": str(sub), "aud": aud, "email": "u@example.com", "exp": int(time.time()) + exp_delta},
        secret,
        algorithm="HS256",
    )


def _hdr(sub: uuid.UUID, **kw) -> dict:
    return {"Authorization": f"Bearer {_token(sub, **kw)}"}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setattr(settings, "supabase_jwt_secret", SECRET)


async def test_no_token_is_401(raw_client):
    assert (await raw_client.post("/engagements")).status_code == 401


async def test_bad_signature_is_401(raw_client):
    r = await raw_client.post("/engagements", headers=_hdr(uuid.uuid4(), secret="wrong-secret"))
    assert r.status_code == 401


async def test_expired_token_is_401(raw_client):
    r = await raw_client.post("/engagements", headers=_hdr(uuid.uuid4(), exp_delta=-10))
    assert r.status_code == 401


async def test_valid_token_creates_engagement(raw_client):
    r = await raw_client.post("/engagements", headers=_hdr(uuid.uuid4()))
    assert r.status_code == 201
    assert r.json()["id"]


async def test_engagement_is_scoped_to_owner(raw_client):
    alice, bob = uuid.uuid4(), uuid.uuid4()
    eid = (await raw_client.post("/engagements", headers=_hdr(alice))).json()["id"]
    # Owner sees it; another user gets 404 (existence not leaked), not 403.
    assert (await raw_client.get(f"/engagements/{eid}", headers=_hdr(alice))).status_code == 200
    assert (await raw_client.get(f"/engagements/{eid}", headers=_hdr(bob))).status_code == 404
    # And Bob can't drive its pipeline either.
    assert (await raw_client.get(
        f"/engagements/{eid}/coverage", params={"jurisdiction": "Netherlands"}, headers=_hdr(bob)
    )).status_code == 404
