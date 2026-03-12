import os
import pytest
from unittest.mock import patch, MagicMock

FAKE_KEY = "74ee4f1e475572aaacd95d276c0ec69730c7c051001a318d39584fd7d83c76ea"
FAKE_URL = "postgresql://user:pass@localhost/test"


def test_encrypt_all_returns_dict():
    """encrypt_all returns a dict with expected keys."""
    from backend.admin_tasks import encrypt_all
    # We call with a mock engine to avoid needing a real DB
    with patch("backend.admin_tasks.create_engine") as mock_engine:
        mock_conn = MagicMock()
        mock_conn.execute.return_value.fetchall.return_value = []
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
    from backend.admin_tasks import decrypt_all
    with patch("backend.admin_tasks.create_engine") as mock_engine:
        mock_conn = MagicMock()
        mock_conn.execute.return_value.fetchall.return_value = []
        mock_engine.return_value.begin.return_value.__enter__ = lambda s: mock_conn
        mock_engine.return_value.begin.return_value.__exit__ = MagicMock(return_value=False)
        result = decrypt_all(FAKE_URL, FAKE_KEY)
    assert "decrypted" in result
    assert "skipped" in result
    assert "errors" in result
    assert isinstance(result["decrypted"], int)
    assert isinstance(result["skipped"], int)
    assert isinstance(result["errors"], int)
