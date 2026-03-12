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
