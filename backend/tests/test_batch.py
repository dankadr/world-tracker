"""Tests for POST /api/batch."""


async def test_batch_endpoint_rate_limited_after_60_requests(client, auth_headers):
    """Returns 429 on the 61st batch request from the same client."""
    for _ in range(60):
        resp = await client.post("/api/batch", headers=auth_headers, json={"actions": []})
        assert resp.status_code == 200

    resp = await client.post("/api/batch", headers=auth_headers, json={"actions": []})

    assert resp.status_code == 429
