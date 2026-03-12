# backend/admin_tasks.py
"""
Admin-only DB operations: encrypt / decrypt all sensitive columns.
Called by migrate_encrypt.py (CLI) and the /admin/* API endpoints.
encrypt_all returns {"encrypted": N, "skipped": N, "errors": N}.
decrypt_all returns {"decrypted": N, "skipped": N, "errors": N}.
"""
import json
import os
import sys

from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.dirname(__file__))
from crypto import enc, dec, enc_json, dec_json, is_encrypted  # noqa: E402


def _make_engine(db_url: str):
    # Convert async-only driver prefixes to their sync equivalents.
    # postgresql+asyncpg  → postgresql+psycopg  (if psycopg installed, else postgresql)
    # postgresql+psycopg_async → postgresql+psycopg
    # postgresql+psycopg  → already sync, leave as-is
    # postgresql          → already sync (uses psycopg2 or default), leave as-is
    replacements = [
        ("postgresql+asyncpg://", "postgresql+psycopg://"),
        ("postgresql+psycopg_async://", "postgresql+psycopg://"),
    ]
    sync_url = db_url
    for old, new in replacements:
        if db_url.startswith(old):
            sync_url = db_url.replace(old, new, 1)
            break
    return create_engine(sync_url, echo=False)


def encrypt_all(db_url: str, master_key: str) -> dict:
    """Encrypt all sensitive columns. Idempotent — skips already-encrypted rows.

    Strategy: read all rows, compute all ciphertext in Python, then write each
    table in a single batch. This avoids per-row DB round-trips (SAVEPOINTs or
    individual UPDATEs) which are too slow on serverless+Neon.
    Each table runs in its own transaction so a failure in one doesn't block others.
    """
    os.environ["ENCRYPTION_MASTER_KEY"] = master_key
    engine = _make_engine(db_url)
    encrypted = 0
    skipped = 0
    errors = 0

    # --- visited_world.countries ---
    with engine.begin() as conn:
        batch = []
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")):
            if val and not is_encrypted(val):
                try:
                    obj = json.loads(val) if isinstance(val, str) else val
                    batch.append({"v": enc_json(uid, obj), "id": rid})
                    encrypted += 1
                except Exception as e:
                    print(f"  ERROR visited_world id={rid}: {e!r}")
                    errors += 1
            elif val:
                skipped += 1
        if batch:
            conn.execute(text("UPDATE visited_world SET countries = :v WHERE id = :id"), batch)

    # --- visited_regions (4 text columns) ---
    with engine.begin() as conn:
        for rid, uid, regions, dates, notes, wishlist in conn.execute(
            text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")
        ):
            row_errors = 0
            updates = {}
            for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc_json(uid, json.loads(val) if isinstance(val, str) else val)
                        encrypted += 1
                    except Exception as e:
                        print(f"  ERROR visited_regions id={rid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE visited_regions SET {set_clause} WHERE id = :id"), updates)

    # --- wishlist (4 string columns) ---
    with engine.begin() as conn:
        for rid, uid, priority, target_date, notes, category in conn.execute(
            text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")
        ):
            row_errors = 0
            updates = {}
            for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc(uid, val)
                        encrypted += 1
                    except Exception as e:
                        print(f"  ERROR wishlist id={rid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE wishlist SET {set_clause} WHERE id = :id"), updates)

    # --- xp_log.reason ---
    with engine.begin() as conn:
        batch = []
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")):
            if reason and not is_encrypted(reason):
                try:
                    batch.append({"v": enc(uid, reason), "id": rid})
                    encrypted += 1
                except Exception as e:
                    print(f"  ERROR xp_log id={rid}: {e!r}")
                    errors += 1
            elif reason:
                skipped += 1
        if batch:
            conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), batch)

    # --- users.name + picture ---
    with engine.begin() as conn:
        for uid, name, picture in conn.execute(text("SELECT id, name, picture FROM users")):
            row_errors = 0
            updates = {}
            for col, val in [("name", name), ("picture", picture)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc(uid, val)
                        encrypted += 1
                    except Exception as e:
                        print(f"  ERROR users id={uid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = uid
                conn.execute(text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates)

    return {"encrypted": encrypted, "skipped": skipped, "errors": errors}


def decrypt_all(db_url: str, master_key: str) -> dict:
    """Decrypt all sensitive columns back to plaintext."""
    os.environ["ENCRYPTION_MASTER_KEY"] = master_key
    engine = _make_engine(db_url)
    decrypted = 0
    skipped = 0
    errors = 0

    # --- visited_world.countries ---
    with engine.begin() as conn:
        batch = []
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")):
            if val and is_encrypted(val):
                try:
                    batch.append({"v": json.dumps(dec_json(uid, val)), "id": rid})
                    decrypted += 1
                except Exception as e:
                    print(f"  ERROR visited_world id={rid}: {e!r}")
                    errors += 1
            elif val:
                skipped += 1
        if batch:
            conn.execute(text("UPDATE visited_world SET countries = :v WHERE id = :id"), batch)

    # --- visited_regions ---
    with engine.begin() as conn:
        for rid, uid, regions, dates, notes, wishlist in conn.execute(
            text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")
        ):
            row_errors = 0
            updates = {}
            for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = json.dumps(dec_json(uid, val))
                        decrypted += 1
                    except Exception as e:
                        print(f"  ERROR visited_regions id={rid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE visited_regions SET {set_clause} WHERE id = :id"), updates)

    # --- wishlist ---
    with engine.begin() as conn:
        for rid, uid, priority, target_date, notes, category in conn.execute(
            text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")
        ):
            row_errors = 0
            updates = {}
            for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = dec(uid, val)
                        decrypted += 1
                    except Exception as e:
                        print(f"  ERROR wishlist id={rid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE wishlist SET {set_clause} WHERE id = :id"), updates)

    # --- xp_log.reason ---
    with engine.begin() as conn:
        batch = []
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")):
            if reason and is_encrypted(reason):
                try:
                    batch.append({"v": dec(uid, reason), "id": rid})
                    decrypted += 1
                except Exception as e:
                    print(f"  ERROR xp_log id={rid}: {e!r}")
                    errors += 1
            elif reason:
                skipped += 1
        if batch:
            conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), batch)

    # --- users ---
    with engine.begin() as conn:
        for uid, name, picture in conn.execute(text("SELECT id, name, picture FROM users")):
            row_errors = 0
            updates = {}
            for col, val in [("name", name), ("picture", picture)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = dec(uid, val)
                        decrypted += 1
                    except Exception as e:
                        print(f"  ERROR users id={uid} col={col}: {e!r}")
                        errors += 1
                        row_errors += 1
                elif val:
                    skipped += 1
            if updates and row_errors == 0:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = uid
                conn.execute(text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates)

    return {"decrypted": decrypted, "skipped": skipped, "errors": errors}
