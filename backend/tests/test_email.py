from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from jose import jwt as jose_jwt


JWT_SECRET = "change-me-in-production-please"
JWT_ALGORITHM = "HS256"


def make_unsubscribe_token(user_id: int = 1) -> str:
    payload = {
        "sub": str(user_id),
        "purpose": "unsubscribe",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jose_jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def test_get_email_preferences_returns_defaults(client, auth_headers):
    with patch(
        "main.email_service.get_or_create_preferences",
        AsyncMock(return_value={"weekly_digest": True, "marketing": False, "user_id": "1"}),
    ):
        resp = await client.get("/api/email/preferences", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json() == {"weekly_digest": True, "marketing": False}


async def test_update_email_preferences_rejects_empty_payload(client, auth_headers):
    resp = await client.put("/api/email/preferences", headers=auth_headers, json={"unknown": True})

    assert resp.status_code == 400


async def test_update_email_preferences_persists_allowed_fields(client, mock_db, auth_headers):
    with patch(
        "main.email_service.get_or_create_preferences",
        AsyncMock(side_effect=[{"weekly_digest": True}, {"weekly_digest": False, "marketing": True}]),
    ):
        resp = await client.put(
            "/api/email/preferences",
            headers=auth_headers,
            json={"weekly_digest": False, "marketing": True, "invalid": "ignored"},
        )

    assert resp.status_code == 200
    assert resp.json()["weekly_digest"] is False
    assert resp.json()["marketing"] is True
    assert mock_db.execute.await_count >= 1


async def test_post_unsubscribe_marks_user_unsubscribed(client):
    token = make_unsubscribe_token()
    with patch("main.email_service.get_or_create_preferences", AsyncMock(return_value={})):
        resp = await client.post(f"/api/email/unsubscribe/{token}")

    assert resp.status_code == 200
    assert resp.json()["status"] == "unsubscribed"


async def test_get_unsubscribe_returns_html_page(client):
    token = make_unsubscribe_token()
    with patch("main.email_service.get_or_create_preferences", AsyncMock(return_value={})):
        resp = await client.get(f"/api/email/unsubscribe/{token}")

    assert resp.status_code == 200
    assert "Email preferences updated" in resp.text
    assert "unsubscribed" in resp.text.lower()


async def test_weekly_digest_requires_cron_secret(client):
    with patch("main.CRON_SECRET", "cron-secret"):
        resp = await client.get("/api/cron/weekly-digest")

    assert resp.status_code == 401


async def test_weekly_digest_sends_to_active_users(client, mock_db):
    active_user = MagicMock()
    active_user.id = 1
    active_user.email = "digest@example.com"
    active_user.name = "Encrypted Name"
    active_user.level = 4
    active_user.xp = 900

    result = MagicMock()
    result.scalars.return_value.all.return_value = [active_user]
    mock_db.execute.return_value = result

    with (
        patch("main.CRON_SECRET", "cron-secret"),
        patch("main.email_service.get_or_create_preferences", AsyncMock(return_value={"weekly_digest": True, "unsubscribed_at": None})),
        patch("main.was_recently_emailed", AsyncMock(return_value=False)),
        patch("main.compute_weekly_digest_summary", AsyncMock(return_value={
            "countries_count": 10,
            "regions_count": 40,
            "bucket_list_count": 3,
            "level": 4,
            "xp": 900,
            "activity_summary": "your world map changed",
            "has_recent_activity": True,
        })),
        patch("main.dec_str_safe", return_value="Traveler"),
        patch("main.email_service.render_weekly_digest_email", return_value="<html>digest</html>") as render_email,
        patch("main.email_service.send_email", AsyncMock(return_value="resend-digest")) as send_email,
    ):
        resp = await client.get(
            "/api/cron/weekly-digest",
            headers={"Authorization": "Bearer cron-secret"},
        )

    assert resp.status_code == 200
    assert resp.json()["sent"] == 1
    render_email.assert_called_once()
    send_email.assert_awaited_once()
