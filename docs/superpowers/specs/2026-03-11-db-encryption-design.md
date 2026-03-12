# DB Encryption Design

**Date**: 2026-03-11
**Status**: Approved

## Goal

Encrypt sensitive user travel data in the Neon PostgreSQL database so that the DB owner cannot read plaintext user data from the Neon dashboard. All backend features (friends, challenges, XP, social) must continue to work unchanged. No frontend changes required.

## Approach

Application-level encryption in the Python backend using **per-user derived keys**.

A single `ENCRYPTION_MASTER_KEY` env var is used to derive a unique Fernet key per user via `HMAC-SHA256(master_key, user_id)`. The backend encrypts content columns before INSERT and decrypts after SELECT, transparently. The frontend and all social features are unaffected.

## Architecture

```
ENCRYPTION_MASTER_KEY (env var, 32 bytes as hex)
        │
        ▼
HMAC-SHA256(master_key_bytes, str(user_id).encode())  →  32-byte derived key
        │
        ▼
base64url(derived_key)  →  Fernet key
        │
        ├── encrypt(json_string)  →  TEXT blob stored in DB
        └── decrypt(TEXT blob)    →  original json_string
```

**Library**: `cryptography.fernet` (Fernet = AES-128-CBC + HMAC-SHA256)

**New file**: `backend/crypto.py` — exposes `encrypt(user_id, plaintext) → str` and `decrypt(user_id, token) → str`

## What Gets Encrypted

Only content fields. Columns used in `WHERE` clauses, unique constraints, or foreign keys stay plaintext.

| Table | Encrypted columns | Left plaintext |
|---|---|---|
| `visited_world` | `countries` | `user_id`, `updated_at` |
| `visited_regions` | `regions`, `dates`, `notes`, `wishlist` | `user_id`, `country_id`, `updated_at` |
| `wishlist` | `notes`, `priority`, `target_date`, `category` | `user_id`, `tracker_id`, `region_id` |
| `xp_log` | `reason` | `user_id`, `amount`, `tracker_id`, `created_at` |
| `users` | `name`, `picture` | `email`, `google_id` |

`challenges`, `friendships`, `friend_requests`, `challenge_participants` — left fully plaintext (no personal travel data).

**Column type changes**: `visited_world.countries` and all four `visited_regions` JSONB columns (`regions`, `dates`, `notes`, `wishlist`) change from `JSONB → TEXT`.

## Key Management

- `ENCRYPTION_MASTER_KEY` — 32 random bytes stored as a hex string
- Generated once: `python -c "import secrets; print(secrets.token_hex(32))"`
- Added to `.env` locally and Vercel/deployment env vars
- Derived keys are never stored — computed on the fly per request
- No key rotation in scope (YAGNI)

## Migration Tool

`backend/migrate_encrypt.py` — run once manually after deploying the new code.

**Behaviour:**
1. Reads `DATABASE_URL` and `ENCRYPTION_MASTER_KEY` from env
2. Fetches all users
3. For each user: reads plaintext rows → encrypts each content column → writes back
4. **Idempotent**: detects already-encrypted rows (Fernet tokens start with `gAAAAA`) and skips them
5. Safe to re-run at any time

**Rollback flag**: `python backend/migrate_encrypt.py --decrypt` reverses all rows back to plaintext.

## What Does NOT Change

- Frontend code — zero changes
- API request/response shapes — identical JSON
- Social features (friends, challenges, XP) — backend decrypts before processing, all logic unchanged
- Auth flow — `email` and `google_id` stay plaintext
