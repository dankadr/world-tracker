"""Tests for world visited-countries endpoints."""

from unittest.mock import MagicMock


async def test_get_world_no_auth(client):
    """Returns 401 when no Authorization header is provided."""
    resp = await client.get("/api/visited-world")
    assert resp.status_code == 401


async def test_get_world_empty(client, auth_headers, mock_db):
    """Returns empty countries list when nothing has been visited."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.get("/api/visited-world", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["countries"] == []


async def test_get_world_with_visits(client, auth_headers, mock_db):
    """Returns stored countries when a world record exists."""
    record = MagicMock()
    record.countries = ["CH", "DE", "FR"]
    mock_db.execute.return_value.scalar_one_or_none.return_value = record

    resp = await client.get("/api/visited-world", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["countries"] == ["CH", "DE", "FR"]


async def test_patch_world_invalid_action(client, auth_headers):
    """PATCH returns 400 when action is not 'add' or 'remove'."""
    resp = await client.patch(
        "/api/visited-world",
        headers=auth_headers,
        json={"country": "CH", "action": "toggle"},
    )
    assert resp.status_code == 400


async def test_patch_world_add_creates_record(client, auth_headers, mock_db):
    """PATCH add creates a new world record and includes the country."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.patch(
        "/api/visited-world",
        headers=auth_headers,
        json={"country": "CH", "action": "add"},
    )
    assert resp.status_code == 200
    assert "CH" in resp.json()["countries"]


async def test_patch_world_no_auth(client):
    """Returns 401 when patching world without auth."""
    resp = await client.patch(
        "/api/visited-world", json={"country": "CH", "action": "add"}
    )
    assert resp.status_code == 401
