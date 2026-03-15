# Production Hardening — Design Spec
**Date:** 2026-03-15
**Status:** Approved

## Overview

Three phased plans to harden the app for beta launch and beyond. Each plan is broken into independently-shippable tasks that can be merged one at a time without waiting for the whole plan to complete.

**Stack context:**
- Frontend: React 18 + Vite SPA/PWA, deployed on Vercel
- Backend: FastAPI (Python), Vercel serverless via `api/index.py`
- Database: Neon PostgreSQL (async SQLAlchemy)
- Auth: Google OAuth → JWT (HS256, stored in localStorage)
- Encryption: Fernet server-side, AES-256-GCM client-side (PBKDF2-derived key)

---

## Plan 1 — Zero-risk quick wins

All 9 tasks are independent. No regressions possible. Ship in any order.

| # | Task | File(s) touched | Risk |
|---|------|-----------------|------|
| 1.1 | Add `cryptography` to `requirements.txt` explicitly | `backend/requirements.txt` | None |
| 1.2 | Move `ADMIN_EMAIL` to env var | `backend/main.py` | None |
| 1.3 | Add security headers via `vercel.json` | `vercel.json` | None |
| 1.4 | Cap batch endpoint at 50 actions (Pydantic v2 `Annotated`) | `backend/main.py` | None |
| 1.5 | Check JWT expiry inside `loadAuth()` — return null if expired | `src/context/AuthContext.jsx` | None |
| 1.6 | Cache Fernet instance per `(user_id, key_fingerprint)` | `backend/crypto.py` | None |
| 1.7 | Guard insecure `JWT_SECRET` default — crash on startup if unset | `backend/main.py` | None |
| 1.8 | Add `GET /api/health` endpoint | `backend/main.py` | None |
| 1.9 | Guard `console.log/warn` behind `import.meta.env.DEV` | 19 files in `src/` | Low |

### Task 1.1 — Add `cryptography` to `requirements.txt` explicitly

**Problem:** `backend/crypto.py` imports `from cryptography.fernet import Fernet`. The package is currently available only as a transitive dependency of `python-jose[cryptography]` — it is not listed directly in `backend/requirements.txt`. This is not a breakage risk today, but it is an implicit dependency: if `python-jose` ever drops the `[cryptography]` extra or the requirement is audited by a tool that doesn't trace transitive deps, the direct usage in `crypto.py` becomes invisible.

**Fix:** Add `cryptography>=42.0.0` to `backend/requirements.txt` to make the dependency explicit and self-documenting.

**Files:** `backend/requirements.txt`

---

### Task 1.2 — Move `ADMIN_EMAIL` to env var

**Problem:** `ADMIN_EMAIL = "dankadr100@gmail.com"` is hardcoded in `backend/main.py:256`. This leaks a personal email in the public repo and makes it impossible to change without a deploy.

**Fix:** Read from `os.getenv("ADMIN_EMAIL")`. Raise a startup warning (not a crash) if unset, and disable the admin endpoints by returning 503. Update Vercel environment variables.

**Files:** `backend/main.py`

---

### Task 1.3 — Security headers via `vercel.json`

**Problem:** No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` headers are set. These are the baseline hardening headers expected by all security scanners.

**Fix:** Add a `headers` block to `vercel.json` applying to all routes (`/(.*)`):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy`: permissive for now (report-only mode), tightened post-beta

**Files:** `vercel.json`

---

### Task 1.4 — Cap batch endpoint at 50 actions

**Problem:** `POST /api/batch` accepts an unbounded list of actions. An authenticated attacker could send tens of thousands of writes in a single request, causing a DB overload or a Vercel timeout.

**Fix:** Enforce the limit at the Pydantic model layer using Pydantic v2 `Annotated` syntax (the project uses `pydantic>=2.10.0`):
```python
from typing import Annotated
from pydantic import Field

class BatchRequest(BaseModel):
    actions: Annotated[list[BatchAction], Field(max_length=50)]
```
Note: Pydantic v1 used `max_items` — that is not valid here. `max_length` on a list field is the correct v2 spelling. As a defence-in-depth backstop, also add an explicit `HTTP 400` check at the top of `batch_actions()` in case the model constraint is ever bypassed.

**Files:** `backend/main.py`

---

### Task 1.5 — JWT expiry check on app load

**Problem:** `loadAuth()` at `AuthContext.jsx:20` is called synchronously as the `useState` initializer (line 48: `useState(() => loadAuth())`). It never checks if the JWT has expired. A user with a 30-day-old stored token gets silent 401 errors on every API call until they manually log out.

**Fix:** Inside `loadAuth()` itself (not in a `useEffect` — the check must happen before any state is set), decode the JWT payload (no signature verification needed — just parse the base64 middle segment) and compare `exp` against `Date.now() / 1000`. If expired, return `null`. Add a 60-second buffer to auto-logout slightly before the exact expiry edge case.

**Files:** `src/context/AuthContext.jsx`

---

### Task 1.6 — Cache Fernet instance per `user_id` in backend crypto

**Problem:** `backend/crypto.py:_derive_key()` re-derives the HMAC key and creates a new `Fernet` object on every single `enc()` / `dec()` call. In the batch endpoint this runs per-action, per-field — dozens of times per request.

**Fix:** Add a module-level `_FERNET_CACHE: dict[int, Fernet] = {}` and return the cached instance if present. The cache key must include a fingerprint of the master key (e.g., first 8 hex chars of the master key bytes) so that a key rotation doesn't silently return a stale Fernet instance:
```python
_FERNET_CACHE: dict[tuple[int, str], Fernet] = {}

def _get_fernet(user_id: int) -> Fernet:
    master = bytes.fromhex(os.environ["ENCRYPTION_MASTER_KEY"])
    cache_key = (user_id, master[:4].hex())  # fingerprint, not secret
    if cache_key not in _FERNET_CACHE:
        _FERNET_CACHE[cache_key] = Fernet(_derive_key(user_id))
    return _FERNET_CACHE[cache_key]
```
The cache lives for the lifetime of the serverless function invocation (cleared on cold start).

**Files:** `backend/crypto.py`

---

### Task 1.7 — Guard insecure `JWT_SECRET` default

**Problem:** `backend/main.py:66`: `JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")`. If this env var is not set in a production deployment, the app silently runs with a publicly known default secret. Anyone aware of the default can forge valid JWTs and authenticate as any user.

**Fix:** At startup, check if `JWT_SECRET` is unset or matches the known-insecure default. If `DEBUG` mode is off (i.e., `os.getenv("DEBUG") != "true"`), raise a `RuntimeError` that crashes the process — it is safer to refuse to start than to run insecurely:
```python
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
_INSECURE_DEFAULT = "change-me-in-production-please"
if JWT_SECRET == _INSECURE_DEFAULT and os.getenv("DEBUG", "false").lower() != "true":
    raise RuntimeError("JWT_SECRET must be set to a strong random secret in production")
```
Add `JWT_SECRET` to Vercel environment variables if not already present.

**Files:** `backend/main.py`

---

### Task 1.8 — Add `GET /api/health` endpoint (renumbered from 1.7)

**Problem:** No health check endpoint exists. There's no way to verify the backend is alive without triggering a real auth flow, and no surface for uptime monitors (UptimeRobot, Better Uptime, etc.).

**Fix:** Add a lightweight `GET /api/health` route that returns `{"status": "ok", "timestamp": <ISO>}` with no auth required. Do not check the DB — keep it as a process liveness check only.

**Files:** `backend/main.py`

---

### Task 1.9 — Guard `console.log/warn` behind `import.meta.env.DEV` (renumbered from 1.8)

**Problem:** 40+ `console.log`, `console.error`, and `console.warn` calls exist across 19 production source files. These leak internal state and implementation details to any user who opens DevTools.

**Fix:** Create a `src/utils/logger.js` thin wrapper that no-ops in production:
```js
const isDev = import.meta.env.DEV;
export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  error: console.error.bind(console), // always log errors
  debug: isDev ? console.debug.bind(console) : () => {},
};
```
Replace all `console.log` / `console.warn` / `console.debug` calls across `src/` with `logger.*`. Keep `console.error` for genuine unexpected errors (or route through `logger.error`).

**Files:** new `src/utils/logger.js`, 19 files in `src/`

---

## Plan 2 — Medium-risk hardening

All 5 tasks are independent. Validate each in the beta environment before merging.

### Task 2.1 — Restrict CORS to production domain

**Problem:** `backend/main.py:85` sets `allow_origins=["*"]` with `allow_credentials=True`. Browsers block credentialed requests to wildcard origins per the CORS spec, but this configuration still signals misconfiguration to security auditors.

**Fix:** Read `ALLOWED_ORIGINS` from `os.getenv("ALLOWED_ORIGINS", "")` as a comma-separated list. Fall back to `["*"]` only when `DEBUG=true` (local dev). Set in Vercel env vars: `https://rightworld.io,https://www.rightworld.io` (adjust to actual domain).

**Files:** `backend/main.py`
**Env vars to add:** `ALLOWED_ORIGINS`

---

### Task 2.2 — Rate limiting on auth and batch endpoints

**Problem:** `/auth/google` and `/api/batch` have no request throttling. An attacker can hammer the Google token verification endpoint or flood the batch endpoint.

**Fix:** Add `slowapi` (FastAPI-compatible rate limiter) to `requirements.txt`. Apply limits:
- `/auth/google`: 10 requests/minute per IP
- `/api/batch`: 60 requests/minute per authenticated user
- Default global limit: 200 requests/minute per IP

On Vercel, use the real client IP via `X-Forwarded-For` header.

**Files:** `backend/main.py`, `backend/requirements.txt`

---

### Task 2.3 — React `<ErrorBoundary>` component

**Problem:** Any unhandled JavaScript error in a React component causes the entire app to white-screen. Users see a blank page with no feedback or recovery path.

**Fix:** Create `src/components/ErrorBoundary.jsx` — a class component implementing `componentDidCatch`. Show a friendly "Something went wrong — reload the page" UI with a reload button. Wrap the root `<App>` in `src/main.jsx` with `<ErrorBoundary>`. Optionally add a nested boundary around the games panel (highest-risk area).

**Files:** new `src/components/ErrorBoundary.jsx`, `src/main.jsx`

---

### Task 2.4 — Fix N+1 queries in batch endpoint

**Problem:** `POST /api/batch` (`backend/main.py:618`) executes a separate `SELECT` per action inside a loop. A batch of 50 `region_toggle` actions for the same country causes 50 identical DB queries.

**Fix:** Pre-group actions by type and affected record before the loop. For `region_toggle`, collect all unique `(user_id, country_id)` pairs, fetch them in one `SELECT ... WHERE country_id IN (...)` query, then process all actions against the in-memory records. Same pattern for `world_toggle` (single row per user) and `wishlist_*`. One `await db.commit()` at the end (already correct).

**Files:** `backend/main.py`

---

### Task 2.5 — Fix PWA API cache — exclude error responses

**Problem:** `vite.config.js` lines 27–34 (the `api-cache` Workbox rule) caches `/api/*` responses with `NetworkFirst` for 24 hours. A 401 or 500 response can be cached and served to the user on the next offline visit, making the app appear broken with no network explanation.

**Fix:**
1. Add `cacheableResponse: { statuses: [200] }` to the API cache rule — only cache successful responses.
2. Reduce `maxAgeSeconds` from 86400 (24h) to 300 (5 min) — API data changes frequently.
3. Tighten the `urlPattern` from the generic `/^https:\/\/.*\/api\/.*/` (which could match any third-party HTTPS URL containing `/api/`) to the production domain: `/^https:\/\/rightworld\.io\/api\/.*/`. Keep the loose pattern as a comment for local dev reference.

**Files:** `vite.config.js`

---

## Plan 3 — Architectural (post-beta)

3 larger tasks. Each is self-contained but requires dedicated testing before merging.

### Task 3.1 — Code splitting with `React.lazy()` + `Suspense`

**Problem:** `src/App.jsx` eagerly imports all 40+ components. The resulting JS bundle is 17MB+. Every user downloads the games panel, admin panel, year-in-review, etc. even if they never visit those screens. This hurts First Contentful Paint and LCP.

**Approach:**
- Keep eagerly loaded: `WorldMap`, `SwissMap`, `Sidebar`, `WorldSidebar`, `BottomTabBar`, `AuthButton`, `MapSkeleton` — these are on the critical path.
- Lazy load everything else: `GamesPanel`, `ProfileScreen`, `SocialScreen`, `ExploreScreen`, `AdminPanel`, `YearInReview`, `FriendsPanel`, `BucketListPanel`, `ChallengesPanel`, `DataExport`, `DataImport`, `AvatarEditor`, `ShareCard`.
- Wrap lazy-loaded areas in `<Suspense fallback={<MapSkeleton />}>`.
- Target: reduce initial bundle to under 3MB.

**Pre-implementation step:** Before starting, run `grep -n "^import" src/App.jsx` to confirm the full list of imports. The lazy-load list above is based on the component directory contents — verify each is actually imported in `App.jsx` before converting it (some may already be imported elsewhere or not imported at all).

**Files:** `src/App.jsx`, all lazily-loaded component files (no changes to component internals)

---

### Task 3.2 — JWT httpOnly cookie migration

**Problem:** The JWT is stored in `localStorage` (`AuthContext.jsx:41`), accessible by any JavaScript running on the page. If an XSS vulnerability is ever introduced, the attacker gets the token.

**Approach:**
- Backend: change `/auth/google` to set a `Set-Cookie: jwt=...; HttpOnly; Secure; SameSite=Strict; Path=/` header instead of returning the token in the response body. The response body must still return the user object including `sub` (Google ID), `id`, `email`, `name`, `picture` — these are needed by the frontend for client-side key derivation (`src/utils/crypto.js`). The `jwt_token` field is removed from the response body.
- Backend: update `get_current_user` to read from the `Cookie` header as a fallback after `Authorization` header (for backwards compatibility during rollout).
- Frontend: remove `jwt_token` storage from `AuthContext`. The `user` object (including `sub`) is still stored in localStorage for key derivation — only the token moves to a cookie. All `fetch()` calls automatically include cookies — remove manual `Authorization` headers from `src/utils/api.js`.
- This is a breaking change for any existing localStorage sessions — users will be logged out once on deploy. Add a one-time migration notice in the UI ("You've been signed out for a security upgrade — please sign in again").

**Files:** `backend/main.py`, `src/context/AuthContext.jsx`, `src/utils/api.js` (remove all `Authorization` headers), `src/utils/crypto.js` (key derivation still needs `sub` — pass it from login response)

---

### Task 3.3 — Proper DB migrations with Alembic

**Problem:** `database.py:201` implements a custom "add missing columns" auto-migration that runs on every cold start. It can't handle column renames, type changes, index changes, or data migrations. It also runs DB introspection on every serverless cold start, adding latency.

**Approach:**
- Add `alembic` to `requirements.txt`.
- Initialize `alembic/` at the repo root with async SQLAlchemy support.
- Create an initial migration capturing the current schema.
- Remove `_sync_add_missing_columns` and the backfill functions from `init_db()` — replace with a note to run `alembic upgrade head` as a deploy step.
- Add a `make migrate` / `npm run migrate` script for local use.
- Document the deploy workflow: `alembic upgrade head` runs before Vercel deploys the new function.

**Files:** new `alembic/`, `backend/database.py`, `backend/requirements.txt`, `Makefile` or `package.json`

---

## Success Criteria

- **Plan 1:** All 9 tasks pass CI (existing Playwright smoke + Vitest unit tests) with no regressions. Security headers visible in browser DevTools.
- **Plan 2:** CORS headers return only the production domain in beta. Rate limiter returns 429 under test load. Error boundary renders on injected throw.
- **Plan 3:** Lighthouse performance score improves by 20+ points after code splitting. No localStorage token visible after cookie migration. `alembic upgrade head` runs cleanly from scratch on a new DB.
