from app.main import app


# Test-only route that raises an unhandled error, to prove 500s still carry CORS headers
# (so the browser sees a real status instead of an opaque "Failed to fetch").
@app.get("/_boom")
async def _boom():
    raise RuntimeError("kaboom")


async def test_unhandled_error_is_cors_visible(client):
    r = await client.get("/_boom", headers={"Origin": "http://localhost:3000"})
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert r.json()["detail"] == "internal server error"
