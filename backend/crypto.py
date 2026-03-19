# backend/crypto.py
import base64
import hashlib
import hmac
import json
import os

from cryptography.fernet import Fernet, InvalidToken

# Cache Fernet instances to avoid re-deriving the key on every enc()/dec() call.
# Keyed by (user_id, master_key_fingerprint) where the fingerprint is the first
# 4 bytes of the master key as hex — this ensures the cache auto-invalidates if
# the master key ever rotates (new fingerprint → cache miss → fresh derivation).
_FERNET_CACHE: dict[tuple[int, str], Fernet] = {}


def _get_fernet(user_id: int) -> Fernet:
    master_hex = os.environ["ENCRYPTION_MASTER_KEY"]
    fingerprint = master_hex[:8]  # first 4 bytes as hex chars
    cache_key = (user_id, fingerprint)
    if cache_key not in _FERNET_CACHE:
        master = bytes.fromhex(master_hex)
        digest = hmac.new(master, str(user_id).encode(), hashlib.sha256).digest()
        key = base64.urlsafe_b64encode(digest)
        _FERNET_CACHE[cache_key] = Fernet(key)
    return _FERNET_CACHE[cache_key]


def _derive_key(user_id: int) -> bytes:
    master = bytes.fromhex(os.environ["ENCRYPTION_MASTER_KEY"])
    digest = hmac.new(master, str(user_id).encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest)


def enc(user_id: int, plaintext: str) -> str:
    """Encrypt a string. Returns a Fernet token string."""
    return _get_fernet(user_id).encrypt(plaintext.encode()).decode()


def dec(user_id: int, token: str) -> str:
    """Decrypt a Fernet token string. Raises InvalidToken on failure."""
    return _get_fernet(user_id).decrypt(token.encode()).decode()


def enc_json(user_id: int, obj) -> str:
    """JSON-serialize obj then encrypt. Returns a Fernet token string."""
    return enc(user_id, json.dumps(obj, ensure_ascii=False))


def dec_json(user_id: int, token: str):
    """Decrypt a Fernet token then JSON-parse."""
    return json.loads(dec(user_id, token))


def is_encrypted(value) -> bool:
    """True if value is a Fernet token (starts with 'gAAAAA')."""
    return isinstance(value, str) and value.startswith("gAAAAA")


def dec_json_safe(user_id: int, value):
    """
    Decrypt an encrypted JSON value, or parse a legacy plaintext JSON string.
    Handles: Fernet token, JSON string (pre-migration), Python object (JSONB), None.
    """
    if value is None:
        return None
    if is_encrypted(value):
        return dec_json(user_id, value)
    if isinstance(value, str):
        return json.loads(value)
    return value  # already a Python object (JSONB not yet migrated)


def dec_str_safe(user_id: int, value):
    """
    Decrypt an encrypted string, or return the plaintext value as-is.
    Returns None if value is None.
    """
    if value is None:
        return None
    if is_encrypted(value):
        return dec(user_id, value)
    return value  # legacy plaintext
