import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


# Test-only route that raises an unhandled error, to prove 500s still carry CORS headers
# (so the browser sees a real status instead of an opaque "Failed to fetch").
@app.get("/_boom")
async def _boom():
    raise RuntimeError("kaboom")


@pytest_asyncio.fixture
async def cors_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_unhandled_error_is_cors_visible(cors_client):
    r = await cors_client.get("/_boom", headers={"Origin": "http://localhost:3000"})
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert r.json()["detail"] == "internal server error"


async def test_veritax_custom_domain_is_cors_allowed(cors_client):
    r = await cors_client.get("/health", headers={"Origin": "https://veritaxai.com"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://veritaxai.com"


async def test_vercel_preview_domain_is_cors_allowed(cors_client):
    r = await cors_client.get("/health", headers={"Origin": "https://veritax-virid.vercel.app"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "https://veritax-virid.vercel.app"
