#!/usr/bin/env python3
"""
One-shot DB migration: encrypt all sensitive columns.

Run:     python backend/migrate_encrypt.py
Rollback: python backend/migrate_encrypt.py --decrypt

Requires: DATABASE_URL, ENCRYPTION_MASTER_KEY in environment (or .env file).
Safe to re-run — already-encrypted rows are skipped.
"""
import argparse
import os
import sys

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Add backend/ to path so admin_tasks.py is importable when run from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from admin_tasks import encrypt_all, decrypt_all  # noqa: E402


def run_encrypt():
    print("=== Encrypting DB ===")
    db_url = os.environ["DATABASE_URL"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]
    result = encrypt_all(db_url, master_key)
    print(f"Done. encrypted={result['encrypted']} skipped={result['skipped']} errors={result['errors']} ✓")


def run_decrypt():
    print("=== Decrypting DB (rollback) ===")
    db_url = os.environ["DATABASE_URL"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]
    result = decrypt_all(db_url, master_key)
    print(f"Done. decrypted={result['decrypted']} skipped={result['skipped']} errors={result['errors']} ✓")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encrypt or decrypt sensitive DB columns.")
    parser.add_argument("--decrypt", action="store_true", help="Rollback: decrypt all data")
    args = parser.parse_args()
    if args.decrypt:
        run_decrypt()
    else:
        run_encrypt()
