"""Tests for wishlist endpoints."""

from unittest.mock import MagicMock
from datetime import datetime, timezone


async def test_get_wishlist_no_auth(client):
    """Returns 401 without auth."""
    resp = await client.get("/api/wishlist")
    assert resp.status_code == 401


async def test_get_wishlist_empty(client, auth_headers, mock_db):
    """Returns empty list when wishlist is empty."""
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    resp = await client.get("/api/wishlist", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_wishlist_with_items(client, auth_headers, mock_db):
    """Returns serialized wishlist items."""
    item = MagicMock()
    item.tracker_id = "ch"
    item.region_id = "ZH"
    item.priority = "high"
    item.target_date = "2025-06"
    item.notes = "Plan visit"
    item.category = "solo"
    item.created_at = datetime(2025, 1, 15, tzinfo=timezone.utc)
    mock_db.execute.return_value.scalars.return_value.all.return_value = [item]

    resp = await client.get("/api/wishlist", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["tracker_id"] == "ch"
    assert data[0]["region_id"] == "ZH"
    assert data[0]["priority"] == "high"


async def test_get_wishlist_for_tracker_no_auth(client):
    """Returns 401 without auth."""
    resp = await client.get("/api/wishlist/ch")
    assert resp.status_code == 401


async def test_get_wishlist_for_tracker_empty(client, auth_headers, mock_db):
    """Returns empty list for a specific tracker with no wishlist."""
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    resp = await client.get("/api/wishlist/ch", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_upsert_wishlist_invalid_priority(client, auth_headers):
    """Returns 400 when priority is invalid."""
    resp = await client.put(
        "/api/wishlist/ch/ZH",
        headers=auth_headers,
        json={"priority": "critical"},
    )
    assert resp.status_code == 400
    assert "priority" in resp.json()["detail"]


async def test_upsert_wishlist_invalid_category(client, auth_headers):
    """Returns 400 when category is invalid."""
    resp = await client.put(
        "/api/wishlist/ch/ZH",
        headers=auth_headers,
        json={"priority": "high", "category": "pets"},
    )
    assert resp.status_code == 400
    assert "category" in resp.json()["detail"]


async def test_delete_wishlist_item_no_auth(client):
    """Returns 401 without auth."""
    resp = await client.delete("/api/wishlist/ch/ZH")
    assert resp.status_code == 401


async def test_delete_wishlist_item_not_found(client, auth_headers, mock_db):
    """Returns 404 when deleting a nonexistent wishlist item."""
    mock_db.execute.return_value.rowcount = 0  # delete(WishlistItem) matched no rows

    resp = await client.delete("/api/wishlist/ch/ZH", headers=auth_headers)
    assert resp.status_code == 404
