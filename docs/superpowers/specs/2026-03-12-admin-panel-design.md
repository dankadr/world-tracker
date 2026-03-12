# Admin Panel Design

**Date**: 2026-03-12
**Status**: Approved

## Goal

Add an admin panel accessible only to `dankadr100@gmail.com`. Initial feature: trigger DB encryption and decryption from the UI. Designed to grow with future admin tools.

## Access Control

No `is_admin` DB column. The user's email is already a plaintext claim in the JWT payload.

- **Frontend**: renders the Admin tab / sidebar item only when `user?.email === "dankadr100@gmail.com"`
- **Backend**: a `require_admin` FastAPI dependency decodes the JWT, checks `email === "dankadr100@gmail.com"`, raises `HTTP 403` otherwise — no DB round-trip needed

## Backend

Two new endpoints in `backend/main.py`:

```
POST /admin/encrypt   →  encrypt all plaintext DB rows
POST /admin/decrypt   →  decrypt all DB rows back to plaintext (rollback)
```

Both endpoints:
- Protected by `require_admin` dependency
- Run migration logic via `asyncio.to_thread` (sync SQLAlchemy, same as `migrate_encrypt.py`)
- Return `{ "encrypted": N, "skipped": N, "errors": N }`
- Are idempotent — already-encrypted rows are skipped (Fernet prefix check)

The migration logic is extracted from `backend/migrate_encrypt.py` into two callable functions (`encrypt_all`, `decrypt_all`) that the endpoints call. No duplication.

## Frontend

### New file: `src/components/AdminPanel.jsx`

Full-screen panel using the app's Liquid Glass navy/gold design system. Matches `SettingsPanel.jsx` patterns.

Layout:
- Header: "Admin" title + `dankadr100@gmail.com` subtitle
- Section "DATABASE ENCRYPTION" — glass card with two rows:
  - **Encrypt all user data** — green icon, description, chevron
  - **Decrypt all user data** — red icon, red label, description, chevron
- Section "MORE TOOLS" — placeholder card for future tools
- Footer note: "Idempotent — already-encrypted rows are skipped."

UX flow on tap:
1. Native `confirm()` dialog: "This will [encrypt/decrypt] all user data in the database. Are you sure?"
2. If confirmed: button shows loading spinner, row is disabled
3. On success: result banner — "Done — X rows encrypted, Y skipped"
4. On error: error banner — "Failed: [message]"

### Modified: `src/components/BottomTabBar.jsx`

Add a 5th tab at the end — only rendered when `user?.email === "dankadr100@gmail.com"`:

```jsx
{ id: 'admin', label: 'Admin', Icon: WrenchIcon }
```

Tab navigates to `AdminPanel` screen.

### Modified: `src/App.jsx` or desktop sidebar

Add Admin nav item in the desktop sidebar with the same email guard.

### Modified: `src/utils/api.js`

Two new functions:

```js
export async function triggerEncrypt(token) { ... }  // POST /admin/encrypt
export async function triggerDecrypt(token) { ... }  // POST /admin/decrypt
```

## What Does NOT Change

- No DB schema changes
- No new Context providers
- No changes to auth flow
- All other users see zero difference in the UI
