"""Tests for POST /auth/google."""

from unittest.mock import MagicMock, patch


async def test_google_login_missing_client_id(client):
    """Returns 500 when GOOGLE_CLIENT_ID env var is not configured."""
    with patch("main.GOOGLE_CLIENT_ID", ""):
        resp = await client.post("/auth/google", json={"token": "fake-token"})
    assert resp.status_code == 500
    assert "GOOGLE_CLIENT_ID" in resp.json()["detail"]


async def test_google_login_invalid_token(client):
    """Returns 401 when Google token verification fails."""
    with (
        patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
        patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=ValueError("bad token"),
        ),
    ):
        resp = await client.post("/auth/google", json={"token": "bad-token"})
    assert resp.status_code == 401
    assert "Invalid Google token" in resp.json()["detail"]


async def test_google_login_new_user(client, mock_db):
    """Creates a new user and returns a JWT on first login."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None  # user not found

    fake_idinfo = {
        "sub": "google-uid-123",
        "email": "newuser@example.com",
        "name": "New User",
        "picture": "https://example.com/pic.jpg",
    }
    with (
        patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
        patch(
            "google.oauth2.id_token.verify_oauth2_token",
            return_value=fake_idinfo,
        ),
    ):
        resp = await client.post("/auth/google", json={"token": "valid-token"})

    assert resp.status_code == 200
    data = resp.json()
    assert "jwt_token" in data
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["name"] == "New User"
    assert data["user"]["sub"] == "google-uid-123"


async def test_google_login_existing_user(client, mock_db):
    """Updates and returns an existing user on subsequent login."""
    existing = MagicMock()
    existing.id = 42
    existing.email = "existing@example.com"
    existing.name = "Existing User"
    existing.picture = "https://example.com/old.jpg"
    mock_db.execute.return_value.scalar_one_or_none.return_value = existing

    fake_idinfo = {
        "sub": "google-uid-42",
        "email": "existing@example.com",
        "name": "Existing User",
        "picture": "https://example.com/new.jpg",
    }
    with (
        patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
        patch(
            "google.oauth2.id_token.verify_oauth2_token",
            return_value=fake_idinfo,
        ),
    ):
        resp = await client.post("/auth/google", json={"token": "valid-token"})

    assert resp.status_code == 200
    data = resp.json()
    assert "jwt_token" in data
    assert data["user"]["id"] == 42
    assert data["user"]["email"] == "existing@example.com"
    assert data["user"]["sub"] == "google-uid-42"


async def test_health_endpoint_returns_ok(client):
    """GET /api/health returns 200 with status ok, no auth required."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


async def test_google_login_rate_limited_after_10_requests(client):
    """Returns 429 on the 11th auth request from the same client."""
    from unittest.mock import patch

    fake_idinfo = {
        "sub": "google-uid-rate-limit",
        "email": "limit@example.com",
        "name": "Rate Limit",
        "picture": "https://example.com/pic.jpg",
    }
    with (
        patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
        patch("google.oauth2.id_token.verify_oauth2_token", return_value=fake_idinfo),
    ):
        for _ in range(10):
            resp = await client.post("/auth/google", json={"token": "valid-token"})
            assert resp.status_code == 200

        resp = await client.post("/auth/google", json={"token": "valid-token"})

    assert resp.status_code == 429


async def test_google_login_uses_last_forwarded_hop_on_vercel(client):
    """Uses the last X-Forwarded-For hop on Vercel so appended proxy chains stay stable."""
    from unittest.mock import patch

    fake_idinfo = {
        "sub": "google-uid-forwarded",
        "email": "forwarded@example.com",
        "name": "Forwarded User",
        "picture": "https://example.com/pic.jpg",
    }
    first_headers = {"X-Forwarded-For": "1.1.1.1, 9.9.9.9"}
    second_headers = {"X-Forwarded-For": "2.2.2.2, 9.9.9.9"}

    with (
        patch.dict("main.os.environ", {"VERCEL": "1"}, clear=False),
        patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
        patch("google.oauth2.id_token.verify_oauth2_token", return_value=fake_idinfo),
    ):
        for _ in range(10):
            resp = await client.post("/auth/google", json={"token": "valid-token"}, headers=first_headers)
            assert resp.status_code == 200

        resp = await client.post("/auth/google", json={"token": "valid-token"}, headers=second_headers)

    assert resp.status_code == 429
