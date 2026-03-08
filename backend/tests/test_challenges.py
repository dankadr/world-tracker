"""Tests for challenge endpoints."""

from unittest.mock import MagicMock


async def test_list_challenges_no_auth(client):
    """Returns 401 without auth."""
    resp = await client.get("/api/challenges")
    assert resp.status_code == 401


async def test_list_challenges_empty(client, auth_headers, mock_db):
    """Returns empty list when user has no challenges."""
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    resp = await client.get("/api/challenges", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_challenge_invalid_type(client, auth_headers):
    """Returns 400 for unsupported challenge_type."""
    resp = await client.post(
        "/api/challenges",
        headers=auth_headers,
        json={
            "title": "My Challenge",
            "tracker_id": "ch",
            "target_regions": ["ZH"],
            "challenge_type": "tournament",  # invalid
        },
    )
    assert resp.status_code == 400
    assert "challenge_type" in resp.json()["detail"]


async def test_create_challenge_limit_exceeded(client, auth_headers, mock_db):
    """Returns 409 when user already has 10 active challenges."""
    mock_db.execute.return_value.scalar.return_value = 10

    resp = await client.post(
        "/api/challenges",
        headers=auth_headers,
        json={
            "title": "Another Challenge",
            "tracker_id": "ch",
            "target_regions": ["ZH"],
            "challenge_type": "collaborative",
        },
    )
    assert resp.status_code == 409


async def test_join_challenge_not_found(client, auth_headers, mock_db):
    """Returns 404 when joining a nonexistent challenge."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.post(
        "/api/challenges/nonexistent-id/join",
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


async def test_join_challenge_no_auth(client):
    """Returns 401 without auth."""
    resp = await client.post("/api/challenges/some-id/join")
    assert resp.status_code == 401


async def test_leave_challenge_not_found(client, auth_headers, mock_db):
    """Returns 404 when leaving a nonexistent challenge."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.delete(
        "/api/challenges/nonexistent-id/leave",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_get_challenge_detail_not_found(client, auth_headers, mock_db):
    """Returns 404 when getting details of a nonexistent challenge."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.get(
        "/api/challenges/nonexistent-id",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_challenge_not_found(client, auth_headers, mock_db):
    """Returns 404 when deleting a nonexistent challenge."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.delete(
        "/api/challenges/nonexistent-id",
        headers=auth_headers,
    )
    assert resp.status_code == 404
