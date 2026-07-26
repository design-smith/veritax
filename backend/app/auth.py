"""Verify Supabase Auth access-token JWTs.

The frontend logs in with Supabase and sends the access token as `Authorization: Bearer <jwt>`. We
verify it here — signature, audience, issuer, expiry — and return the user identity (the `sub` claim is
the Supabase user UUID). Two signing schemes are supported and picked by the token's `alg`:

- asymmetric (RS256/ES256/EdDSA) — the current Supabase default — verified against the project JWKS;
- legacy HS256 — verified with the shared project JWT secret (SUPABASE_JWT_SECRET).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient

from .config import settings


class AuthError(Exception):
    """Token missing/malformed/invalid — the caller maps this to HTTP 401."""


@dataclass
class AuthUser:
    id: uuid.UUID
    email: str | None


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base = settings.supabase_url.rstrip("/")
        _jwks_client = PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")  # caches keys after first fetch
    return _jwks_client


def _issuer() -> str | None:
    base = settings.supabase_url.rstrip("/")
    return f"{base}/auth/v1" if base else None


def verify_token(token: str) -> AuthUser:
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except Exception as exc:  # noqa: BLE001 - malformed token
        raise AuthError(f"malformed token: {exc}") from exc

    iss = _issuer()
    decode_kwargs: dict = {
        "audience": settings.supabase_jwt_aud,
        "options": {"require": ["exp", "sub"], "verify_iss": bool(iss)},
    }
    if iss:
        decode_kwargs["issuer"] = iss

    try:
        if alg.startswith("HS"):
            if not settings.supabase_jwt_secret:
                raise AuthError("HS256 token but SUPABASE_JWT_SECRET is not configured")
            claims = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], **decode_kwargs)
        else:
            if not settings.supabase_url:
                raise AuthError("asymmetric token but SUPABASE_URL is not configured")
            key = _get_jwks_client().get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256", "ES256", "EdDSA"], **decode_kwargs)
    except AuthError:
        raise
    except Exception as exc:  # noqa: BLE001 - bad signature / expired / wrong aud|iss
        raise AuthError(str(exc)) from exc

    sub = claims.get("sub")
    if not sub:
        raise AuthError("token missing sub")
    try:
        uid = uuid.UUID(str(sub))
    except ValueError as exc:
        raise AuthError("sub is not a uuid") from exc
    return AuthUser(id=uid, email=claims.get("email"))
