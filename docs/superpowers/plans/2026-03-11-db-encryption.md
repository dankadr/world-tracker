# DB Encryption Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt all sensitive user travel data in PostgreSQL so the DB owner sees only Fernet ciphertext, while all app features continue working unchanged.

**Architecture:** A new `backend/crypto.py` derives a unique Fernet key per user via `HMAC-SHA256(master_key, user_id)`. The backend encrypts content columns before INSERT/UPDATE and decrypts after SELECT. A migration script handles the one-time JSONB→TEXT column type change and encrypts all existing rows.

**Tech Stack:** Python `cryptography.fernet` (already installed via `python-jose[cryptography]`), SQLAlchemy `Text` column, PostgreSQL `ALTER TABLE ... TYPE TEXT`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/crypto.py` | CREATE | Key derivation + enc/dec helpers |
| `backend/tests/test_crypto.py` | CREATE | Unit tests for crypto.py |
| `backend/models.py` | MODIFY | JSONB → Text for 5 columns |
| `backend/main.py` | MODIFY | Encrypt on write, decrypt on read |
| `backend/migrate_encrypt.py` | CREATE | One-shot migration + --decrypt rollback |
| `.env` | MODIFY | Add ENCRYPTION_MASTER_KEY |

**Columns encrypted** (content-only; query/constraint columns stay plaintext):

| Table | Encrypted |
|-------|-----------|
| `visited_world` | `countries` |
| `visited_regions` | `regions`, `dates`, `notes`, `wishlist` |
| `wishlist` | `priority`, `target_date`, `notes`, `category` |
| `xp_log` | `reason` |
| `users` | `name`, `picture` |

---

## Chunk 1: Crypto Module + Environment

### Task 1: Create backend/crypto.py

**Files:**
- Create: `backend/crypto.py`
- Create: `backend/tests/test_crypto.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_crypto.py`:

```python
import os
import json
import pytest
import secrets
from unittest.mock import patch

FAKE_KEY = secrets.token_hex(32)


@pytest.fixture(autouse=True)
def set_master_key():
    with patch.dict(os.environ, {"ENCRYPTION_MASTER_KEY": FAKE_KEY}):
        yield


def test_enc_dec_roundtrip():
    from backend.crypto import enc, dec
    token = enc(1, "hello world")
    assert dec(1, token) == "hello world"


def test_different_users_cannot_decrypt_each_other():
    from backend.crypto import enc, dec
    token = enc(1, "secret")
    with pytest.raises(Exception):
        dec(2, token)


def test_enc_json_dec_json_list():
    from backend.crypto import enc_json, dec_json
    data = ["ca", "us", "de"]
    assert dec_json(1, enc_json(1, data)) == data


def test_enc_json_dec_json_dict():
    from backend.crypto import enc_json, dec_json
    data = {"ca": "2024-01", "us": "2024-02"}
    assert dec_json(1, enc_json(1, data)) == data


def test_is_encrypted_detects_fernet_token():
    from backend.crypto import enc, is_encrypted
    assert is_encrypted(enc(1, "test")) is True


def test_is_encrypted_rejects_plaintext():
    from backend.crypto import is_encrypted
    assert is_encrypted('["ca","us"]') is False
    assert is_encrypted(None) is False
    assert is_encrypted("") is False


def test_dec_json_safe_handles_encrypted():
    from backend.crypto import enc_json, dec_json_safe
    token = enc_json(1, ["ca", "us"])
    assert dec_json_safe(1, token) == ["ca", "us"]


def test_dec_json_safe_handles_plaintext_json_string():
    from backend.crypto import dec_json_safe
    # Legacy data: JSON string not yet encrypted
    assert dec_json_safe(1, '["ca","us"]') == ["ca", "us"]


def test_dec_json_safe_handles_none():
    from backend.crypto import dec_json_safe
    assert dec_json_safe(1, None) is None


def test_dec_str_safe_handles_encrypted():
    from backend.crypto import enc, dec_str_safe
    assert dec_str_safe(1, enc(1, "medium")) == "medium"


def test_dec_str_safe_handles_plaintext():
    from backend.crypto import dec_str_safe
    assert dec_str_safe(1, "medium") == "medium"


def test_dec_str_safe_handles_none():
    from backend.crypto import dec_str_safe
    assert dec_str_safe(1, None) is None
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/dankadr/swiss-tracker && python -m pytest backend/tests/test_crypto.py -v 2>&1 | head -20
```
Expected: `ModuleNotFoundError: No module named 'backend.crypto'`

- [ ] **Step 3: Create `backend/crypto.py`**

```python
# backend/crypto.py
import base64
import hashlib
import hmac
import json
import os

from cryptography.fernet import Fernet, InvalidToken


def _derive_key(user_id: int) -> bytes:
    master = bytes.fromhex(os.environ["ENCRYPTION_MASTER_KEY"])
    digest = hmac.new(master, str(user_id).encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest)


def enc(user_id: int, plaintext: str) -> str:
    """Encrypt a string. Returns a Fernet token string."""
    return Fernet(_derive_key(user_id)).encrypt(plaintext.encode()).decode()


def dec(user_id: int, token: str) -> str:
    """Decrypt a Fernet token string. Raises InvalidToken on failure."""
    return Fernet(_derive_key(user_id)).decrypt(token.encode()).decode()


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
    if not value:
        return None
    if is_encrypted(value):
        return dec_json(user_id, value)
    if isinstance(value, str):
        return json.loads(value)
    return value  # already a Python object (JSONB not yet migrated)


def dec_str_safe(user_id: int, value):
    """
    Decrypt an encrypted string, or return the plaintext value as-is.
    Returns None if value is falsy.
    """
    if not value:
        return None
    if is_encrypted(value):
        return dec(user_id, value)
    return value  # legacy plaintext
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
python -m pytest backend/tests/test_crypto.py -v
```
Expected: 12 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/crypto.py backend/tests/test_crypto.py
git commit -m "feat(crypto): add per-user Fernet key derivation and safe decode helpers"
```

---

### Task 2: Add ENCRYPTION_MASTER_KEY to environment

**Files:**
- Modify: `.env`

- [ ] **Step 1: Generate master key**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Copy the 64-character hex output.

- [ ] **Step 2: Add to `.env`**

```
ENCRYPTION_MASTER_KEY=<paste-output-here>
```

- [ ] **Step 3: Verify `cryptography` is importable**

```bash
cd backend && python -c "from cryptography.fernet import Fernet; print('OK')"
```
Expected: `OK` (it's a dep of `python-jose[cryptography]`).

If it fails, add to `backend/requirements.txt`:
```
cryptography>=41.0.0
```

- [ ] **Step 4: Ensure `.env` is gitignored**

Check that `.env` is in `.gitignore` — **never commit a file containing the master encryption key to git**:

```bash
grep "^\.env$" .gitignore || echo "WARNING: .env is not gitignored!"
```

If not present, add it:
```
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: ensure .env is gitignored"
```

---

## Chunk 2: Model + Write Encryption

### Task 3: Update models.py — JSONB → Text for 5 columns

**Files:**
- Modify: `backend/models.py`

Fernet tokens are base64 strings — not valid JSON. The 5 JSONB columns that will hold them must become `Text`. The `_sync_add_missing_columns` function in `database.py` does NOT change column types, so this change only updates the ORM model; the actual DB column type is changed by the migration script in Task 7.

- [ ] **Step 1: Update imports**

In `backend/models.py` line 5, add `Text`. Keep the `JSONB` import — `Challenge.target_regions` (line 159) still uses it.

```python
# Before:
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, DateTime

# After:
from sqlalchemy import Column, Integer, String, Text, ForeignKey, UniqueConstraint, DateTime
```

`from sqlalchemy.dialects.postgresql import JSONB` — leave this line unchanged.

- [ ] **Step 2: Change the 5 column definitions**

`VisitedRegions` (lines 45–48):
```python
# Before:
regions = Column(JSONB, nullable=False, default=list)
dates = Column(JSONB, nullable=False, server_default="{}", default=dict)
notes = Column(JSONB, nullable=False, server_default="{}", default=dict)
wishlist = Column(JSONB, nullable=False, server_default="[]", default=list)

# After:
regions = Column(Text, nullable=False, default="[]")
dates = Column(Text, nullable=False, default="{}")
notes = Column(Text, nullable=False, default="{}")
wishlist = Column(Text, nullable=False, default="[]")
```

`VisitedWorld` (line 64):
```python
# Before:
countries = Column(JSONB, nullable=False, default=list)

# After:
countries = Column(Text, nullable=False, default="[]")
```

- [ ] **Step 3: Confirm no import errors**

```bash
cd backend && python -c "from models import VisitedRegions, VisitedWorld; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat(models): change visited JSONB columns to Text for Fernet token storage"
```

---

### Task 4: Encrypt writes in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add import at top of main.py**

Find the block of local imports (near `from models import ...`) and add:
```python
try:
    from backend.crypto import enc, enc_json, dec_json_safe, dec_str_safe, is_encrypted
except ImportError:
    from crypto import enc, enc_json, dec_json_safe, dec_str_safe, is_encrypted
```

- [ ] **Step 2: Encrypt `google_login` — users.name and users.picture (lines 272–289)**

The key pattern: `user.id` is available after `db.flush()` (already at line 282). Move name/picture assignment to after the flush so we have the user id.

```python
# Before (lines 272–289):
if user:
    user.email = email
    user.name = name
    user.picture = picture
    ...
else:
    user = User(google_id=google_id, email=email, name=name, picture=picture)
    db.add(user)
    ...
await db.flush()
await db.commit()
return GoogleLoginResponse(
    jwt_token=jwt_token,
    user={"id": user.id, "email": user.email, "name": user.name, "picture": user.picture},
)

# After:
if user:
    user.email = email
    # name/picture set after flush (need user.id for key derivation)
else:
    user = User(google_id=google_id, email=email, name=None, picture=None)
    db.add(user)
    ...
await db.flush()  # user.id is now available for both new and existing users
uid = user.id
user.name = enc(uid, name) if name else None
user.picture = enc(uid, picture) if picture else None
await db.commit()
return GoogleLoginResponse(
    jwt_token=jwt_token,
    user={"id": uid, "email": user.email, "name": name, "picture": picture},  # return plaintext
)
```

- [ ] **Step 3: Encrypt `put_visited` — visited_regions (around lines 382–409)**

This endpoint has two paths: update existing record and create new record. The update path uses `is not None` guards — preserve them.

```python
uid = user.id

# Update path (lines 382–390) — before:
if record:
    record.regions = body.regions
    if body.dates is not None:
        record.dates = body.dates
    if body.notes is not None:
        record.notes = body.notes
    if body.wishlist is not None:
        record.wishlist = body.wishlist

# After:
if record:
    record.regions = enc_json(uid, body.regions)
    if body.dates is not None:
        record.dates = enc_json(uid, body.dates)
    if body.notes is not None:
        record.notes = enc_json(uid, body.notes)
    if body.wishlist is not None:
        record.wishlist = enc_json(uid, body.wishlist)

# Create path (lines 392–400) — after:
else:
    record = VisitedRegions(
        user_id=uid,
        country_id=country_id,
        regions=enc_json(uid, body.regions),
        dates=enc_json(uid, body.dates or {}),
        notes=enc_json(uid, body.notes or {}),
        wishlist=enc_json(uid, body.wishlist or []),
    )
    db.add(record)

# Response (lines 403–409): return body values, not record fields (which now hold ciphertext):
return VisitedResponse(
    country_id=country_id,
    regions=body.regions,
    dates=body.dates or {},
    notes=body.notes or {},
    wishlist=body.wishlist or [],
)
```

- [ ] **Step 4: Encrypt `patch_visited_region` — visited_regions (around lines 440–465)**

```python
uid = user.id

# Before:
regions = list(record.regions or [])
dates = dict(record.dates or {})
notes = dict(record.notes or {})
# ... modify them ...
record.regions = regions
record.dates = dates
record.notes = notes
await db.commit()
return VisitedResponse(regions=record.regions or [], dates=record.dates or {}, notes=record.notes or {}, ...)

# After:
regions = dec_json_safe(uid, record.regions) or []
dates = dec_json_safe(uid, record.dates) or {}
notes = dec_json_safe(uid, record.notes) or {}
# ... modify them (no other changes) ...
record.regions = enc_json(uid, regions)
record.dates = enc_json(uid, dates)
record.notes = enc_json(uid, notes)
await db.commit()
return VisitedResponse(regions=regions, dates=dates, notes=notes, ...)  # use local vars
```

- [ ] **Step 5: Encrypt `patch_visited_wishlist` — visited_regions.wishlist (around lines 500–525)**

```python
uid = user.id

# Before:
wishlist = list(record.wishlist or [])
# ... modify ...
record.wishlist = wishlist
await db.commit()
return VisitedResponse(wishlist=record.wishlist or [], regions=record.regions or [], ...)

# After:
wishlist = dec_json_safe(uid, record.wishlist) or []
# ... modify (no other changes) ...
record.wishlist = enc_json(uid, wishlist)
await db.commit()
return VisitedResponse(
    wishlist=wishlist,
    regions=dec_json_safe(uid, record.regions) or [],
    dates=dec_json_safe(uid, record.dates) or {},
    notes=dec_json_safe(uid, record.notes) or {},
)
```

- [ ] **Step 6: Encrypt `patch_visited_world` — visited_world.countries (around lines 540–556)**

```python
uid = user.id

# Before:
countries = list(record.countries or [])
# ...
record.countries = countries
await db.commit()
return WorldVisitedResponse(countries=record.countries)

# After:
countries = dec_json_safe(uid, record.countries) or []
# ...
record.countries = enc_json(uid, countries)
await db.commit()
return WorldVisitedResponse(countries=countries)  # use local var
```

- [ ] **Step 7: Encrypt `put_visited_world` — visited_world.countries (around lines 700–716)**

```python
uid = user.id

# Before:
record.countries = body.countries
# ...
return WorldVisitedResponse(countries=record.countries)

# After:
record.countries = enc_json(uid, body.countries)
# ...
return WorldVisitedResponse(countries=body.countries)
```

- [ ] **Step 8: Encrypt `batch_actions` — visited_world, visited_regions, and wishlist_upsert (around lines 590–660)**

For the `visited_regions` part:
```python
uid = user.id

# Before:
regions = list(record.regions or [])
dates = dict(record.dates or {})
notes = dict(record.notes or {})
# ...
record.regions = regions
record.dates = dates
record.notes = notes

# After:
regions = dec_json_safe(uid, record.regions) or []
dates = dec_json_safe(uid, record.dates) or {}
notes = dec_json_safe(uid, record.notes) or {}
# ...
record.regions = enc_json(uid, regions)
record.dates = enc_json(uid, dates)
record.notes = enc_json(uid, notes)
```

For the `visited_world` part:
```python
# Before:
countries_list = list(record.countries or [])
# ...
record.countries = countries_list

# After:
countries_list = dec_json_safe(uid, record.countries) or []
# ...
record.countries = enc_json(uid, countries_list)
```

For the `wishlist_upsert` action (lines 633–659) — this path also writes wishlist columns in plaintext. Encrypt them:
```python
# Before (lines 648–658):
if wi:
    wi.priority = priority
    wi.target_date = target_date
    wi.notes = notes_val
    wi.category = category
else:
    wi = WishlistItem(
        user_id=user.id, tracker_id=tracker_id, region_id=region_id,
        priority=priority, target_date=target_date, notes=notes_val, category=category,
    )
    db.add(wi)

# After:
if wi:
    wi.priority = enc(uid, priority)
    wi.target_date = enc(uid, target_date) if target_date else None
    wi.notes = enc(uid, notes_val) if notes_val else None
    wi.category = enc(uid, category)
    wi.updated_at = datetime.now(timezone.utc)
else:
    wi = WishlistItem(
        user_id=uid, tracker_id=tracker_id, region_id=region_id,
        priority=enc(uid, priority),
        target_date=enc(uid, target_date) if target_date else None,
        notes=enc(uid, notes_val) if notes_val else None,
        category=enc(uid, category),
    )
    db.add(wi)
```

- [ ] **Step 9: Encrypt wishlist `upsert_wishlist_item` (lines 1512–1539)**

```python
uid = user.id

# Update path (lines 1512–1517) — after:
if item:
    item.priority = enc(uid, body.priority)
    item.target_date = enc(uid, body.target_date) if body.target_date else None
    item.notes = enc(uid, body.notes) if body.notes else None
    item.category = enc(uid, body.category)
    item.updated_at = datetime.now(timezone.utc)

# Create path (lines 1519–1528) — after:
else:
    item = WishlistItem(
        user_id=uid, tracker_id=tracker_id, region_id=region_id,
        priority=enc(uid, body.priority),
        target_date=enc(uid, body.target_date) if body.target_date else None,
        notes=enc(uid, body.notes) if body.notes else None,
        category=enc(uid, body.category),
    )
    db.add(item)

# Response (lines 1531–1539): return plaintext body values, not item.field (which now holds ciphertext):
await db.commit()
return {
    "tracker_id": item.tracker_id,
    "region_id": item.region_id,
    "priority": body.priority,
    "target_date": body.target_date,
    "notes": body.notes,
    "category": body.category,
    "created_at": item.created_at.isoformat() if item.created_at else None,
}
```

- [ ] **Step 10: Encrypt wishlist `patch_wishlist_item` (lines 1562–1586)**

Preserve the existing `is not None` guards from the actual code. Also fix the response to decrypt before returning.

```python
uid = user.id

# After (lines 1562–1573) — use is not None, same as existing code:
if body.priority is not None:
    if body.priority not in ("high", "medium", "low"):
        raise HTTPException(400, "priority must be 'high', 'medium', or 'low'")
    item.priority = enc(uid, body.priority)
if body.target_date is not None:
    item.target_date = enc(uid, body.target_date) if body.target_date else None
if body.notes is not None:
    item.notes = enc(uid, body.notes) if body.notes else None
if body.category is not None:
    if body.category not in ("solo", "friends", "family", "work"):
        raise HTTPException(400, "category must be 'solo', 'friends', 'family', or 'work'")
    item.category = enc(uid, body.category)

# Response (lines 1578–1586): decrypt before returning — item.field now holds ciphertext:
return {
    "tracker_id": item.tracker_id,
    "region_id": item.region_id,
    "priority": dec_str_safe(uid, item.priority),
    "target_date": dec_str_safe(uid, item.target_date),
    "notes": dec_str_safe(uid, item.notes),
    "category": dec_str_safe(uid, item.category),
    "created_at": item.created_at.isoformat() if item.created_at else None,
}
```

- [ ] **Step 11: Encrypt `xp_log.reason` — in `add_user_xp` (around line 1702)**

```python
# Before:
log = XpLog(user_id=user_id, amount=amount, reason=body.reason, ...)

# After:
log = XpLog(user_id=user_id, amount=amount, reason=enc(user_id, body.reason), ...)
```

For challenge completion XP logs (around lines 1144 and 1166), the `user_id` is the participant's id (variable name depends on the loop — check the local scope and use the participant's user_id):
```python
# Before:
reason="complete_challenge"
# or:
reason=f"complete_challenge_rank{i+1}"

# After:
reason=enc(participant_user_id, "complete_challenge")
# or:
reason=enc(participant_user_id, f"complete_challenge_rank{i+1}")
```

- [ ] **Step 12: Verify import + syntax**

```bash
cd backend && python -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 13: Commit**

```bash
git add backend/main.py
git commit -m "feat(main): encrypt sensitive columns on all DB writes"
```

---

## Chunk 3: Read Decryption

### Task 5: Decrypt own-user reads in main.py

**Files:**
- Modify: `backend/main.py`

Pattern: after fetching a record, decrypt before using the value. Use `dec_json_safe` for JSON columns and `dec_str_safe` for string columns.

- [ ] **Step 1: Decrypt `get_all_visited` (around lines 307–322)**

```python
uid = user.id

# Before:
regions_data[r.country_id] = {
    "regions": r.regions or [],
    "dates": r.dates or {},
    "notes": r.notes or {},
    "wishlist": r.wishlist or [],
}
world_countries = world_record.countries if world_record else []

# After:
regions_data[r.country_id] = {
    "regions": dec_json_safe(uid, r.regions) or [],
    "dates": dec_json_safe(uid, r.dates) or {},
    "notes": dec_json_safe(uid, r.notes) or {},
    "wishlist": dec_json_safe(uid, r.wishlist) or [],
}
world_countries = dec_json_safe(uid, world_record.countries) if world_record and world_record.countries else []
```

- [ ] **Step 2: Decrypt `get_visited` (around lines 357–360)**

```python
uid = user.id

# Before:
regions = record.regions if record else []
dates = record.dates if record and record.dates else {}
notes = record.notes if record and record.notes else {}
wishlist = record.wishlist if record and record.wishlist else []

# After:
regions = dec_json_safe(uid, record.regions) if record else []
dates = dec_json_safe(uid, record.dates) if record else {}
notes = dec_json_safe(uid, record.notes) if record else {}
wishlist = dec_json_safe(uid, record.wishlist) if record else []
```

- [ ] **Step 3: Decrypt `get_visited_world` (around line 693)**

```python
# Before:
countries = record.countries if record else []

# After:
countries = dec_json_safe(user.id, record.countries) if record and record.countries else []
```

- [ ] **Step 4: Decrypt `get_me` (around lines 736–741)**

```python
uid = db_user.id

# Before:
"name": db_user.name,
"picture": db_user.picture,
countries_count = len(world_row.countries) if world_row else 0

# After:
"name": dec_str_safe(uid, db_user.name),
"picture": dec_str_safe(uid, db_user.picture),
countries_count = len(dec_json_safe(uid, world_row.countries) or []) if world_row and world_row.countries else 0
```

- [ ] **Step 5: Decrypt wishlist reads — `get_all_wishlist` and `get_wishlist_for_tracker` (around lines 1452–1482)**

```python
uid = user.id

# Before:
"priority": item.priority,
"target_date": item.target_date,
"notes": item.notes,
"category": item.category,

# After:
"priority": dec_str_safe(uid, item.priority),
"target_date": dec_str_safe(uid, item.target_date),
"notes": dec_str_safe(uid, item.notes),
"category": dec_str_safe(uid, item.category),
```

Apply this pattern to all 4 wishlist response-building blocks (get_all_wishlist, get_wishlist_for_tracker, upsert response, patch response).

- [ ] **Step 6: Commit**

```bash
git add backend/main.py
git commit -m "feat(main): decrypt own-user reads on all DB fetches"
```

---

### Task 6: Decrypt cross-user reads in main.py

**Files:**
- Modify: `backend/main.py`

**Critical:** Use the *target user's* id for decryption, not `current_user.id`. The backend derives per-user keys, so it can decrypt any user's data.

- [ ] **Step 1: Decrypt `get_user_by_code` (around line 754)**

```python
# Before:
return {"id": target.id, "name": target.name, "picture": target.picture}

# After:
return {"id": target.id, "name": dec_str_safe(target.id, target.name), "picture": dec_str_safe(target.id, target.picture)}
```

- [ ] **Step 2: Decrypt `send_friend_request` response (around line 795)**

```python
# Before:
"to_user": {"id": target.id, "name": target.name, "picture": target.picture}

# After:
"to_user": {"id": target.id, "name": dec_str_safe(target.id, target.name), "picture": dec_str_safe(target.id, target.picture)}
```

- [ ] **Step 3: Decrypt `get_friend_requests` (around lines 814–820)**

```python
# Before:
"from_user": {"id": u.id, "name": u.name, "picture": u.picture}
"to_user":   {"id": u.id, "name": u.name, "picture": u.picture}

# After:
"from_user": {"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture)}
"to_user":   {"id": u.id, "name": dec_str_safe(u.id, u.name), "picture": dec_str_safe(u.id, u.picture)}
```

- [ ] **Step 4: Decrypt `get_friends` (around lines 882–890)**

```python
# Before:
"id": u.id, "name": u.name, "picture": u.picture,
"countries_count": len(world.countries) if world else 0,

# After (u is the friend, world is their VisitedWorld record):
"id": u.id,
"name": dec_str_safe(u.id, u.name),
"picture": dec_str_safe(u.id, u.picture),
"countries_count": len(dec_json_safe(u.id, world.countries) or []) if world and world.countries else 0,
```

- [ ] **Step 5: Decrypt `get_friend_visited` (lines 908–927)**

The actual function is `get_friend_visited` (line 908), which takes `friend_id: int` — there is no `target` User object in scope. The response does not include name/picture.

```python
# Line 919 — before:
regions = [{"country_id": r.country_id, "regions": r.regions} for r in regions_result.scalars().all()]

# Line 926 — before:
"world": {"countries": world.countries if world else []},

# After:
regions = [
    {"country_id": r.country_id, "regions": dec_json_safe(friend_id, r.regions) or []}
    for r in regions_result.scalars().all()
]
# ...
"world": {"countries": dec_json_safe(friend_id, world.countries) if world and world.countries else []},
```

- [ ] **Step 6: Decrypt `get_leaderboard` (around lines 945–951)**

```python
# Before:
regions_count = sum(len(r.regions) for r in regions_result.scalars().all())
countries_count = len(world.countries) if world else 0
"name": u.name, "picture": u.picture,

# After (u is the leaderboard User object):
regions_list = regions_result.scalars().all()
regions_count = sum(len(dec_json_safe(u.id, r.regions) or []) for r in regions_list)
countries_count = len(dec_json_safe(u.id, world.countries) or []) if world and world.countries else 0
"name": dec_str_safe(u.id, u.name),
"picture": dec_str_safe(u.id, u.picture),
```

- [ ] **Step 7: Decrypt `get_activity_feed` (around lines 989–1005)**

```python
# Before:
"name": u.name, "picture": u.picture,
"count": len(w.countries),

# After:
"name": dec_str_safe(u.id, u.name),
"picture": dec_str_safe(u.id, u.picture),
"count": len(dec_json_safe(u.id, w.countries) or []),
```

- [ ] **Step 8: Decrypt `_get_visited_for_user` (lines 1036–1052)**

The actual function name is `_get_visited_for_user` (line 1036), not `get_challenge_data_internal`. Its parameter is `user_id`.

```python
# Line 1044 — before:
regions[r.country_id] = r.regions or []

# Line 1050 — before:
world = world_record.countries if world_record else []

# After:
regions[r.country_id] = dec_json_safe(user_id, r.regions) or []
# ...
world = dec_json_safe(user_id, world_record.countries) if world_record and world_record.countries else []
```

- [ ] **Step 9: Decrypt participant name/picture in challenge endpoints (lines ~1087, ~1210, ~1339)**

```python
# Before:
"name": u.name, "picture": u.picture,

# After:
"name": dec_str_safe(u.id, u.name),
"picture": dec_str_safe(u.id, u.picture),
```

- [ ] **Step 10: Verify syntax**

```bash
cd backend && python -c "import main; print('OK')"
```

- [ ] **Step 11: Commit**

```bash
git add backend/main.py
git commit -m "feat(main): decrypt cross-user reads using per-user keys"
```

---

## Chunk 4: Migration Tool

### Task 7: Create backend/migrate_encrypt.py

**Files:**
- Create: `backend/migrate_encrypt.py`

- [ ] **Step 1: Create the migration script**

```python
#!/usr/bin/env python3
"""
One-shot DB migration: encrypt all sensitive columns.

Run:     python backend/migrate_encrypt.py
Rollback: python backend/migrate_encrypt.py --decrypt

Requires: DATABASE_URL, ENCRYPTION_MASTER_KEY in environment (or .env file).
Safe to re-run — already-encrypted rows are skipped.
"""
import argparse
import json
import os
import sys

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from sqlalchemy import create_engine, text

# Sync URL for migration (swap asyncpg driver)
_db_url = os.environ["DATABASE_URL"].replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(_db_url, echo=False)

# Add backend/ to path so crypto.py is importable when run from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from crypto import enc, dec, enc_json, dec_json, is_encrypted  # noqa: E402


# ── Column type helpers ──────────────────────────────────────────────────────

JSONB_COLUMNS = [
    ("visited_world", "countries"),
    ("visited_regions", "regions"),
    ("visited_regions", "dates"),
    ("visited_regions", "notes"),
    ("visited_regions", "wishlist"),
]


def _col_type(conn, table, col):
    row = conn.execute(
        text("SELECT data_type FROM information_schema.columns WHERE table_name=:t AND column_name=:c"),
        {"t": table, "c": col},
    ).fetchone()
    return row[0] if row else None


def alter_jsonb_to_text(conn):
    for table, col in JSONB_COLUMNS:
        ct = _col_type(conn, table, col)
        if ct == "jsonb":
            print(f"  ALTER  {table}.{col}: jsonb → text")
            conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" TYPE TEXT USING "{col}"::TEXT'))
        else:
            print(f"  SKIP   {table}.{col}: already {ct}")


def alter_text_to_jsonb(conn):
    for table, col in JSONB_COLUMNS:
        ct = _col_type(conn, table, col)
        if ct == "text":
            print(f"  ALTER  {table}.{col}: text → jsonb")
            conn.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" TYPE JSONB USING "{col}"::JSONB'))
        else:
            print(f"  SKIP   {table}.{col}: already {ct}")


# ── Encrypt helpers ──────────────────────────────────────────────────────────

def _enc_json_col(conn, table, col, user_id, row_id, val):
    if val and not is_encrypted(val):
        obj = json.loads(val) if isinstance(val, str) else val
        conn.execute(
            text(f'UPDATE "{table}" SET "{col}" = :v WHERE id = :id'),
            {"v": enc_json(user_id, obj), "id": row_id},
        )
        return True
    return False


def _enc_str_col(conn, table, col, user_id, row_id, val):
    if val and not is_encrypted(val):
        conn.execute(
            text(f'UPDATE "{table}" SET "{col}" = :v WHERE id = :id'),
            {"v": enc(user_id, val), "id": row_id},
        )
        return True
    return False


def encrypt_visited_world(conn):
    rows = conn.execute(text("SELECT id, user_id, countries FROM visited_world")).fetchall()
    n = sum(_enc_json_col(conn, "visited_world", "countries", uid, rid, c) for rid, uid, c in rows)
    print(f"  visited_world.countries: {n}/{len(rows)} rows encrypted")


def encrypt_visited_regions(conn):
    rows = conn.execute(text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")).fetchall()
    n = 0
    for rid, uid, regions, dates, notes, wishlist in rows:
        updates = {}
        for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
            if val and not is_encrypted(val):
                obj = json.loads(val) if isinstance(val, str) else val
                updates[col] = enc_json(uid, obj)
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = rid
            conn.execute(text(f'UPDATE visited_regions SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  visited_regions: {n}/{len(rows)} rows encrypted")


def encrypt_wishlist(conn):
    rows = conn.execute(text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")).fetchall()
    n = 0
    for rid, uid, priority, target_date, notes, category in rows:
        updates = {}
        for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
            if val and not is_encrypted(val):
                updates[col] = enc(uid, val)
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = rid
            conn.execute(text(f'UPDATE wishlist SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  wishlist: {n}/{len(rows)} rows encrypted")


def encrypt_xp_log(conn):
    rows = conn.execute(text("SELECT id, user_id, reason FROM xp_log")).fetchall()
    n = sum(_enc_str_col(conn, "xp_log", "reason", uid, rid, r) for rid, uid, r in rows)
    print(f"  xp_log.reason: {n}/{len(rows)} rows encrypted")


def encrypt_users(conn):
    rows = conn.execute(text("SELECT id, name, picture FROM users")).fetchall()
    n = 0
    for uid, name, picture in rows:
        updates = {}
        if name and not is_encrypted(name):
            updates["name"] = enc(uid, name)
        if picture and not is_encrypted(picture):
            updates["picture"] = enc(uid, picture)
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = uid
            conn.execute(text(f'UPDATE users SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  users: {n}/{len(rows)} rows encrypted")


# ── Decrypt helpers ──────────────────────────────────────────────────────────

def decrypt_visited_world(conn):
    rows = conn.execute(text("SELECT id, user_id, countries FROM visited_world")).fetchall()
    n = 0
    for rid, uid, countries in rows:
        if countries and is_encrypted(countries):
            conn.execute(
                text('UPDATE visited_world SET countries = :c WHERE id = :id'),
                {"c": json.dumps(dec_json(uid, countries)), "id": rid},
            )
            n += 1
    print(f"  visited_world.countries: {n}/{len(rows)} rows decrypted")


def decrypt_visited_regions(conn):
    rows = conn.execute(text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")).fetchall()
    n = 0
    for rid, uid, regions, dates, notes, wishlist in rows:
        updates = {}
        for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
            if val and is_encrypted(val):
                updates[col] = json.dumps(dec_json(uid, val))
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = rid
            conn.execute(text(f'UPDATE visited_regions SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  visited_regions: {n}/{len(rows)} rows decrypted")


def decrypt_wishlist(conn):
    rows = conn.execute(text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")).fetchall()
    n = 0
    for rid, uid, priority, target_date, notes, category in rows:
        updates = {}
        for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
            if val and is_encrypted(val):
                updates[col] = dec(uid, val)
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = rid
            conn.execute(text(f'UPDATE wishlist SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  wishlist: {n}/{len(rows)} rows decrypted")


def decrypt_xp_log(conn):
    rows = conn.execute(text("SELECT id, user_id, reason FROM xp_log")).fetchall()
    n = 0
    for rid, uid, reason in rows:
        if reason and is_encrypted(reason):
            conn.execute(text('UPDATE xp_log SET reason = :r WHERE id = :id'), {"r": dec(uid, reason), "id": rid})
            n += 1
    print(f"  xp_log.reason: {n}/{len(rows)} rows decrypted")


def decrypt_users(conn):
    rows = conn.execute(text("SELECT id, name, picture FROM users")).fetchall()
    n = 0
    for uid, name, picture in rows:
        updates = {}
        if name and is_encrypted(name):
            updates["name"] = dec(uid, name)
        if picture and is_encrypted(picture):
            updates["picture"] = dec(uid, picture)
        if updates:
            set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
            updates["id"] = uid
            conn.execute(text(f'UPDATE users SET {set_clause} WHERE id = :id'), updates)
            n += 1
    print(f"  users: {n}/{len(rows)} rows decrypted")


# ── Entry points ─────────────────────────────────────────────────────────────

def run_encrypt():
    print("=== Encrypting DB ===")
    with engine.begin() as conn:
        print("Altering JSONB → TEXT...")
        alter_jsonb_to_text(conn)
        print("Encrypting rows...")
        encrypt_visited_world(conn)
        encrypt_visited_regions(conn)
        encrypt_wishlist(conn)
        encrypt_xp_log(conn)
        encrypt_users(conn)
    print("Done. ✓")


def run_decrypt():
    print("=== Decrypting DB (rollback) ===")
    with engine.begin() as conn:
        print("Decrypting rows...")
        decrypt_visited_world(conn)
        decrypt_visited_regions(conn)
        decrypt_wishlist(conn)
        decrypt_xp_log(conn)
        decrypt_users(conn)
        print("Altering TEXT → JSONB...")
        alter_text_to_jsonb(conn)
    print("Done. ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encrypt or decrypt sensitive DB columns.")
    parser.add_argument("--decrypt", action="store_true", help="Rollback: decrypt all data")
    args = parser.parse_args()
    if args.decrypt:
        run_decrypt()
    else:
        run_encrypt()
```

- [ ] **Step 2: Verify script imports without error**

```bash
cd /Users/dankadr/swiss-tracker && python -c "import backend.migrate_encrypt" 2>&1 | head -5
```
Expected: no errors (may print nothing or `Done`)

- [ ] **Step 3: Commit**

```bash
git add backend/migrate_encrypt.py
git commit -m "feat(migrate): add encrypt/decrypt migration script for DB columns"
```

---

### Task 8: Run migration + smoke test

- [ ] **Step 1: Run migration against local/staging DB**

```bash
cd /Users/dankadr/swiss-tracker && python backend/migrate_encrypt.py
```
Expected output:
```
=== Encrypting DB ===
Altering JSONB → TEXT...
  ALTER  visited_world.countries: jsonb → text
  ALTER  visited_regions.regions: jsonb → text
  ...
Encrypting rows...
  visited_world.countries: 8/8 rows encrypted
  ...
Done. ✓
```

- [ ] **Step 2: Verify ciphertext in Neon dashboard**

Open Neon → Tables → `visited_world`. The `countries` column should now show Fernet tokens like `gAAAAABn...` instead of `["ca","us"]`.

- [ ] **Step 3: Start backend and test API**

```bash
cd backend && uvicorn main:app --reload
```

In another terminal (replace `<token>` with a valid JWT):
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/visited/all
```
Expected: normal JSON response with readable country arrays, not ciphertext.

- [ ] **Step 4: Test rollback (optional — run on non-production only)**

```bash
python backend/migrate_encrypt.py --decrypt
# Verify plaintext in Neon dashboard
python backend/migrate_encrypt.py  # re-encrypt
```

- [ ] **Step 5: Add ENCRYPTION_MASTER_KEY to Vercel**

```bash
vercel env add ENCRYPTION_MASTER_KEY production
# paste the same key from .env
```

- [ ] **Step 6: Run migration against production DB**

```bash
DATABASE_URL=<production-neon-url> ENCRYPTION_MASTER_KEY=<key> python backend/migrate_encrypt.py
```

- [ ] **Step 7: Deploy**

```bash
vercel deploy --prod
```

- [ ] **Step 8: Final commit**

```bash
git add backend/ docs/
git commit -m "feat(security): encrypt all sensitive user data columns at rest in DB"
```
