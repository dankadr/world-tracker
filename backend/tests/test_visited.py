"""Tests for visited-regions endpoints."""

from unittest.mock import MagicMock


async def test_get_visited_no_auth(client):
    """Returns 401 when no Authorization header is provided."""
    resp = await client.get("/api/visited/ch")
    assert resp.status_code == 401


async def test_get_visited_missing_bearer(client):
    """Returns 401 when Authorization header is malformed."""
    resp = await client.get("/api/visited/ch", headers={"Authorization": "Basic abc"})
    assert resp.status_code == 401


async def test_get_visited_invalid_country(client, auth_headers):
    """Returns 400 for an unknown country ID."""
    resp = await client.get("/api/visited/unknowncountry", headers=auth_headers)
    assert resp.status_code == 400


async def test_get_visited_no_record(client, auth_headers, mock_db):
    """Returns empty data when the user has no visits for this country."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    resp = await client.get("/api/visited/ch", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["country_id"] == "ch"
    assert data["regions"] == []
    assert data["dates"] == {}
    assert data["notes"] == {}
    assert data["wishlist"] == []


async def test_get_visited_with_existing_record(client, auth_headers, mock_db):
    """Returns the stored regions when a record exists."""
    record = MagicMock()
    record.regions = ["ZH", "BE"]
    record.dates = {"ZH": "2024-01-15"}
    record.notes = {}
    record.wishlist = []
    mock_db.execute.return_value.scalar_one_or_none.return_value = record

    resp = await client.get("/api/visited/ch", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["regions"] == ["ZH", "BE"]
    assert data["dates"] == {"ZH": "2024-01-15"}


async def test_put_visited_creates_new_record(client, auth_headers, mock_db):
    """PUT creates a new record and returns the saved regions."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.put(
        "/api/visited/ch",
        headers=auth_headers,
        json={"regions": ["ZH", "BE"], "dates": {}, "notes": {}, "wishlist": []},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["country_id"] == "ch"
    assert data["regions"] == ["ZH", "BE"]


async def test_put_visited_invalid_country(client, auth_headers):
    """PUT returns 400 for an invalid country ID."""
    resp = await client.put(
        "/api/visited/invalid",
        headers=auth_headers,
        json={"regions": ["X1"]},
    )
    assert resp.status_code == 400


async def test_patch_visited_invalid_action(client, auth_headers):
    """PATCH returns 400 when action is not 'add' or 'remove'."""
    resp = await client.patch(
        "/api/visited/ch",
        headers=auth_headers,
        json={"region": "ZH", "action": "upsert"},
    )
    assert resp.status_code == 400


async def test_get_all_visited_no_auth(client):
    """Returns 401 when requesting all-visited without auth."""
    resp = await client.get("/api/visited/all")
    assert resp.status_code == 401


async def test_get_all_visited_empty(client, auth_headers, mock_db):
    """Returns empty regions and world list when nothing is visited."""
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    resp = await client.get("/api/visited/all", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["regions"] == {}
    assert data["world"] == []


async def test_batch_rejects_more_than_50_actions(client, auth_headers):
    """POST /api/batch returns 422 when more than 50 actions are submitted."""
    actions = [
        {"action": "region_toggle", "payload": {"country_id": "ch", "region": f"r{i}", "action": "add"}}
        for i in range(51)
    ]
    resp = await client.post("/api/batch", json={"actions": actions}, headers=auth_headers)
    assert resp.status_code == 422


async def test_batch_accepts_exactly_50_actions(client, auth_headers, mock_db):
    """POST /api/batch accepts exactly 50 actions without error."""
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    actions = [
        {"action": "world_toggle", "payload": {"country": f"c{i}", "action": "add"}}
        for i in range(50)
    ]
    resp = await client.post("/api/batch", json={"actions": actions}, headers=auth_headers)
    assert resp.status_code == 200
