import os
import json
import pytest
import secrets
from unittest.mock import patch
from cryptography.fernet import InvalidToken

FAKE_KEY = secrets.token_hex(32)


@pytest.fixture(autouse=True)
def set_master_key():
    with patch.dict(os.environ, {"ENCRYPTION_MASTER_KEY": FAKE_KEY}):
        yield


def test_enc_dec_roundtrip():
    from crypto import enc, dec
    token = enc(1, "hello world")
    assert dec(1, token) == "hello world"


def test_different_users_cannot_decrypt_each_other():
    from crypto import enc, dec
    token = enc(1, "secret")
    with pytest.raises(InvalidToken):
        dec(2, token)


def test_enc_json_dec_json_list():
    from crypto import enc_json, dec_json
    data = ["ca", "us", "de"]
    assert dec_json(1, enc_json(1, data)) == data


def test_enc_json_dec_json_dict():
    from crypto import enc_json, dec_json
    data = {"ca": "2024-01", "us": "2024-02"}
    assert dec_json(1, enc_json(1, data)) == data


def test_is_encrypted_detects_fernet_token():
    from crypto import enc, is_encrypted
    assert is_encrypted(enc(1, "test")) is True


def test_is_encrypted_rejects_plaintext():
    from crypto import is_encrypted
    assert is_encrypted('["ca","us"]') is False
    assert is_encrypted(None) is False
    assert is_encrypted("") is False


def test_dec_json_safe_handles_encrypted():
    from crypto import enc_json, dec_json_safe
    token = enc_json(1, ["ca", "us"])
    assert dec_json_safe(1, token) == ["ca", "us"]


def test_dec_json_safe_handles_plaintext_json_string():
    from crypto import dec_json_safe
    assert dec_json_safe(1, '["ca","us"]') == ["ca", "us"]


def test_dec_json_safe_handles_none():
    from crypto import dec_json_safe
    assert dec_json_safe(1, None) is None


def test_dec_str_safe_handles_encrypted():
    from crypto import enc, dec_str_safe
    assert dec_str_safe(1, enc(1, "medium")) == "medium"


def test_dec_str_safe_handles_plaintext():
    from crypto import dec_str_safe
    assert dec_str_safe(1, "medium") == "medium"


def test_dec_str_safe_handles_none():
    from crypto import dec_str_safe
    assert dec_str_safe(1, None) is None


def test_fernet_cache_avoids_redundant_key_derivation():
    """Calling enc() twice for the same user reuses the cached Fernet instance."""
    from crypto import enc, _FERNET_CACHE
    _FERNET_CACHE.clear()

    enc(99, "first call")
    assert len(_FERNET_CACHE) == 1, "Cache should have one entry after first call"

    enc(99, "second call")
    assert len(_FERNET_CACHE) == 1, "Cache should still have one entry (reused)"


def test_fernet_cache_is_keyed_by_user_and_fingerprint():
    """Different users get separate cache entries; same user reuses the same entry."""
    from crypto import enc, _FERNET_CACHE
    _FERNET_CACHE.clear()

    enc(1, "user 1")
    enc(2, "user 2")
    assert len(_FERNET_CACHE) == 2, "Each user should have a separate cache entry"

    enc(1, "user 1 again")
    assert len(_FERNET_CACHE) == 2, "No new entry for existing user"
