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
    sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    return create_engine(sync_url, echo=False)


def encrypt_all(db_url: str, master_key: str) -> dict:
    """Encrypt all sensitive columns. Idempotent — skips already-encrypted rows."""
    os.environ["ENCRYPTION_MASTER_KEY"] = master_key
    engine = _make_engine(db_url)
    encrypted = 0
    skipped = 0
    errors = 0

    with engine.begin() as conn:
        # visited_world.countries
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")):
            if val and not is_encrypted(val):
                try:
                    obj = json.loads(val) if isinstance(val, str) else val
                    conn.execute(text('UPDATE visited_world SET countries = :v WHERE id = :id'), {"v": enc_json(uid, obj), "id": rid})
                    encrypted += 1
                except Exception as e:
                    print(f"  ERROR visited_world id={rid} col=countries: {e!r}")
                    errors += 1
            elif val:
                skipped += 1

        # visited_regions (4 columns per row)
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

        # wishlist (4 string columns per row)
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

        # xp_log.reason
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")):
            if reason and not is_encrypted(reason):
                try:
                    conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), {"v": enc(uid, reason), "id": rid})
                    encrypted += 1
                except Exception as e:
                    print(f"  ERROR xp_log id={rid} col=reason: {e!r}")
                    errors += 1
            elif reason:
                skipped += 1

        # users.name + picture
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

    with engine.begin() as conn:
        # visited_world.countries
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")):
            if val and is_encrypted(val):
                try:
                    conn.execute(text("UPDATE visited_world SET countries = :v WHERE id = :id"),
                                 {"v": json.dumps(dec_json(uid, val)), "id": rid})
                    decrypted += 1
                except Exception as e:
                    print(f"  ERROR visited_world id={rid} col=countries: {e!r}")
                    errors += 1
            elif val:
                skipped += 1

        # visited_regions
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

        # wishlist
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

        # xp_log.reason
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")):
            if reason and is_encrypted(reason):
                try:
                    conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), {"v": dec(uid, reason), "id": rid})
                    decrypted += 1
                except Exception as e:
                    print(f"  ERROR xp_log id={rid} col=reason: {e!r}")
                    errors += 1
            elif reason:
                skipped += 1

        # users
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
