# Production Hardening — Plan 2: Medium-risk Hardening

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CORS domain restriction, rate limiting, error boundary, N+1 query fix, and PWA cache fix — each independently deployable, all validated in the beta environment.

**Architecture:** Backend middleware additions (CORS, rate limiting), new React class component (ErrorBoundary), batch query optimisation, and Workbox config tweak. No schema changes, no breaking changes to the API contract.

**Tech Stack:** FastAPI + `slowapi`, React 18 class components, Workbox (via vite-plugin-pwa), pytest + httpx, vitest

**Spec:** `docs/superpowers/specs/2026-03-15-production-hardening-design.md`

**Prerequisites:** Deploy to beta environment first. Tasks 2.1 and 2.2 require verifying headers/rate limits against a real HTTPS endpoint.

---

## Chunk 1: Backend hardening (Tasks 2.1, 2.2, 2.4)

### Task 2.1 — Restrict CORS to production domain

**Files:**
- Modify: `backend/main.py` (lines 85–91)
- Modify: `backend/tests/test_auth.py` (add CORS origin tests)

- [ ] **Step 1: Write failing tests**

  Add to `backend/tests/test_auth.py`:
  ```python
  async def test_cors_returns_production_origin_when_configured(client):
      """CORS allows requests from the configured production origin."""
      with patch("main.ALLOWED_ORIGINS", ["https://rightworld.io"]):
          resp = await client.options(
              "/api/health",
              headers={
                  "Origin": "https://rightworld.io",
                  "Access-Control-Request-Method": "GET",
              },
          )
      # Vercel handles OPTIONS preflight but FastAPI sets the CORS headers
      assert resp.headers.get("access-control-allow-origin") == "https://rightworld.io"


  async def test_cors_rejects_unknown_origin_when_configured(client):
      """CORS does not echo back an unknown origin when allow_origins is restricted."""
      with patch("main.ALLOWED_ORIGINS", ["https://rightworld.io"]):
          resp = await client.get(
              "/api/health",
              headers={"Origin": "https://evil.example.com"},
          )
      assert resp.headers.get("access-control-allow-origin") != "https://evil.example.com"
  ```

- [ ] **Step 2: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_auth.py::test_cors_returns_production_origin_when_configured tests/test_auth.py::test_cors_rejects_unknown_origin_when_configured -v
  ```
  Expected: both tests FAIL with `AttributeError: <module 'main'> does not have the attribute 'ALLOWED_ORIGINS'`. This is the expected failure at this point — `ALLOWED_ORIGINS` does not exist in `main.py` yet so `patch()` cannot target it. Step 3 introduces the variable; after that the tests will exercise the CORS restriction logic instead.

- [ ] **Step 3: Implement CORS restriction in `backend/main.py`**

  Add an `ALLOWED_ORIGINS` variable directly after the existing config block (around line 70):
  ```python
  # Parse comma-separated ALLOWED_ORIGINS env var.
  # Falls back to ["*"] only in DEBUG mode for local dev.
  _raw_origins = os.getenv("ALLOWED_ORIGINS", "")
  ALLOWED_ORIGINS: list[str] = (
      [o.strip() for o in _raw_origins.split(",") if o.strip()]
      if _raw_origins
      else (["*"] if os.getenv("DEBUG", "false").lower() == "true" else [])
  )
  if not ALLOWED_ORIGINS:
      logger.warning(
          "ALLOWED_ORIGINS is not set and DEBUG is off — CORS will block all cross-origin requests. "
          "Set ALLOWED_ORIGINS=https://yourdomain.com in Vercel env vars."
      )
  ```

  Then update the `CORSMiddleware` block (lines 85–91):
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=ALLOWED_ORIGINS,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

- [ ] **Step 4: Run tests to confirm they pass**
  ```bash
  pytest tests/test_auth.py::test_cors_returns_production_origin_when_configured tests/test_auth.py::test_cors_rejects_unknown_origin_when_configured -v
  ```
  Expected: both PASS

- [ ] **Step 5: Run full backend suite**
  ```bash
  pytest -v
  ```
  Expected: all pass

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/test_auth.py
  git commit -m "fix: restrict CORS to ALLOWED_ORIGINS env var (no wildcard in production)"
  ```

- [ ] **Step 7: Add env var to Vercel**

  In Vercel dashboard → Settings → Environment Variables:
  ```
  ALLOWED_ORIGINS = https://rightworld.io,https://www.rightworld.io
  ```
  (Adjust to your actual production domain.)

- [ ] **Step 8: Validate in beta**

  After deploy, open browser DevTools → Network → any `/api/*` request → Response Headers.
  Confirm: `access-control-allow-origin: https://rightworld.io` (not `*`).

---

### Task 2.2 — Rate limiting on auth and batch endpoints

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_auth.py`

- [ ] **Step 1: Add `slowapi` to requirements**

  Add to `backend/requirements.txt`:
  ```
  slowapi>=0.1.9
  ```

- [ ] **Step 2: Write failing tests**

  Add to `backend/tests/test_auth.py`:
  ```python
  async def test_auth_endpoint_rate_limited_after_10_requests(client):
      """POST /auth/google returns 429 after 10 requests per minute from the same IP."""
      with patch("main.GOOGLE_CLIENT_ID", "test-client-id"):
          # Send 11 requests — the 11th should be rate-limited
          for i in range(10):
              await client.post("/auth/google", json={"token": "bad"})
          resp = await client.post("/auth/google", json={"token": "bad"})
      assert resp.status_code == 429


  async def test_batch_endpoint_rate_limited_after_60_requests(client, auth_headers):
      """POST /api/batch returns 429 after 60 requests per minute from the same user."""
      for i in range(60):
          await client.post("/api/batch", json={"actions": []}, headers=auth_headers)
      resp = await client.post("/api/batch", json={"actions": []}, headers=auth_headers)
      assert resp.status_code == 429
  ```

  Note: These tests exercise the rate limiter in-memory (no Redis required for slowapi's default in-memory backend).

  **Important — limiter state isolation:** slowapi's in-memory store is a module-level singleton shared across all tests in the process. If other tests in the suite have already sent requests to `/auth/google` or `/api/batch`, the counter will carry over and these tests may get a 429 sooner than expected (or a 200 when a 429 is expected). To prevent this, add a `reset_rate_limiter` fixture to `backend/tests/conftest.py`:

  ```python
  @pytest.fixture(autouse=True)
  async def reset_rate_limiter():
      """Reset slowapi in-memory counters before each test to prevent cross-test contamination."""
      try:
          from main import limiter
          limiter._storage.reset()
      except (ImportError, AttributeError):
          pass  # slowapi not yet installed — safe to skip
      yield
  ```

  This fixture uses `autouse=True` so it applies to every test automatically once added.

- [ ] **Step 3: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_auth.py::test_auth_endpoint_rate_limited_after_10_requests tests/test_auth.py::test_batch_endpoint_rate_limited_after_60_requests -v
  ```
  Expected: both FAIL (no 429 currently)

- [ ] **Step 4: Install the new package**
  ```bash
  pip install slowapi>=0.1.9
  ```

- [ ] **Step 5: Implement rate limiting in `backend/main.py`**

  Add imports at the top (after existing imports):
  ```python
  from slowapi import Limiter, _rate_limit_exceeded_handler
  from slowapi.util import get_remote_address
  from slowapi.errors import RateLimitExceeded
  ```

  Add limiter setup after the `ALLOWED_ORIGINS` block (before `app = FastAPI(...)`):
  ```python
  def _get_rate_limit_key(request: Request) -> str:
      """Use the real client IP from X-Forwarded-For on Vercel, or remote address."""
      forwarded_for = request.headers.get("x-forwarded-for")
      if forwarded_for:
          return forwarded_for.split(",")[0].strip()
      return get_remote_address(request)

  limiter = Limiter(key_func=_get_rate_limit_key)
  ```

  After `app = FastAPI(...)`, register the limiter:
  ```python
  app.state.limiter = limiter
  app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
  ```

  Add decorators to the two endpoints.

  On `/auth/google` (around line 297):
  ```python
  @app.post("/auth/google", response_model=GoogleLoginResponse)
  @limiter.limit("10/minute")
  async def google_login(request: Request, body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
  ```
  Note: `slowapi` requires `request: Request` as the first parameter on rate-limited endpoints.

  On `/api/batch` (around line 618):
  ```python
  @app.post("/api/batch")
  @limiter.limit("60/minute")
  async def batch_actions(
      request: Request,
      body: BatchRequest,
      user: CurrentUser = Depends(get_current_user),
      db: AsyncSession = Depends(get_db),
  ):
  ```

- [ ] **Step 6: Run tests to confirm they pass**
  ```bash
  pytest tests/test_auth.py::test_auth_endpoint_rate_limited_after_10_requests tests/test_auth.py::test_batch_endpoint_rate_limited_after_60_requests -v
  ```
  Expected: both PASS

- [ ] **Step 7: Run full backend suite**
  ```bash
  pytest -v
  ```
  Expected: all pass. If existing auth tests fail because `google_login` now requires `request: Request`, update the test calls to include a request fixture or mock.

- [ ] **Step 8: Commit**
  ```bash
  git add requirements.txt main.py tests/test_auth.py
  git commit -m "feat: rate limit /auth/google (10/min) and /api/batch (60/min) via slowapi"
  ```

---

### Task 2.4 — Fix N+1 queries in batch endpoint

**Files:**
- Modify: `backend/main.py` (`batch_actions` function, lines 618–741)
- Modify: `backend/tests/test_visited.py` (add query-count test)

The current batch endpoint queries the DB once per action. This task pre-fetches all needed records in bulk before the processing loop.

- [ ] **Step 1: Write a test verifying the query count is bounded**

  Add to `backend/tests/test_visited.py`:
  ```python
  async def test_batch_region_toggles_use_bounded_db_queries(client, auth_headers, mock_db):
      """50 region_toggle actions on the same country should hit the DB at most twice
      (one SELECT + one implicit for the INSERT if record is new), not 50 times."""
      call_count = 0
      original_execute = mock_db.execute

      async def counting_execute(stmt, *args, **kwargs):
          nonlocal call_count
          call_count += 1
          return await original_execute(stmt, *args, **kwargs)

      mock_db.execute = counting_execute

      actions = [
          {"action": "region_toggle", "payload": {"country_id": "ch", "region": f"r{i}", "action": "add"}}
          for i in range(50)
      ]
      resp = await client.post("/api/batch", json={"actions": actions}, headers=auth_headers)
      assert resp.status_code == 200
      # With the fix: 1 SELECT for all ch records + 1 SELECT for world (if any world_toggle)
      # Without the fix: 50 SELECTs
      assert call_count <= 5, f"Expected at most 5 DB queries, got {call_count}"
  ```

- [ ] **Step 2: Run test to confirm it fails (proves N+1 exists)**
  ```bash
  cd backend
  pytest tests/test_visited.py::test_batch_region_toggles_use_bounded_db_queries -v
  ```
  Expected: FAIL — `call_count` will be much larger than 5

- [ ] **Step 3: Refactor `batch_actions` in `backend/main.py`**

  Replace the current loop-with-queries pattern with a pre-fetch pattern.

  New structure of `batch_actions`:

  ```python
  @app.post("/api/batch")
  @limiter.limit("60/minute")  # if Task 2.2 is done; omit decorator if not
  async def batch_actions(
      request: Request,  # required by slowapi; remove if Task 2.2 not done yet
      body: BatchRequest,
      user: CurrentUser = Depends(get_current_user),
      db: AsyncSession = Depends(get_db),
  ):
      """Execute multiple actions in a single request (single DB transaction)."""
      if len(body.actions) > 50:
          raise HTTPException(status_code=400, detail="Too many actions (max 50)")

      uid = user.id

      # ── 1. Pre-fetch all records needed by this batch ──────────────────────
      # Collect unique country_ids referenced by region_toggle actions
      region_country_ids = {
          p.get("country_id", "")
          for item in body.actions
          if item.action == "region_toggle"
          for p in [item.payload]
          if p.get("country_id") in VALID_COUNTRIES
      }

      # Bulk fetch all VisitedRegions rows for this user in one query
      region_records: dict[str, VisitedRegions] = {}
      if region_country_ids:
          result = await db.execute(
              select(VisitedRegions).where(
                  VisitedRegions.user_id == uid,
                  VisitedRegions.country_id.in_(region_country_ids),
              )
          )
          for r in result.scalars().all():
              region_records[r.country_id] = r

      # Fetch VisitedWorld once if any world_toggle actions exist
      world_record = None
      has_world_toggle = any(item.action == "world_toggle" for item in body.actions)
      if has_world_toggle:
          result = await db.execute(select(VisitedWorld).where(VisitedWorld.user_id == uid))
          world_record = result.scalar_one_or_none()

      # Collect unique (tracker_id, region_id) pairs for wishlist actions
      wishlist_keys = {
          (p.get("tracker_id", ""), p.get("region_id", ""))
          for item in body.actions
          if item.action in ("wishlist_upsert", "wishlist_delete")
          for p in [item.payload]
      }
      wishlist_records: dict[tuple[str, str], WishlistItem] = {}
      if wishlist_keys:
          tracker_ids = {k[0] for k in wishlist_keys}
          region_ids = {k[1] for k in wishlist_keys}
          result = await db.execute(
              select(WishlistItem).where(
                  WishlistItem.user_id == uid,
                  WishlistItem.tracker_id.in_(tracker_ids),
                  WishlistItem.region_id.in_(region_ids),
              )
          )
          for wi in result.scalars().all():
              wishlist_records[(wi.tracker_id, wi.region_id)] = wi

      # ── 2. Process actions using pre-fetched records ────────────────────────
      results = []
      for item in body.actions:
          action = item.action
          p = item.payload

          if action == "region_toggle":
              country_id = p.get("country_id", "")
              region = p.get("region", "")
              act = p.get("action", "")
              if country_id not in VALID_COUNTRIES or act not in ("add", "remove"):
                  results.append({"action": action, "ok": False, "error": "invalid params"})
                  continue
              record = region_records.get(country_id)
              if not record:
                  record = VisitedRegions(
                      user_id=uid, country_id=country_id,
                      regions=enc_json(uid, []), dates=enc_json(uid, {}),
                      notes=enc_json(uid, {}), wishlist=enc_json(uid, []),
                  )
                  db.add(record)
                  region_records[country_id] = record
              regions = dec_json_safe(uid, record.regions) or []
              dates = dec_json_safe(uid, record.dates) or {}
              notes = dec_json_safe(uid, record.notes) or {}
              if act == "add":
                  if region not in regions:
                      regions.append(region)
              else:
                  if region in regions:
                      regions.remove(region)
                  dates.pop(region, None)
                  notes.pop(region, None)
              record.regions = enc_json(uid, regions)
              record.dates = enc_json(uid, dates)
              record.notes = enc_json(uid, notes)
              record.updated_at = datetime.now(timezone.utc)
              results.append({"action": action, "ok": True})

          elif action == "world_toggle":
              country_code = p.get("country", "")
              act = p.get("action", "")
              if act not in ("add", "remove"):
                  results.append({"action": action, "ok": False, "error": "invalid params"})
                  continue
              if not world_record:
                  world_record = VisitedWorld(user_id=uid, countries=enc_json(uid, []))
                  db.add(world_record)
              countries_list = dec_json_safe(uid, world_record.countries) or []
              if act == "add":
                  if country_code not in countries_list:
                      countries_list.append(country_code)
              else:
                  if country_code in countries_list:
                      countries_list.remove(country_code)
              world_record.countries = enc_json(uid, countries_list)
              world_record.updated_at = datetime.now(timezone.utc)
              results.append({"action": action, "ok": True})

          elif action == "wishlist_upsert":
              tracker_id = p.get("tracker_id", "")
              region_id = p.get("region_id", "")
              priority = p.get("priority", "medium")
              target_date = p.get("target_date")
              notes_val = p.get("notes")
              category = p.get("category", "solo")
              wi = wishlist_records.get((tracker_id, region_id))
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
                  wishlist_records[(tracker_id, region_id)] = wi
              results.append({"action": action, "ok": True})

          elif action == "wishlist_delete":
              tracker_id = p.get("tracker_id", "")
              region_id = p.get("region_id", "")
              del_result = await db.execute(
                  delete(WishlistItem).where(
                      WishlistItem.user_id == uid,
                      WishlistItem.tracker_id == tracker_id,
                      WishlistItem.region_id == region_id,
                  )
              )
              wishlist_records.pop((tracker_id, region_id), None)
              results.append({"action": action, "ok": del_result.rowcount > 0})

          else:
              results.append({"action": action, "ok": False, "error": "unknown action"})

      # Commit the whole batch as one transaction.
      # Preserve the existing try/except/rollback pattern from the original code.
      try:
          await db.commit()
      except Exception:
          await db.rollback()
          raise HTTPException(status_code=500, detail="Database error")
      return {"results": results}
  ```

  Note: `wishlist_delete` actions still issue one `DELETE` statement per action inside the loop (they cannot be easily pre-fetched because the delete is the mutation itself). This is acceptable — individual `DELETE` by primary key is fast and the batch is capped at 50 actions. The N+1 fix here eliminates the expensive `SELECT` per action for `region_toggle` and `world_toggle` which were the primary culprits.

- [ ] **Step 4: Run the query count test**
  ```bash
  pytest tests/test_visited.py::test_batch_region_toggles_use_bounded_db_queries -v
  ```
  Expected: PASS

- [ ] **Step 5: Run full backend suite**
  ```bash
  pytest -v
  ```
  Expected: all pass

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/test_visited.py
  git commit -m "perf: fix N+1 queries in batch endpoint — pre-fetch all records before loop"
  ```

---

## Chunk 2: Frontend hardening (Tasks 2.3, 2.5)

### Task 2.3 — React `<ErrorBoundary>` component

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `src/components/__tests__/ErrorBoundary.test.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write a failing test**

  Create `src/components/__tests__/ErrorBoundary.test.jsx`:
  ```jsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import ErrorBoundary from '../ErrorBoundary';

  function ThrowingComponent() {
    throw new Error('test error');
  }

  describe('ErrorBoundary', () => {
    it('renders children when no error is thrown', () => {
      render(
        <ErrorBoundary>
          <div>hello</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('hello')).toBeTruthy();
    });

    it('renders fallback UI when a child throws', () => {
      // Suppress expected error output in test console
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText(/something went wrong/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
      spy.mockRestore();
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**
  ```bash
  npx vitest run src/components/__tests__/ErrorBoundary.test.jsx
  ```
  Expected: FAIL (`ErrorBoundary` module not found)

- [ ] **Step 3: Create `src/components/ErrorBoundary.jsx`**

  ```jsx
  import { Component } from 'react';

  export default class ErrorBoundary extends Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error, info) {
      console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '1rem',
            fontFamily: 'sans-serif',
            color: '#444',
          }}>
            <p style={{ fontSize: '1.1rem' }}>Something went wrong. Please reload the page.</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.5rem',
                borderRadius: '6px',
                border: '1px solid #ccc',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Reload
            </button>
          </div>
        );
      }
      return this.props.children;
    }
  }
  ```

- [ ] **Step 4: Run test to confirm it passes**
  ```bash
  npx vitest run src/components/__tests__/ErrorBoundary.test.jsx
  ```
  Expected: PASS

- [ ] **Step 5: Verify `src/main.jsx` already wraps the app with `<ErrorBoundary>`**

  `src/main.jsx` already imports and uses an `ErrorBoundary` (from `@sentry/react`). No changes to `main.jsx` are required. Confirm this by opening `src/main.jsx` and checking the render call includes `<ErrorBoundary>`.

  The `src/components/ErrorBoundary.jsx` created in Step 3 is a standalone component that the test suite exercises independently. It does not need to be wired into `main.jsx` since coverage at the app root is already present via Sentry's boundary.

- [ ] **Step 6: Run full frontend suite**
  ```bash
  npx vitest run
  ```
  Expected: all pass

- [ ] **Step 7: Commit**
  ```bash
  git add src/components/ErrorBoundary.jsx src/components/__tests__/ErrorBoundary.test.jsx
  git commit -m "feat: add tested ErrorBoundary component (app root already covered by Sentry boundary)"
  ```

---

### Task 2.5 — Fix PWA API cache — only cache 200 responses

**Files:**
- Modify: `src/sw.js` (the custom service worker — NOT `vite.config.js`)

Note: This project uses VitePWA in `injectManifest` mode (a custom service worker at `src/sw.js`). The API cache rules are defined in `src/sw.js`, not in `vite.config.js`.

The current `src/sw.js` API route (around line 38) already has a `cacheWillUpdate` plugin that skips unauthenticated responses and a per-user cache key plugin. What's missing is: (1) a `CacheableResponsePlugin` to only cache 200 status responses, (2) a reduced TTL, (3) a tighter URL pattern.

- [ ] **Step 1: Update the API cache route in `src/sw.js`**

  Find the current API `registerRoute` block (the one with `cacheName: 'api-cache'`):
  ```js
  registerRoute(
    /^https?:\/\/.*\/api\/.*/,
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
        {
          cacheWillUpdate: async ({ request, response }) => { ... },
          cacheKeyWillBeUsed: async ({ request }) => { ... },
        },
      ],
    })
  );
  ```

  Replace with:
  ```js
  registerRoute(
    // Tightened to production domain — avoids matching third-party HTTPS
    // URLs that happen to contain /api/ in the path.
    // Local dev uses HTTP so this rule does not fire in development.
    /^https:\/\/rightworld\.io\/api\/.*/,
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 5,
      plugins: [
        new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 }), // 5 min (was 24h)
        // Only cache successful responses — never cache 401/403/500 errors
        new CacheableResponsePlugin({ statuses: [200] }),
        {
          // Skip caching unauthenticated responses — prevents guest data
          // from entering the cache and bleeding to authenticated users.
          cacheWillUpdate: async ({ request, response }) => {
            if (!request.headers.get('Authorization')) return null;
            return response;
          },
          // Append user ID from JWT sub claim to cache key so user A's
          // cached API responses never bleed to user B on a shared device.
          cacheKeyWillBeUsed: async ({ request }) => {
            const auth = request.headers.get('Authorization') ?? '';
            try {
              const token = auth.replace('Bearer ', '');
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
        },
      ],
    })
  );
  ```

  Note: `CacheableResponsePlugin` is already imported at the top of `sw.js`. No new import needed.

  Note: Update `rightworld.io` to your actual production domain if different.

- [ ] **Step 2: Verify the service worker builds cleanly**
  ```bash
  npx vite build 2>&1 | tail -10
  ```
  Expected: build succeeds with no errors

- [ ] **Step 3: Commit**
  ```bash
  git add src/sw.js
  git commit -m "fix: PWA API cache — only cache 200 responses, reduce TTL to 5min, tighten URL pattern"
  ```

- [ ] **Step 4: Manual validation after beta deploy**

  Open the app in Chrome → DevTools → Application → Cache Storage → `api-cache`.
  Make an API request that returns 200 → confirm it appears in the cache.
  Sign out (triggers 401 on next request) → confirm the 401 is NOT cached.

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

- [ ] **Open a PR targeting `main`**

  Title: `fix: production hardening — Plan 2 medium-risk hardening (5 tasks)`
