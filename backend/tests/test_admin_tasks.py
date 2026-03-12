import json
import os
import pytest
from unittest.mock import patch, MagicMock

FAKE_KEY = "74ee4f1e475572aaacd95d276c0ec69730c7c051001a318d39584fd7d83c76ea"
FAKE_URL = "postgresql://user:pass@localhost/test"


def _make_mock_conn(rows=None):
    """Return a mock connection whose execute() is directly iterable (yields rows)."""
    if rows is None:
        rows = []
    mock_conn = MagicMock()
    mock_conn.execute.return_value = iter(rows)
    return mock_conn


def test_encrypt_all_returns_dict():
    """encrypt_all returns a dict with expected keys."""
    from admin_tasks import encrypt_all
    with patch("admin_tasks.create_engine") as mock_engine:
        mock_conn = _make_mock_conn([])
        mock_engine.return_value.begin.return_value.__enter__ = lambda s: mock_conn
        mock_engine.return_value.begin.return_value.__exit__ = MagicMock(return_value=False)
        result = encrypt_all(FAKE_URL, FAKE_KEY)
    assert "encrypted" in result
    assert "skipped" in result
    assert "errors" in result
    assert isinstance(result["encrypted"], int)
    assert isinstance(result["skipped"], int)
    assert isinstance(result["errors"], int)


def test_decrypt_all_returns_dict():
    """decrypt_all returns a dict with expected keys."""
    from admin_tasks import decrypt_all
    with patch("admin_tasks.create_engine") as mock_engine:
        mock_conn = _make_mock_conn([])
        mock_engine.return_value.begin.return_value.__enter__ = lambda s: mock_conn
        mock_engine.return_value.begin.return_value.__exit__ = MagicMock(return_value=False)
        result = decrypt_all(FAKE_URL, FAKE_KEY)
    assert "decrypted" in result
    assert "skipped" in result
    assert "errors" in result
    assert isinstance(result["decrypted"], int)
    assert isinstance(result["skipped"], int)
    assert isinstance(result["errors"], int)


def test_encrypt_all_counts_encrypted():
    """encrypt_all counts one unencrypted visited_world row as encrypted=1, skipped=0."""
    from admin_tasks import encrypt_all

    # One visited_world row with plaintext JSON data; all other tables return empty.
    visited_world_row = (1, 42, '["US", "CH"]')  # (id, user_id, countries)

    call_count = [0]

    def side_effect(stmt, *args, **kwargs):
        call_count[0] += 1
        # First call: visited_world SELECT → return the one row
        if call_count[0] == 1:
            return iter([visited_world_row])
        # Subsequent calls: other table SELECTs → empty; UPDATE calls return MagicMock
        return iter([])

    with patch("admin_tasks.create_engine") as mock_engine, \
         patch("admin_tasks.is_encrypted", return_value=False), \
         patch("admin_tasks.enc_json", return_value="gAAAAA_fake_token"):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = side_effect
        mock_engine.return_value.begin.return_value.__enter__ = lambda s: mock_conn
        mock_engine.return_value.begin.return_value.__exit__ = MagicMock(return_value=False)
        result = encrypt_all(FAKE_URL, FAKE_KEY)

    assert result["encrypted"] == 1
    assert result["skipped"] == 0


def test_decrypt_all_counts_decrypted():
    """decrypt_all counts one encrypted visited_world row as decrypted>=1."""
    from admin_tasks import decrypt_all

    # One visited_world row with an encrypted-looking token.
    visited_world_row = (1, 42, "gAAAAA_fake_encrypted_token")

    call_count = [0]

    def side_effect(stmt, *args, **kwargs):
        call_count[0] += 1
        if call_count[0] == 1:
            return iter([visited_world_row])
        return iter([])

    with patch("admin_tasks.create_engine") as mock_engine, \
         patch("admin_tasks.is_encrypted", return_value=True), \
         patch("admin_tasks.dec_json", return_value=["US", "CH"]):
        mock_conn = MagicMock()
        mock_conn.execute.side_effect = side_effect
        mock_engine.return_value.begin.return_value.__enter__ = lambda s: mock_conn
        mock_engine.return_value.begin.return_value.__exit__ = MagicMock(return_value=False)
        result = decrypt_all(FAKE_URL, FAKE_KEY)

    assert result["decrypted"] >= 1
