# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin panel for `dankadr100@gmail.com` with Encrypt All / Decrypt All database controls, accessible as a 5th mobile tab and a desktop button in SettingsPanel.

**Architecture:** Email-based gate — no DB schema changes. Backend: two new FastAPI endpoints (`POST /admin/encrypt`, `POST /admin/decrypt`) protected by an email check on `user.email` (the `email` field on the stored `User` ORM object resolved by `get_current_user`). Migration logic extracted from `migrate_encrypt.py` into `admin_tasks.py` which returns counts. Frontend: 5th admin tab on mobile (BottomTabBar), admin button in desktop SettingsPanel, both rendering `AdminPanel.jsx` with the app's Liquid Glass navy/gold style.

**Tech Stack:** FastAPI, `asyncio.to_thread` (to run sync SQLAlchemy from async endpoint), React, CSS variables (glass design system)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/admin_tasks.py` | CREATE | `encrypt_all()` / `decrypt_all()` functions that return `{"encrypted"/"decrypted": N, "skipped": N, "errors": N}` |
| `backend/migrate_encrypt.py` | MODIFY | Import `run_encrypt` / `run_decrypt` from `admin_tasks` instead of defining inline |
| `backend/main.py` | MODIFY | `require_admin` dependency + `POST /admin/encrypt` + `POST /admin/decrypt` |
| `src/utils/api.js` | MODIFY | Add `triggerEncrypt(token)` and `triggerDecrypt(token)` |
| `src/components/AdminPanel.jsx` | CREATE | Full panel UI — glass card rows, confirm flow, loading/result states |
| `src/components/AdminPanel.css` | CREATE | Styles matching `SettingsPanel.css` glass pattern |
| `src/components/BottomTabBar.jsx` | MODIFY | Accept `isAdmin` prop; add WrenchIcon + 5th "Admin" tab when true |
| `src/components/SettingsPanel.jsx` | MODIFY | Accept `onOpenAdmin` prop; render Admin row when truthy |
| `src/components/Sidebar.jsx` | MODIFY | Import `useAuth`, email check, `showAdmin` state, `SwipeableModal` with `AdminPanel` |
| `src/App.jsx` | MODIFY | Pass `isAdmin` to `BottomTabBar`; render `<AdminPanel />` when `activeTab === 'admin'` |

**Admin email constant** (used in both frontend and backend):
```
ADMIN_EMAIL = "dankadr100@gmail.com"
```

---

## Chunk 1: Backend

### Task 1: Extract migration logic into backend/admin_tasks.py

**Files:**
- Create: `backend/admin_tasks.py`
- Modify: `backend/migrate_encrypt.py` (lines 234–259 — `run_encrypt` / `run_decrypt`)
- Test: `backend/tests/test_admin_tasks.py`

The current `migrate_encrypt.py` has `run_encrypt()` and `run_decrypt()` which print progress but return nothing. Extract the counting logic into `admin_tasks.py`, where both functions return `{"encrypted": int, "skipped": int}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_admin_tasks.py`:

```python
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd /Users/dankadr/swiss-tracker && python3 -m pytest backend/tests/test_admin_tasks.py -v 2>&1 | head -20
```
Expected: `ModuleNotFoundError: No module named 'backend.admin_tasks'`

- [ ] **Step 3: Create `backend/admin_tasks.py`**

```python
# backend/admin_tasks.py
"""
Admin-only DB operations: encrypt / decrypt all sensitive columns.
Called by migrate_encrypt.py (CLI) and the /admin/* API endpoints.
Both functions return {"encrypted": N, "skipped": N}.
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
    os.environ.setdefault("ENCRYPTION_MASTER_KEY", master_key)
    engine = _make_engine(db_url)
    encrypted = 0
    skipped = 0
    errors = 0

    with engine.begin() as conn:
        # visited_world.countries
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")).fetchall():
            if val and not is_encrypted(val):
                try:
                    obj = json.loads(val) if isinstance(val, str) else val
                    conn.execute(text('UPDATE visited_world SET countries = :v WHERE id = :id'), {"v": enc_json(uid, obj), "id": rid})
                    encrypted += 1
                except Exception:
                    errors += 1
            elif val:
                skipped += 1

        # visited_regions (4 columns per row)
        for rid, uid, regions, dates, notes, wishlist in conn.execute(
            text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")
        ).fetchall():
            updates = {}
            for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc_json(uid, json.loads(val) if isinstance(val, str) else val)
                        encrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE visited_regions SET {set_clause} WHERE id = :id"), updates)

        # wishlist (4 string columns per row)
        for rid, uid, priority, target_date, notes, category in conn.execute(
            text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")
        ).fetchall():
            updates = {}
            for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc(uid, val)
                        encrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE wishlist SET {set_clause} WHERE id = :id"), updates)

        # xp_log.reason
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")).fetchall():
            if reason and not is_encrypted(reason):
                try:
                    conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), {"v": enc(uid, reason), "id": rid})
                    encrypted += 1
                except Exception:
                    errors += 1
            elif reason:
                skipped += 1

        # users.name + picture
        for uid, name, picture in conn.execute(text("SELECT id, name, picture FROM users")).fetchall():
            updates = {}
            for col, val in [("name", name), ("picture", picture)]:
                if val and not is_encrypted(val):
                    try:
                        updates[col] = enc(uid, val)
                        encrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = uid
                conn.execute(text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates)

    return {"encrypted": encrypted, "skipped": skipped, "errors": errors}


def decrypt_all(db_url: str, master_key: str) -> dict:
    """Decrypt all sensitive columns back to plaintext."""
    os.environ.setdefault("ENCRYPTION_MASTER_KEY", master_key)
    engine = _make_engine(db_url)
    decrypted = 0
    skipped = 0
    errors = 0

    with engine.begin() as conn:
        # visited_world.countries
        for rid, uid, val in conn.execute(text("SELECT id, user_id, countries FROM visited_world")).fetchall():
            if val and is_encrypted(val):
                try:
                    conn.execute(text("UPDATE visited_world SET countries = :v WHERE id = :id"),
                                 {"v": json.dumps(dec_json(uid, val)), "id": rid})
                    decrypted += 1
                except Exception:
                    errors += 1
            elif val:
                skipped += 1

        # visited_regions
        for rid, uid, regions, dates, notes, wishlist in conn.execute(
            text("SELECT id, user_id, regions, dates, notes, wishlist FROM visited_regions")
        ).fetchall():
            updates = {}
            for col, val in [("regions", regions), ("dates", dates), ("notes", notes), ("wishlist", wishlist)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = json.dumps(dec_json(uid, val))
                        decrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE visited_regions SET {set_clause} WHERE id = :id"), updates)

        # wishlist
        for rid, uid, priority, target_date, notes, category in conn.execute(
            text("SELECT id, user_id, priority, target_date, notes, category FROM wishlist")
        ).fetchall():
            updates = {}
            for col, val in [("priority", priority), ("target_date", target_date), ("notes", notes), ("category", category)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = dec(uid, val)
                        decrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = rid
                conn.execute(text(f"UPDATE wishlist SET {set_clause} WHERE id = :id"), updates)

        # xp_log.reason
        for rid, uid, reason in conn.execute(text("SELECT id, user_id, reason FROM xp_log")).fetchall():
            if reason and is_encrypted(reason):
                try:
                    conn.execute(text("UPDATE xp_log SET reason = :v WHERE id = :id"), {"v": dec(uid, reason), "id": rid})
                    decrypted += 1
                except Exception:
                    errors += 1
            elif reason:
                skipped += 1

        # users
        for uid, name, picture in conn.execute(text("SELECT id, name, picture FROM users")).fetchall():
            updates = {}
            for col, val in [("name", name), ("picture", picture)]:
                if val and is_encrypted(val):
                    try:
                        updates[col] = dec(uid, val)
                        decrypted += 1
                    except Exception:
                        errors += 1
                elif val:
                    skipped += 1
            if updates:
                set_clause = ", ".join(f'"{k}" = :{k}' for k in updates)
                updates["id"] = uid
                conn.execute(text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates)

    return {"decrypted": decrypted, "skipped": skipped, "errors": errors}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
python3 -m pytest backend/tests/test_admin_tasks.py -v
```
Expected: 2 tests PASS

- [ ] **Step 5: Update `backend/migrate_encrypt.py` to use admin_tasks**

The current `migrate_encrypt.py` has a **module-level** `engine = create_engine(_db_url, echo=False)` (around line 27). This line runs at import time and requires `DATABASE_URL` to be set, which breaks `python3 -c "import backend.migrate_encrypt"` in environments without the env var. Remove it — the engine is now created inside `admin_tasks.py` functions.

Replace the current `run_encrypt()` and `run_decrypt()` functions (lines 234–259) with imports from `admin_tasks` AND remove the module-level engine line:

```python
# 1. Remove this line near the top (around line 27):
#   engine = create_engine(_db_url, echo=False)
#   (also remove _db_url assignment above it if it only fed the engine)

# 2. Replace lines 234-259 with:
from admin_tasks import encrypt_all, decrypt_all


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
```

Also remove the now-redundant helper functions (everything from line 34 through 259 that is now in `admin_tasks.py`): `JSONB_COLUMNS`, `_col_type`, `alter_jsonb_to_text`, `alter_text_to_jsonb`, `_enc_json_col`, `_enc_str_col`, `encrypt_visited_world`, `encrypt_visited_regions`, `encrypt_wishlist`, `encrypt_xp_log`, `encrypt_users`, `decrypt_visited_world`, `decrypt_visited_regions`, `decrypt_wishlist`, `decrypt_xp_log`, `decrypt_users`.

Keep: imports at top (remove any that are only used by deleted helpers), `from admin_tasks import encrypt_all, decrypt_all`, `run_encrypt()`, `run_decrypt()`, and the `if __name__ == "__main__":` block.

- [ ] **Step 6: Verify CLI still works (syntax check)**

```bash
cd /Users/dankadr/swiss-tracker && python3 -c "import backend.migrate_encrypt; print('OK')"
```
Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/admin_tasks.py backend/migrate_encrypt.py backend/tests/test_admin_tasks.py
git commit -m "feat(admin): extract encrypt_all/decrypt_all into admin_tasks.py"
```

---

### Task 2: Add admin endpoints to backend/main.py

**Files:**
- Modify: `backend/main.py`

Add a `require_admin` FastAPI dependency and two POST endpoints after the existing imports/auth section (around line 250, after the existing `get_current_user` dependency).

- [ ] **Step 1: Add the import and dependency**

After the existing crypto import block (around line 46), add:

```python
try:
    from backend.admin_tasks import encrypt_all, decrypt_all
except ImportError:
    from admin_tasks import encrypt_all, decrypt_all
```

After the `get_current_user` function definition (around line 248), add:

```python
ADMIN_EMAIL = "dankadr100@gmail.com"


async def require_admin(user: CurrentUser = Depends(get_current_user)):
    """Dependency: raises 403 unless the caller is the admin user."""
    if user.email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

- [ ] **Step 2: Add the two endpoints**

Add after the `require_admin` definition:

```python
@app.post("/admin/encrypt")
async def admin_encrypt(admin: CurrentUser = Depends(require_admin)):
    """Encrypt all sensitive DB columns. Idempotent — skips already-encrypted rows."""
    import asyncio
    db_url = os.environ["DATABASE_URL"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]
    result = await asyncio.to_thread(encrypt_all, db_url, master_key)
    return result


@app.post("/admin/decrypt")
async def admin_decrypt(admin: CurrentUser = Depends(require_admin)):
    """Decrypt all sensitive DB columns back to plaintext."""
    import asyncio
    db_url = os.environ["DATABASE_URL"]
    master_key = os.environ["ENCRYPTION_MASTER_KEY"]
    result = await asyncio.to_thread(decrypt_all, db_url, master_key)
    return result
```

- [ ] **Step 3: Verify syntax**

```bash
cd /Users/dankadr/swiss-tracker/backend && python3 -c "import main; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(admin): add POST /admin/encrypt and /admin/decrypt endpoints"
```

---

## Chunk 2: Frontend API + Component

### Task 3: Add triggerEncrypt / triggerDecrypt to api.js

**Files:**
- Modify: `src/utils/api.js`

- [ ] **Step 1: Add the two functions at the end of `src/utils/api.js`**

```js
export async function triggerEncrypt(token) {
  const res = await fetch('/admin/encrypt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Encrypt failed');
  }
  return res.json(); // { encrypted: N, skipped: N }
}

export async function triggerDecrypt(token) {
  const res = await fetch('/admin/decrypt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Decrypt failed');
  }
  return res.json(); // { encrypted: N, skipped: N }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/api.js
git commit -m "feat(admin): add triggerEncrypt and triggerDecrypt API helpers"
```

---

### Task 4: Create AdminPanel.jsx and AdminPanel.css

**Files:**
- Create: `src/components/AdminPanel.jsx`
- Create: `src/components/AdminPanel.css`

**Design reference:** Match the style of `SettingsPanel.jsx` / `SettingsPanel.css`. Glass card rows with navy/gold theme. Decrypt row uses danger (red) styling.

- [ ] **Step 1: Create `src/components/AdminPanel.css`**

```css
/* AdminPanel.css — matches SettingsPanel glass style */
.admin-panel {
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.admin-panel-header {
  padding: 20px 20px 14px;
  border-bottom: 1px solid var(--glass-border);
}

.admin-panel-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 2px;
}

.admin-panel-subtitle {
  font-size: 13px;
  color: var(--accent-gold);
  opacity: 0.75;
  margin: 0;
}

/* Reuse settings-panel section/group/row classes from SettingsPanel.css */
.admin-result-banner {
  margin: 0 16px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}

.admin-result-banner.success {
  background: rgba(52, 199, 89, 0.15);
  border: 1px solid rgba(52, 199, 89, 0.3);
  color: #34c759;
}

.admin-result-banner.error {
  background: rgba(255, 59, 48, 0.15);
  border: 1px solid rgba(255, 59, 48, 0.3);
  color: #ff6b6b;
}

.admin-row-loading {
  opacity: 0.5;
  pointer-events: none;
}
```

- [ ] **Step 2: Create `src/components/AdminPanel.jsx`**

```jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { triggerEncrypt, triggerDecrypt } from '../utils/api';
import './AdminPanel.css';
import './SettingsPanel.css'; // reuse .settings-section, .settings-group, .settings-row etc.

export default function AdminPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(null); // 'encrypt' | 'decrypt' | null
  const [result, setResult] = useState(null);   // { type: 'success'|'error', message: string }

  async function handleEncrypt() {
    if (!window.confirm('This will encrypt all user data in the database.\n\nAre you sure?')) return;
    setLoading('encrypt');
    setResult(null);
    try {
      const data = await triggerEncrypt(token);
      setResult({ type: 'success', message: `Done — ${data.encrypted} rows encrypted, ${data.skipped} skipped.` });
    } catch (err) {
      setResult({ type: 'error', message: `Failed: ${err.message}` });
    } finally {
      setLoading(null);
    }
  }

  async function handleDecrypt() {
    if (!window.confirm('This will DECRYPT all user data — removing encryption from the database.\n\nAre you sure?')) return;
    setLoading('decrypt');
    setResult(null);
    try {
      const data = await triggerDecrypt(token);
      setResult({ type: 'success', message: `Done — ${data.decrypted} rows decrypted, ${data.skipped} skipped.` });
    } catch (err) {
      setResult({ type: 'error', message: `Failed: ${err.message}` });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <p className="admin-panel-title">Admin</p>
        <p className="admin-panel-subtitle">dankadr100@gmail.com</p>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">Database Encryption</p>
        <div className="settings-group">
          <button
            className={`settings-row settings-row-btn${loading === 'encrypt' ? ' admin-row-loading' : ''}`}
            onClick={handleEncrypt}
            disabled={!!loading}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🔒</span>
              <span className="settings-row-title">Encrypt all user data</span>
            </div>
            <span className="settings-row-chevron">{loading === 'encrypt' ? '…' : '›'}</span>
          </button>
          <div className="settings-row-divider" />
          <button
            className={`settings-row settings-row-btn settings-row-danger${loading === 'decrypt' ? ' admin-row-loading' : ''}`}
            onClick={handleDecrypt}
            disabled={!!loading}
          >
            <div className="settings-row-left">
              <span className="settings-row-icon">🔓</span>
              <span className="settings-row-title">Decrypt all user data</span>
            </div>
            <span className="settings-row-chevron">{loading === 'decrypt' ? '…' : '›'}</span>
          </button>
        </div>
        <p className="settings-footer-note">Idempotent — already-encrypted rows are skipped.</p>
      </div>

      <div className="settings-section">
        <p className="settings-section-label">More Tools</p>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">🔧</span>
              <span className="settings-row-title" style={{ opacity: 0.4 }}>Coming soon…</span>
            </div>
          </div>
        </div>
      </div>

      {result && (
        <div className={`admin-result-banner ${result.type}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
```

**Note:** `settings-footer-note` — check if this class exists in `SettingsPanel.css`. If not, add it to `AdminPanel.css`:
```css
.settings-footer-note {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.6;
  margin: 6px 20px 0;
}
```

- [ ] **Step 3: Verify the component renders (visual check)**

It will be verified when wired up in Task 5/6. For now, just confirm no import errors:

```bash
cd /Users/dankadr/swiss-tracker && node -e "require('./src/components/AdminPanel.jsx')" 2>&1 || echo "skip — needs bundler"
```
(Skip if error — it's JSX, bundler check happens at dev server start.)

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminPanel.jsx src/components/AdminPanel.css
git commit -m "feat(admin): add AdminPanel component with encrypt/decrypt controls"
```

---

## Chunk 3: Navigation Wiring

### Task 5: Add Admin tab to BottomTabBar (mobile)

**Files:**
- Modify: `src/components/BottomTabBar.jsx`
- Modify: `src/App.jsx`

**Current `BottomTabBar.jsx`:** 4 tabs in a `TABS` constant (lines 42–47), then `export default function BottomTabBar(...)` through end of file (line 72). Accepts `activeTab`, `onTabChange`, `socialBadge` props.

- [ ] **Step 1: Add WrenchIcon and update BottomTabBar.jsx**

Add `WrenchIcon` after the `ProfileIcon` function (after line 40). Then update the component.

**Important:** `BASE_TABS` must be declared at **module scope** (outside the component function), so it is only allocated once. The replacement block below shows `BASE_TABS` at module scope, followed by the `export default function`.

```jsx
function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
```

Replace lines 42-72 (from the `const TABS` line through the end of the file) with the following. Note `BASE_TABS` is at module scope, before `export default function`:

```jsx
// Replace lines 42-72 with:
// BASE_TABS is module-level (outside the component) so it is stable across renders.
const BASE_TABS = [
  { id: 'map', label: 'Map', Icon: MapIcon },
  { id: 'explore', label: 'Explore', Icon: ExploreIcon },
  { id: 'social', label: 'Social', Icon: SocialIcon },
  { id: 'profile', label: 'Profile', Icon: ProfileIcon },
];

export default function BottomTabBar({ activeTab, onTabChange, socialBadge = 0, isAdmin = false }) {
  const tabs = isAdmin
    ? [...BASE_TABS, { id: 'admin', label: 'Admin', Icon: WrenchIcon }]
    : BASE_TABS;

  return (
    <nav className="bottom-tab-bar" role="tablist" aria-label="Main navigation">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          aria-label={label}
          className={`tab-bar-item${activeTab === id ? ' active' : ''}`}
          onClick={() => { navigator.vibrate?.(8); onTabChange(id); }}
        >
          <span className="tab-bar-icon">
            <Icon />
            {id === 'social' && socialBadge > 0 && (
              <span className="tab-bar-badge">{socialBadge > 9 ? '9+' : socialBadge}</span>
            )}
          </span>
          <span className="tab-bar-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Wire AdminPanel screen and isAdmin prop in App.jsx**

In `src/App.jsx`:

**Add import** at the top (near other component imports, around line 43):
```jsx
import AdminPanel from './components/AdminPanel';
```

**Pass `isAdmin` to BottomTabBar** (around line 896):
```jsx
// Before:
<BottomTabBar activeTab={activeTab} onTabChange={switchTab} socialBadge={pendingCount} />

// After:
<BottomTabBar
  activeTab={activeTab}
  onTabChange={switchTab}
  socialBadge={pendingCount}
  isAdmin={user?.email === 'dankadr100@gmail.com'}
/>
```

**Add AdminPanel mobile screen** after the `activeTab === 'profile'` block (around line 872):
```jsx
{isMobile && !isShareMode && activeTab === 'admin' && (
  <AdminPanel />
)}
```

- [ ] **Step 3: Start dev server and verify Admin tab appears when logged in as admin**

```bash
cd /Users/dankadr/swiss-tracker && npm run dev
```

Log in as `dankadr100@gmail.com` → should see 5th "Admin" tab. Other accounts → 4 tabs only.

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomTabBar.jsx src/App.jsx
git commit -m "feat(admin): add Admin tab to mobile nav and wire AdminPanel screen"
```

---

### Task 6: Add Admin button to desktop Sidebar

**Files:**
- Modify: `src/components/SettingsPanel.jsx`
- Modify: `src/components/Sidebar.jsx`

On desktop, the `Sidebar.jsx` renders `<SettingsPanel>` at the bottom (line 288–294). We add an `onOpenAdmin` prop to `SettingsPanel` which renders an admin row when provided, and `Sidebar.jsx` manages the `showAdmin` state + SwipeableModal.

- [ ] **Step 1: Add `onOpenAdmin` prop to SettingsPanel.jsx**

In `src/components/SettingsPanel.jsx`, update the function signature and add a new section before the "About" section:

```jsx
// Before:
export default function SettingsPanel({ onReset, onResetAll, onShowOnboarding }) {

// After:
export default function SettingsPanel({ onReset, onResetAll, onShowOnboarding, onOpenAdmin }) {
```

Add admin section before the closing `</div>` of the panel (before the "About" section, around line 69):

```jsx
{onOpenAdmin && (
  <div className="settings-section">
    <p className="settings-section-label">Admin</p>
    <div className="settings-group">
      <button className="settings-row settings-row-btn" onClick={onOpenAdmin}>
        <div className="settings-row-left">
          <span className="settings-row-icon">⚙️</span>
          <span className="settings-row-title">Admin Panel</span>
        </div>
        <span className="settings-row-chevron">›</span>
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Update Sidebar.jsx to pass onOpenAdmin and show the modal**

In `src/components/Sidebar.jsx`:

**Add import** at the top:
```jsx
import { useAuth } from '../context/AuthContext';
import SwipeableModal from './SwipeableModal';
import AdminPanel from './AdminPanel';
```

**Add state** inside the component (near the other useState calls, around line 47):
```jsx
const { user } = useAuth();
const [showAdmin, setShowAdmin] = useState(false);
const isAdmin = user?.email === 'dankadr100@gmail.com';
```

**Pass `onOpenAdmin` to SettingsPanel** (around line 289):
```jsx
// Before:
<SettingsPanel
  onReset={...}
  onResetAll={...}
  onShowOnboarding={onShowOnboarding}
/>

// After:
<SettingsPanel
  onReset={() => setConfirmAction({ type: 'reset', message: `Reset all ${country.regionLabel} progress?` })}
  onResetAll={() => setConfirmAction({ type: 'resetAll', message: 'Reset ALL countries? This cannot be undone.' })}
  onShowOnboarding={onShowOnboarding}
  onOpenAdmin={isAdmin ? () => setShowAdmin(true) : undefined}
/>
```

**Add SwipeableModal** after the SettingsPanel (before the `{showStats && ...}` line, around line 296):
```jsx
{showAdmin && (
  <SwipeableModal onClose={() => setShowAdmin(false)} maxWidth={480}>
    <AdminPanel />
  </SwipeableModal>
)}
```

- [ ] **Step 3: Verify desktop admin button appears**

```bash
npm run dev
```

On desktop, log in as `dankadr100@gmail.com` → Settings section in sidebar → "Admin" section with "Admin Panel" row should appear. Click → SwipeableModal with AdminPanel opens.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPanel.jsx src/components/Sidebar.jsx
git commit -m "feat(admin): add Admin button to desktop sidebar via SettingsPanel"
```
