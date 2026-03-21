# Production Hardening — Plan 3: Architectural (Post-beta)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three larger, post-beta architectural improvements: reduce the initial JS bundle from 17MB to under 3MB via code splitting, move the JWT from localStorage to an httpOnly cookie, and replace the fragile cold-start migration hack with Alembic.

**Architecture:** Each task is self-contained and can be done in any order. Task 3.2 (cookie migration) is a breaking change for existing sessions and requires a coordinated deploy with a UI notice.

**Tech Stack:** React 18 `lazy`/`Suspense`, FastAPI `Set-Cookie`, Alembic async migrations, vitest, pytest

**Spec:** `docs/superpowers/specs/2026-03-15-production-hardening-design.md`

---

## Chunk 1: Code splitting (Task 3.1)

### Task 3.1 — Code splitting with `React.lazy()` + `Suspense`

**Files:**
- Modify: `src/App.jsx` (import statements only — no changes to component logic)

**Pre-implementation step — confirm the import list:**

- [ ] **Step 1: List all static imports in `App.jsx`**
  ```bash
  grep -n "^import" src/App.jsx
  ```
  Cross-check the output against the lists below. Only convert imports that are actually in `App.jsx`.

**Eagerly loaded (keep as static imports — on the critical render path):**
```
WorldMap, SwissMap (RegionMap), Sidebar, WorldSidebar, BottomTabBar, MapSkeleton,
AuthButton (if imported), OfflineIndicator, InstallPrompt, Confetti, XpNotification
```

**Lazy loaded (convert to `React.lazy`):**
```
GamesPanel, ProfileScreen, SocialScreen, ExploreScreen, AdminPanel,
FriendsPanel, BucketListPanel, StatsModal, EasterEggPrompt, Onboarding,
ComparisonStats
```
(List based on confirmed App.jsx imports — do not include components that aren't imported there.)

- [ ] **Step 2: Measure the current bundle size as a baseline**
  ```bash
  npx vite build 2>&1 | grep "dist/assets"
  ```
  Note the total size. You want to see it drop significantly after this task.

- [ ] **Step 3: Write a test verifying lazy components are not in the initial chunk**

  Create `src/__tests__/codeSplitting.test.jsx`:
  ```jsx
  import { describe, it, expect } from 'vitest';

  describe('Code splitting', () => {
    it('GamesPanel module is accessible via dynamic import', async () => {
      // In the test env, React.lazy modules still resolve — we can't distinguish
      // lazy vs static import here. This is a smoke test that the module path
      // resolves correctly after the refactor. The real correctness proof is the
      // bundle size check in Step 8 — the network tab in DevTools showing chunks
      // loading on demand is the definitive evidence.
      const { default: GamesPanel } = await import('../components/GamesPanel.jsx');
      expect(GamesPanel).toBeTruthy();
    });
  });
  ```

- [ ] **Step 4: Run full test suite to establish baseline (all should pass)**
  ```bash
  npx vitest run
  ```
  Expected: all pass

- [ ] **Step 5: Convert static imports to `React.lazy` in `src/App.jsx`**

  At the top of `App.jsx`, find the static imports for the lazy components listed above. Replace each with a `lazy` call. Example for a group of them:

  ```jsx
  // Remove these static imports (only if present in App.jsx — see Step 1 output):
  // import GamesPanel from './components/GamesPanel';
  // import ProfileScreen from './components/ProfileScreen';
  // import SocialScreen from './components/SocialScreen';
  // import ExploreScreen from './components/ExploreScreen';
  // import AdminPanel from './components/AdminPanel';
  // import FriendsPanel from './components/FriendsPanel';
  // import BucketListPanel from './components/BucketListPanel';
  // import StatsModal from './components/StatsModal';
  // import EasterEggPrompt from './components/EasterEggPrompt';
  // import Onboarding from './components/Onboarding';
  // import ComparisonStats from './components/ComparisonStats';

  // Add lazy imports:
  const GamesPanel = lazy(() => import('./components/GamesPanel'));
  const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
  const SocialScreen = lazy(() => import('./components/SocialScreen'));
  const ExploreScreen = lazy(() => import('./components/ExploreScreen'));
  const AdminPanel = lazy(() => import('./components/AdminPanel'));
  const FriendsPanel = lazy(() => import('./components/FriendsPanel'));
  const BucketListPanel = lazy(() => import('./components/BucketListPanel'));
  const StatsModal = lazy(() => import('./components/StatsModal'));
  const EasterEggPrompt = lazy(() => import('./components/EasterEggPrompt'));
  const Onboarding = lazy(() => import('./components/Onboarding'));
  const ComparisonStats = lazy(() => import('./components/ComparisonStats'));
  ```

  Note: `lazy` and `Suspense` are named exports from React. App.jsx likely already has a React import line like `import React, { useState, useEffect } from 'react'`. Add `lazy, Suspense` to the existing destructuring — do NOT add a second `import ... from 'react'` line. Example: `import React, { useState, useEffect, lazy, Suspense } from 'react'`.

- [ ] **Step 6: Wrap lazy component render sites with `<Suspense>`**

  In `App.jsx`, find where each lazy component is rendered (usually inside a conditional or a navigation screen). Wrap each render site with:

  ```jsx
  <Suspense fallback={<MapSkeleton />}>
    <GamesPanel ... />
  </Suspense>
  ```

  If multiple lazy components are rendered inside the same navigation block, a single outer `<Suspense>` is fine:
  ```jsx
  <Suspense fallback={<MapSkeleton />}>
    {activeScreen === 'games' && <GamesPanel ... />}
    {activeScreen === 'profile' && <ProfileScreen ... />}
    {activeScreen === 'social' && <SocialScreen ... />}
  </Suspense>
  ```

- [ ] **Step 7: Run full test suite — confirm no regressions**
  ```bash
  npx vitest run
  ```
  Expected: all pass. If a test fails because a lazy component isn't wrapped in `<Suspense>` in the test, wrap the test render call: `render(<Suspense fallback={null}><Component /></Suspense>)`.

- [ ] **Step 8: Measure the new bundle size**
  ```bash
  npx vite build 2>&1 | grep "dist/assets"
  ```
  Expected: the main chunk is substantially smaller. Target: initial JS under 3MB. If not reached, check if any of the heavy components (e.g. game assets, large data files) are still eagerly imported.

- [ ] **Step 9: Commit**
  ```bash
  git add src/App.jsx src/__tests__/codeSplitting.test.jsx
  git commit -m "perf: lazy-load all non-critical screens/panels — reduces initial bundle"
  ```

- [ ] **Step 10: Manual smoke test**

  Load the app in a browser → open DevTools → Network tab → filter by JS.
  Confirm that `GamesPanel` and `ProfileScreen` chunks are only downloaded when navigating to those screens, not on initial load.

---

## Chunk 2: JWT cookie migration (Task 3.2)

### Task 3.2 — JWT httpOnly cookie migration

**Files:**
- Modify: `backend/main.py` (`/auth/google` endpoint, `get_current_user` dependency)
- Modify: `src/context/AuthContext.jsx` (remove token from localStorage)
- Modify: `src/utils/api.js` (remove all `Authorization` headers)
- Modify: `backend/tests/test_auth.py`

**Warning:** This is a breaking change. All existing user sessions stored in localStorage will be invalidated on deploy. Users will be logged out once and see a migration notice. Coordinate with a deployment announcement.

- [ ] **Step 1: Add a migration notice component to the frontend**

  Before touching auth logic, add a one-time notice so users aren't confused by the forced logout.

  In `src/context/AuthContext.jsx`, add a flag check on startup:
  ```js
  const MIGRATION_KEY = 'swiss-tracker-cookie-migration-v1';

  // In AuthProvider, on mount — detect users who had a localStorage-based JWT
  // session before this migration and show a one-time logout notice.
  useEffect(() => {
    const migrationShown = localStorage.getItem(MIGRATION_KEY);
    if (migrationShown) return; // already shown — never fire again

    // Check if the stored auth data contains a jwt_token (pre-migration format).
    // IMPORTANT: check for jwt_token specifically, not just any stored auth.
    // After migration, saveAuth() still writes to localStorage, but without
    // jwt_token — so `!!localStorage.getItem('swiss-tracker-auth')` would always
    // be true for logged-in users and fire the notice on every load.
    let hadLegacyToken = false;
    try {
      const raw = localStorage.getItem('swiss-tracker-auth');
      hadLegacyToken = !!(raw && JSON.parse(raw)?.jwt_token);
    } catch (_) {}

    if (hadLegacyToken && !auth) {
      localStorage.setItem(MIGRATION_KEY, '1');
      // Use a simple alert or a toast; adjust to your existing notification pattern
      alert('You have been signed out for a security upgrade. Please sign in again.');
    }
  }, []);
  ```

  Adjust the notice UX to match your existing notification pattern.

- [ ] **Step 2: Write backend tests for the new cookie flow**

  Add to `backend/tests/test_auth.py`:
  ```python
  async def test_google_login_sets_httponly_cookie(client, mock_db):
      """Successful login sets a jwt httpOnly cookie instead of returning the token in the body."""
      mock_db.execute.return_value.scalar_one_or_none.return_value = None
      fake_idinfo = {
          "sub": "google-uid-123",
          "email": "user@example.com",
          "name": "Test User",
          "picture": "https://example.com/pic.jpg",
      }
      with (
          patch("main.GOOGLE_CLIENT_ID", "test-client-id"),
          patch("google.oauth2.id_token.verify_oauth2_token", return_value=fake_idinfo),
      ):
          resp = await client.post("/auth/google", json={"token": "valid-token"})

      assert resp.status_code == 200
      # Token should be in cookie, not in response body
      assert "jwt_token" not in resp.json()
      assert "jwt" in resp.cookies
      # Verify the user object is still returned
      assert resp.json()["user"]["email"] == "user@example.com"
      assert resp.json()["user"]["sub"] == "google-uid-123"


  async def test_authenticated_request_works_with_cookie(client, mock_db):
      """Authenticated endpoints accept the JWT via cookie."""
      from jose import jwt as jose_jwt
      from datetime import datetime, timedelta, timezone

      token = jose_jwt.encode(
          {"sub": "1", "email": "test@example.com", "exp": datetime.now(timezone.utc) + timedelta(days=1)},
          os.environ["JWT_SECRET"],
          algorithm="HS256",
      )
      resp = await client.get("/api/visited/all", cookies={"jwt": token})
      assert resp.status_code == 200
  ```

- [ ] **Step 3: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_auth.py::test_google_login_sets_httponly_cookie tests/test_auth.py::test_authenticated_request_works_with_cookie -v
  ```
  Expected: both FAIL

- [ ] **Step 4: Update `/auth/google` endpoint to set cookie**

  In `backend/main.py`, find the `google_login` function. Replace the return statement:

  Current:
  ```python
  return GoogleLoginResponse(
      jwt_token=jwt_token,
      user={"id": uid, "email": user.email, "name": name, "picture": picture, "sub": google_id},
  )
  ```

  Replace with:
  ```python
  response = JSONResponse(content={
      "user": {"id": uid, "email": user.email, "name": name, "picture": picture, "sub": google_id}
  })
  response.set_cookie(
      key="jwt",
      value=jwt_token,
      httponly=True,
      secure=True,   # HTTPS only
      samesite="strict",
      path="/",
      max_age=JWT_EXPIRE_DAYS * 24 * 60 * 60,
  )
  return response
  ```

  Also update the `@app.post` decorator — remove `response_model=GoogleLoginResponse` since we're returning a `JSONResponse` directly (which bypasses Pydantic serialisation anyway). Change to `response_model=None`:
  ```python
  @app.post("/auth/google", response_model=None)
  @limiter.limit("10/minute")  # if Task 2.2 is done; omit if not
  async def google_login(request: Request, body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
  ```

  You may keep `GoogleLoginResponse` as a docstring-only hint or delete it — it's no longer used for serialisation.

- [ ] **Step 5: Update `get_current_user` to read cookie as fallback**

  Current `get_current_user`:
  ```python
  async def get_current_user(
      authorization: str = Header(None),
  ) -> CurrentUser:
      if not authorization or not authorization.startswith("Bearer "):
          raise HTTPException(status_code=401, detail="Missing authorization header")
      token = authorization.split(" ", 1)[1]
  ```

  Replace with:
  ```python
  async def get_current_user(
      request: Request,
      authorization: str = Header(None),
  ) -> CurrentUser:
      # Prefer Authorization header (backwards compat), fall back to cookie
      token = None
      if authorization and authorization.startswith("Bearer "):
          token = authorization.split(" ", 1)[1]
      elif "jwt" in request.cookies:
          token = request.cookies["jwt"]
      if not token:
          raise HTTPException(status_code=401, detail="Missing authorization")
  ```

- [ ] **Step 6: Run backend tests**
  ```bash
  pytest tests/test_auth.py::test_google_login_sets_httponly_cookie tests/test_auth.py::test_authenticated_request_works_with_cookie -v
  ```
  Expected: both PASS

- [ ] **Step 7: Run full backend suite**
  ```bash
  pytest -v
  ```
  Expected: all pass. Update any existing tests that check for `jwt_token` in the response body — they should now check for the `jwt` cookie instead.

- [ ] **Step 8: Update frontend — remove token from `AuthContext.jsx`**

  In `src/context/AuthContext.jsx`:

  1. **Login fetch**: Add `credentials: 'include'` to the POST to `/auth/google` so the browser accepts the `Set-Cookie` response header:
  ```js
  const res = await fetch('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // ← required for cookie to be set cross-origin
    body: JSON.stringify({ token: googleToken }),
  });
  const data = await res.json();
  // data now only has: { user: { id, email, name, picture, sub } }
  setAuth(data);
  saveAuth(data); // stores user info only, no JWT
  ```

  2. **`loadAuth()`** (the `useState()` initializer): Currently guards on `data?.jwt_token` to validate a stored session. Change this check to `data?.user`:
  ```js
  function loadAuth() {
    try {
      const raw = localStorage.getItem('swiss-tracker-auth');
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data?.user ? data : null;  // ← was: data?.jwt_token ? data : null
    } catch (_) {
      return null;
    }
  }
  ```

  3. **`logout()` and cache key scoping**: The hook layer (`useVisitedCantons`, `useVisitedCountries`, etc.) uses `auth?.jwt_token` (or a slice of it) as a per-user cache key suffix. After this migration there is no token in context. Switch all cache key derivation to `auth?.user?.id` or `auth?.user?.sub`. Search for the pattern:
  ```bash
  grep -rn "jwt_token" src/ --include="*.js" --include="*.jsx"
  ```
  Replace every occurrence with `user?.id` or `user?.sub` as appropriate.

  4. **`syncLocalDataToServer` calls**: `syncLocalDataToServer` is called with `auth.jwt_token` as the first argument around lines 62 and 92 of AuthContext.jsx. After this migration, the function no longer needs a token — update the calls to omit the token argument and update `syncLocalDataToServer`'s signature to remove it (the cookie will be sent automatically with each fetch).

  5. Remove `token: auth?.jwt_token || null` from the context value — the token is now in the cookie automatically.

  6. Keep `user: auth?.user` — we still need `user.id`/`user.sub` for client-side key derivation and cache scoping.

  7. Update `isLoggedIn` to check for user presence only:
  ```js
  isLoggedIn: !!auth?.user,
  ```

- [ ] **Step 9: Update `src/utils/api.js` — remove all `Authorization` headers**

  The browser will automatically send the httpOnly cookie with every same-origin request. Remove all `Authorization: Bearer ${token}` headers from every `fetch()` call in `api.js`.

  Also remove `token` parameters from all exported functions — they no longer need it.

  Example before:
  ```js
  export async function fetchMe(token) {
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  ```

  After:
  ```js
  export async function fetchMe() {
    const res = await fetch('/api/me', {
      credentials: 'include', // ensure cookies are sent
    });
  ```

  Add `credentials: 'include'` to every `fetch()` call in `api.js` to be explicit.

- [ ] **Step 9b: Update `src/sw.js` `cacheKeyWillBeUsed` for cookie auth (if Task 2.5 was applied)**

  After cookie migration, API requests no longer carry an `Authorization` header, so `src/sw.js`'s `cacheKeyWillBeUsed` plugin will always receive `null` from `request.headers.get('Authorization')` and fall back to the unauthenticated path. Per-user cache isolation breaks.

  Update `cacheKeyWillBeUsed` to read user identity from the `Cookie` header instead:
  ```js
  cacheKeyWillBeUsed: async ({ request }) => {
    try {
      const cookieHeader = request.headers.get('Cookie') ?? '';
      const jwtMatch = cookieHeader.match(/(?:^|;\s*)jwt=([^;]+)/);
      if (!jwtMatch) return request;
      const token = jwtMatch[1];
      const payload = JSON.parse(atob(token.split('.')[1]));
      const uid = payload.sub ?? payload.id ?? payload.user_id;
      if (!uid) return request;
      const url = new URL(request.url);
      url.searchParams.set('_sw_uid', String(uid));
      return url.toString();
    } catch {
      return request;
    }
  },
  ```

  Also update `cacheWillUpdate` — the `Authorization` header check will always be false after migration. Replace it with a cookie check:
  ```js
  cacheWillUpdate: async ({ request, response }) => {
    const cookieHeader = request.headers.get('Cookie') ?? '';
    if (!cookieHeader.includes('jwt=')) return null;
    return response;
  },
  ```

- [ ] **Step 10: Update all call sites that pass `token` to API functions**

  Search for all places that pass a `token` argument:
  ```bash
  grep -rn "token)" src/ --include="*.js" --include="*.jsx" | grep -v __tests__
  ```
  Remove the `token` argument from each call site.

- [ ] **Step 11: Run full frontend suite**
  ```bash
  npx vitest run
  ```
  Expected: all pass. Fix any tests that mock `token` arguments.

- [ ] **Step 12: Commit**
  ```bash
  git add backend/main.py backend/tests/test_auth.py \
    src/context/AuthContext.jsx src/utils/api.js
  git commit -m "feat: migrate JWT from localStorage to httpOnly cookie (XSS protection)"
  ```

- [ ] **Step 13: Coordinate deploy**

  This is a breaking change. Before merging to `main`:
  1. Announce to beta users: "We're pushing a security update. You'll be signed out once — just sign in again."
  2. Deploy.
  3. Confirm the migration notice appears for any user who was previously logged in.

---

## Chunk 3: Alembic migrations (Task 3.3)

### Task 3.3 — Replace cold-start migration hack with Alembic

**Files:**
- Modify: `backend/requirements.txt`
- Create: `alembic.ini` (repo root)
- Create: `alembic/` directory with initial migration
- Modify: `backend/database.py` (remove `_sync_add_missing_columns`, `_backfill_*` functions)
- Modify: `backend/main.py` (update `init_db` call or remove migration on startup)

- [ ] **Step 1: Add Alembic to requirements**

  Add to `backend/requirements.txt`:
  ```
  alembic>=1.13.0
  ```

  Install it:
  ```bash
  pip install alembic>=1.13.0
  ```

- [ ] **Step 1b: Create `backend/__init__.py`**

  `backend/__init__.py` does not exist yet. Alembic's `env.py` will do `from backend.database import Base`, which requires the `backend/` directory to be a Python package.

  ```bash
  touch backend/__init__.py
  ```

  Commit it alongside the Alembic files later (or commit now to keep things clean).

- [ ] **Step 2: Initialise Alembic for async SQLAlchemy**

  From the repo root:
  ```bash
  cd /path/to/world-tracker
  alembic init alembic
  ```

  This creates `alembic.ini` and `alembic/` directory.

- [ ] **Step 3: Configure `alembic/env.py` for async SQLAlchemy**

  Replace the default `alembic/env.py` with an async-compatible version:
  ```python
  import asyncio
  import os
  import sys
  from logging.config import fileConfig

  from sqlalchemy import pool
  from sqlalchemy.engine import Connection
  from sqlalchemy.ext.asyncio import async_engine_from_config

  from alembic import context

  # Ensure backend/ is importable
  sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

  from backend.database import Base, DATABASE_URL
  from backend.models import (  # noqa: F401 — ensures models are registered on Base.metadata
      User, VisitedRegions, VisitedWorld, FriendRequest, Friendship,
      Challenge, ChallengeParticipant, WishlistItem, XpLog,
  )

  config = context.config
  if config.config_file_name is not None:
      fileConfig(config.config_file_name)

  target_metadata = Base.metadata


  def run_migrations_offline() -> None:
      # Alembic's offline mode generates SQL without connecting, but still
      # parses the URL dialect. The async driver prefix (+asyncpg) is not
      # supported for offline SQL generation — strip it to a sync dialect.
      url = DATABASE_URL.replace("+asyncpg", "").replace("+aiosqlite", "")
      context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
      with context.begin_transaction():
          context.run_migrations()


  def do_run_migrations(connection: Connection) -> None:
      context.configure(connection=connection, target_metadata=target_metadata)
      with context.begin_transaction():
          context.run_migrations()


  async def run_async_migrations() -> None:
      cfg = config.get_section(config.config_ini_section, {})
      cfg["sqlalchemy.url"] = DATABASE_URL
      connectable = async_engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
      async with connectable.connect() as connection:
          await connection.run_sync(do_run_migrations)
      await connectable.dispose()


  def run_migrations_online() -> None:
      asyncio.run(run_async_migrations())


  if context.is_offline_mode():
      run_migrations_offline()
  else:
      run_migrations_online()
  ```

- [ ] **Step 4: Update `alembic.ini` to point at the DB**

  In `alembic.ini`, the `sqlalchemy.url` line will be overridden by `env.py`, so it can be a placeholder:
  ```ini
  sqlalchemy.url = postgresql+psycopg://placeholder/placeholder
  ```

- [ ] **Step 5: Generate the initial migration from the current models**

  Ensure `ENCRYPTION_MASTER_KEY`, `JWT_SECRET`, and `DATABASE_URL` (or Neon vars) are set in your shell, then:
  ```bash
  alembic revision --autogenerate -m "initial schema"
  ```

  This creates `alembic/versions/<hash>_initial_schema.py`.

- [ ] **Step 6: Review the generated migration**

  Open the generated file. Confirm it contains `CREATE TABLE` statements for all 9 tables:
  - `users`, `visited_regions`, `visited_world`, `friend_requests`, `friendships`
  - `challenges`, `challenge_participants`, `wishlist`, `xp_log`

  If any table is missing, the models weren't imported in `env.py`. Fix the imports and regenerate.

- [ ] **Step 7: Test the migration against the local DB**
  ```bash
  alembic upgrade head
  ```
  Expected: applies cleanly with no errors.

  Check it's idempotent:
  ```bash
  alembic upgrade head  # running again should be a no-op
  ```

- [ ] **Step 8: Write a test that verifies the migration history is readable**

  Add to `backend/tests/test_admin_tasks.py` (or a new `test_migrations.py`):
  ```python
  import os

  def test_alembic_migration_history_is_valid():
      """Alembic can read its own migration history without errors."""
      from alembic.config import Config
      from alembic.script import ScriptDirectory

      # Tests run from the backend/ directory (via `cd backend && pytest`).
      # alembic.ini lives in the repo root, one level up.
      alembic_ini = os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
      cfg = Config(os.path.abspath(alembic_ini))
      scripts = ScriptDirectory.from_config(cfg)
      revisions = list(scripts.walk_revisions())
      assert len(revisions) >= 1, "Expected at least one migration revision"
  ```

  Run it:
  ```bash
  cd backend
  pytest tests/test_migrations.py -v
  ```
  Expected: PASS

- [ ] **Step 9: Remove the cold-start migration from `backend/database.py`**

  In `backend/database.py`, delete:
  - `_get_column_default_sql()` function
  - `_column_type_sql()` function
  - `_sync_add_missing_columns()` function
  - `_backfill_friend_codes()` function
  - `_backfill_wishlist_items()` function

  Update `init_db()` to just create tables (for safety in dev) without the column-add logic:
  ```python
  async def init_db():
      """Create tables if they don't exist (dev/Docker only).
      In production, run `alembic upgrade head` before deploying.
      Failures are logged but do not crash the app.
      """
      logger.info("init_db: creating tables if missing …")
      try:
          async with engine.begin() as conn:
              await conn.run_sync(Base.metadata.create_all)
          logger.info("init_db: done")
      except Exception as e:
          if IS_SERVERLESS:
              logger.warning("init_db skipped on serverless: %s", e)
          else:
              logger.error("init_db failed: %s", e)
              raise
  ```

- [ ] **Step 10: Run full backend test suite**
  ```bash
  cd backend && pytest -v
  ```
  Expected: all pass

- [ ] **Step 11: Add a migration helper to `package.json`**

  In the root `package.json`, add a script:
  ```json
  "scripts": {
    "migrate": "cd backend && alembic upgrade head",
    "migrate:status": "cd backend && alembic current",
    "migrate:history": "cd backend && alembic history"
  }
  ```

- [ ] **Step 12: Document the deploy workflow**

  Add `DEPLOY.md` (or update the README) with:
  ```markdown
  ## Deploying schema changes

  Before each Vercel production deploy that includes model changes:
  ```bash
  npm run migrate
  ```

  This runs `alembic upgrade head` against the production database.
  The Vercel function will then pick up the updated schema on the next cold start.
  ```

- [ ] **Step 13: Commit**
  ```bash
  git add alembic.ini alembic/ backend/__init__.py backend/requirements.txt backend/database.py \
    backend/tests/ package.json
  git commit -m "feat: add Alembic migrations — remove cold-start schema hack from database.py"
  ```

---

## Final verification

- [ ] **Run full backend suite**
  ```bash
  cd backend && pytest -v
  ```
  Expected: all pass

- [ ] **Run full frontend suite**
  ```bash
  npx vitest run
  ```
  Expected: all pass

- [ ] **Run `alembic upgrade head` on a fresh DB** (e.g. a new Neon branch) to verify the migration applies cleanly from scratch

- [ ] **Open a PR targeting `main`**

  Title: `feat: production hardening — Plan 3 architectural improvements (3 tasks)`

  Note: Task 3.2 (cookie migration) requires a coordinated deploy announcement to beta users.
