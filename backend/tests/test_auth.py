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
