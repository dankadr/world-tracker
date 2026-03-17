# Production Hardening — Plan 1: Zero-risk Quick Wins

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 9 independent hardening tasks with zero regression risk — each can be merged as a separate PR.

**Architecture:** Pure additions/guards with no changes to existing behaviour. Each task is a self-contained file edit with its own test and commit.

**Tech Stack:** FastAPI + Pydantic v2, React 18 + Vite, pytest + httpx (backend), vitest (frontend)

**Spec:** `docs/superpowers/specs/2026-03-15-production-hardening-design.md`

---

## Chunk 1: Backend quick wins (Tasks 1.1 – 1.4, 1.6 – 1.8)

### Task 1.1 — Add `cryptography` to `requirements.txt` explicitly

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add explicit dependency**

  Open `backend/requirements.txt` and add after the `python-jose[cryptography]` line:
  ```
  cryptography>=42.0.0
  ```
  Final file should look like:
  ```
  fastapi>=0.115.0
  uvicorn[standard]>=0.34.0
  sqlalchemy[asyncio]>=2.0.36
  asyncpg>=0.30.0
  psycopg[binary]>=3.1.0
  python-jose[cryptography]>=3.3.0
  cryptography>=42.0.0
  google-auth>=2.37.0
  requests>=2.32.0
  pydantic>=2.10.0
  ```

- [ ] **Step 2: Commit**
  ```bash
  cd backend
  git add requirements.txt
  git commit -m "chore: make cryptography an explicit dependency"
  ```

---

### Task 1.2 — Move `ADMIN_EMAIL` to env var

**Files:**
- Modify: `backend/main.py` (lines 256–263)
- Modify: `backend/tests/test_auth.py` (add 2 tests)

- [ ] **Step 1: Write failing tests**

  Add to `backend/tests/test_auth.py`:
  ```python
  import pytest
  from unittest.mock import patch


  async def test_admin_encrypt_returns_503_when_admin_email_unset(client, auth_headers):
      """Admin endpoints return 503 when ADMIN_EMAIL env var is not configured."""
      with patch("main.ADMIN_EMAIL", None):
          resp = await client.post("/admin/encrypt", headers=auth_headers)
      assert resp.status_code == 503


  async def test_admin_endpoint_forbidden_for_non_admin(client, auth_headers):
      """Non-admin users get 403 regardless of ADMIN_EMAIL config."""
      with patch("main.ADMIN_EMAIL", "admin@example.com"):
          resp = await client.post("/admin/encrypt", headers=auth_headers)
      assert resp.status_code == 403
  ```

- [ ] **Step 2: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_auth.py::test_admin_encrypt_returns_503_when_admin_email_unset tests/test_auth.py::test_admin_endpoint_forbidden_for_non_admin -v
  ```
  Expected: both FAIL (503 test will get 403 since email is still hardcoded)

- [ ] **Step 3: Implement the change in `backend/main.py`**

  Replace the current hardcoded block (around line 256):
  ```python
  ADMIN_EMAIL = "dankadr100@gmail.com"


  async def require_admin(user: CurrentUser = Depends(get_current_user)):
      """Dependency: raises 403 unless the caller is the admin user."""
      if user.email != ADMIN_EMAIL:
          raise HTTPException(status_code=403, detail="Admin access required")
      return user
  ```

  With:
  ```python
  ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
  if not ADMIN_EMAIL:
      logger.warning("ADMIN_EMAIL env var is not set — admin endpoints will return 503")


  async def require_admin(user: CurrentUser = Depends(get_current_user)):
      """Dependency: raises 503 if ADMIN_EMAIL is unconfigured, 403 if not the admin."""
      if not ADMIN_EMAIL:
          raise HTTPException(status_code=503, detail="Admin not configured")
      if user.email != ADMIN_EMAIL:
          raise HTTPException(status_code=403, detail="Admin access required")
      return user
  ```

- [ ] **Step 4: Run tests to confirm they pass**
  ```bash
  pytest tests/test_auth.py::test_admin_encrypt_returns_503_when_admin_email_unset tests/test_auth.py::test_admin_endpoint_forbidden_for_non_admin -v
  ```
  Expected: both PASS

- [ ] **Step 5: Run full backend test suite to catch regressions**
  ```bash
  pytest -v
  ```
  Expected: all tests pass

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/test_auth.py
  git commit -m "fix: move ADMIN_EMAIL to env var, return 503 if unset"
  ```

- [ ] **Step 7: Add env var to Vercel**

  In your Vercel dashboard → Settings → Environment Variables, add:
  ```
  ADMIN_EMAIL = <your-admin-email>
  ```

---

### Task 1.3 — Add missing security headers to `vercel.json`

**Files:**
- Modify: `vercel.json`

Note: `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` are already set in `vercel.json`. Only `Permissions-Policy` (and an optional CSP) are missing.

- [ ] **Step 1: Add `Permissions-Policy` header**

  In `vercel.json`, find the existing `/(.*)" headers block and add `Permissions-Policy`:
  ```json
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ]
  }
  ```

- [ ] **Step 2: Verify the change is valid JSON**
  ```bash
  python3 -m json.tool vercel.json > /dev/null && echo "valid JSON"
  ```
  Expected: `valid JSON`

- [ ] **Step 3: Commit**
  ```bash
  git add vercel.json
  git commit -m "chore: add Permissions-Policy security header"
  ```

- [ ] **Step 4: Manual verification after deploy**

  In browser DevTools → Network → click any request → Response Headers, confirm:
  - `permissions-policy: camera=(), microphone=(), geolocation=()`

---

### Task 1.4 — Cap batch endpoint at 50 actions

**Files:**
- Modify: `backend/main.py` (BatchRequest model + batch_actions handler)
- Modify: `backend/tests/test_visited.py` (add 1 test)

- [ ] **Step 1: Write failing test**

  Add to `backend/tests/test_visited.py`:
  ```python
  async def test_batch_rejects_more_than_50_actions(client, auth_headers):
      """Batch endpoint returns 422 when more than 50 actions are submitted."""
      actions = [
          {"action": "world_toggle", "payload": {"country": f"C{i}", "action": "add"}}
          for i in range(51)
      ]
      resp = await client.post("/api/batch", json={"actions": actions}, headers=auth_headers)
      assert resp.status_code == 422


  async def test_batch_accepts_exactly_50_actions(client, auth_headers):
      """Batch endpoint accepts exactly 50 actions."""
      # Note: do NOT request mock_db separately — the client fixture already
      # injects its own mock_db instance. Requesting it here creates a second
      # unrelated instance and any setup on it is ignored by the client.
      actions = [
          {"action": "world_toggle", "payload": {"country": f"C{i}", "action": "add"}}
          for i in range(50)
      ]
      resp = await client.post("/api/batch", json={"actions": actions}, headers=auth_headers)
      assert resp.status_code == 200
  ```

- [ ] **Step 2: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_visited.py::test_batch_rejects_more_than_50_actions tests/test_visited.py::test_batch_accepts_exactly_50_actions -v
  ```
  Expected: first test FAILS (currently returns 200 with 51 actions)

- [ ] **Step 3: Update `BatchRequest` model in `backend/main.py`**

  Find the current model (around line 203):
  ```python
  class BatchRequest(BaseModel):
      actions: list[BatchAction]
  ```

  Replace with:
  ```python
  from typing import Annotated

  class BatchRequest(BaseModel):
      actions: Annotated[list[BatchAction], Field(max_length=50)]
  ```

  Note: `Field` is already imported from pydantic. Add `Annotated` to the existing `from typing import` import at the top of the file, or add a new one if there is none.

  Also add a defence-in-depth guard at the top of `batch_actions()` (around line 626):
  ```python
  @app.post("/api/batch")
  async def batch_actions(
      body: BatchRequest,
      user: CurrentUser = Depends(get_current_user),
      db: AsyncSession = Depends(get_db),
  ):
      """Execute multiple actions in a single request (single DB transaction)."""
      if len(body.actions) > 50:
          raise HTTPException(status_code=400, detail="Too many actions (max 50)")
      # ... rest of function unchanged
  ```

- [ ] **Step 4: Run tests to confirm they pass**
  ```bash
  pytest tests/test_visited.py::test_batch_rejects_more_than_50_actions tests/test_visited.py::test_batch_accepts_exactly_50_actions -v
  ```
  Expected: both PASS

- [ ] **Step 5: Run full suite**
  ```bash
  pytest -v
  ```
  Expected: all pass

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/test_visited.py
  git commit -m "fix: cap batch endpoint at 50 actions (Pydantic v2 Annotated)"
  ```

---

### Task 1.6 — Cache Fernet instance per `(user_id, key_fingerprint)`

**Files:**
- Modify: `backend/crypto.py`
- Modify: `backend/tests/test_crypto.py` (add 1 test)

- [ ] **Step 1: Read the current `test_crypto.py` to understand test patterns**
  ```bash
  cat backend/tests/test_crypto.py
  ```

- [ ] **Step 2: Write a failing test for cache behaviour**

  Add to `backend/tests/test_crypto.py`:
  ```python
  def test_fernet_cache_reuses_instance_for_same_user():
      """_get_fernet returns the same Fernet object for the same user+key."""
      import crypto
      crypto._FERNET_CACHE.clear()

      f1 = crypto._get_fernet(1)
      f2 = crypto._get_fernet(1)
      assert f1 is f2, "Expected same Fernet instance to be reused from cache"
      crypto._FERNET_CACHE.clear()  # clean up


  def test_fernet_cache_different_users_get_different_instances():
      """Different user IDs produce different Fernet instances."""
      import crypto
      crypto._FERNET_CACHE.clear()

      f1 = crypto._get_fernet(1)
      f2 = crypto._get_fernet(2)
      assert f1 is not f2
      crypto._FERNET_CACHE.clear()
  ```

- [ ] **Step 3: Run tests to confirm they fail**
  ```bash
  cd backend
  pytest tests/test_crypto.py::test_fernet_cache_reuses_instance_for_same_user tests/test_crypto.py::test_fernet_cache_different_users_get_different_instances -v
  ```
  Expected: FAIL (`_get_fernet` does not exist yet)

- [ ] **Step 4: Implement the cache in `backend/crypto.py`**

  Replace the current content of `backend/crypto.py` with:
  ```python
  # backend/crypto.py
  import base64
  import hashlib
  import hmac
  import json
  import os

  from cryptography.fernet import Fernet, InvalidToken


  def _derive_key(user_id: int) -> bytes:
      master = bytes.fromhex(os.environ["ENCRYPTION_MASTER_KEY"])
      digest = hmac.new(master, str(user_id).encode(), hashlib.sha256).digest()
      return base64.urlsafe_b64encode(digest)


  # Cache Fernet instances to avoid re-deriving the key on every call.
  # Cache key = (user_id, master_key_fingerprint) so key rotation invalidates stale entries.
  _FERNET_CACHE: dict[tuple[int, str], Fernet] = {}


  def _get_fernet(user_id: int) -> Fernet:
      master = bytes.fromhex(os.environ["ENCRYPTION_MASTER_KEY"])
      fingerprint = master[:4].hex()  # first 4 bytes as cache discriminator (not secret)
      cache_key = (user_id, fingerprint)
      if cache_key not in _FERNET_CACHE:
          _FERNET_CACHE[cache_key] = Fernet(_derive_key(user_id))
      return _FERNET_CACHE[cache_key]


  def enc(user_id: int, plaintext: str) -> str:
      """Encrypt a string. Returns a Fernet token string."""
      return _get_fernet(user_id).encrypt(plaintext.encode()).decode()


  def dec(user_id: int, token: str) -> str:
      """Decrypt a Fernet token string. Raises InvalidToken on failure."""
      return _get_fernet(user_id).decrypt(token.encode()).decode()


  def enc_json(user_id: int, obj) -> str:
      """JSON-serialize obj then encrypt. Returns a Fernet token string."""
      return enc(user_id, json.dumps(obj, ensure_ascii=False))


  def dec_json(user_id: int, token: str):
      """Decrypt a Fernet token then JSON-parse."""
      return json.loads(dec(user_id, token))


  def is_encrypted(value) -> bool:
      """True if value is a Fernet token (starts with 'gAAAAA')."""
      return isinstance(value, str) and value.startswith("gAAAAA")


  def dec_json_safe(user_id: int, value):
      """
      Decrypt an encrypted JSON value, or parse a legacy plaintext JSON string.
      Handles: Fernet token, JSON string (pre-migration), Python object (JSONB), None.
      """
      if value is None:
          return None
      if is_encrypted(value):
          return dec_json(user_id, value)
      if isinstance(value, str):
          return json.loads(value)
      return value  # already a Python object (JSONB not yet migrated)


  def dec_str_safe(user_id: int, value):
      """
      Decrypt an encrypted string, or return the plaintext value as-is.
      Returns None if value is None.
      """
      if value is None:
          return None
      if is_encrypted(value):
          return dec(user_id, value)
      return value  # legacy plaintext
  ```

- [ ] **Step 5: Run tests to confirm they pass**
  ```bash
  pytest tests/test_crypto.py -v
  ```
  Expected: all pass (including existing tests + new cache tests)

- [ ] **Step 6: Run full suite**
  ```bash
  pytest -v
  ```
  Expected: all pass

- [ ] **Step 7: Commit**
  ```bash
  git add crypto.py tests/test_crypto.py
  git commit -m "perf: cache Fernet instance per (user_id, key_fingerprint) in crypto.py"
  ```

---

### Task 1.7 — Guard insecure `JWT_SECRET` default

**Files:**
- Modify: `backend/main.py` (lines 66–68)
- Modify: `backend/tests/conftest.py` (set JWT_SECRET for tests)

Important: The existing `conftest.py` does NOT set `JWT_SECRET` — it relies on the default. After this task, the app will crash on startup unless `JWT_SECRET` is explicitly set. We must update `conftest.py` first.

- [ ] **Step 1: Update `conftest.py` to set a test JWT secret**

  In `backend/tests/conftest.py`, find the env var setup block at the top:
  ```python
  os.environ.setdefault("ENCRYPTION_MASTER_KEY", "a" * 64)
  ```

  Add `JWT_SECRET` directly after it:
  ```python
  os.environ.setdefault("ENCRYPTION_MASTER_KEY", "a" * 64)
  os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
  ```

  Also update `_JWT_SECRET` in `conftest.py` to use the new test value so tokens still verify:
  ```python
  _JWT_SECRET = os.environ["JWT_SECRET"]  # reads from env — stays in sync
  ```

- [ ] **Step 2: Write tests for the startup guard**

  The guard runs at module-import time, which makes it hard to test via `importlib.reload`. Instead, the implementation will extract the logic into a small helper function `_assert_jwt_secret_safe(secret, debug)` that we can call directly in tests.

  Add to `backend/tests/test_auth.py`:
  ```python
  def test_jwt_secret_guard_raises_with_insecure_default():
      """Guard raises RuntimeError when JWT_SECRET is the known insecure default in production."""
      from main import _assert_jwt_secret_safe
      with pytest.raises(RuntimeError, match="JWT_SECRET"):
          _assert_jwt_secret_safe("change-me-in-production-please", "false")


  def test_jwt_secret_guard_allows_insecure_default_in_debug_mode():
      """Guard does not raise when DEBUG=true (local dev)."""
      from main import _assert_jwt_secret_safe
      # Should not raise
      _assert_jwt_secret_safe("change-me-in-production-please", "true")


  def test_jwt_secret_guard_allows_strong_secret():
      """Guard does not raise when a strong, non-default secret is provided."""
      from main import _assert_jwt_secret_safe
      _assert_jwt_secret_safe("a9f3c8b2d1e4f76a3b0c9d5e2f81a4b7c3d0e9f2a5b8c1d4e7f0a3b6c9d2e5f8", "false")
  ```

- [ ] **Step 3: Run tests to confirm conftest change didn't break anything**
  ```bash
  cd backend
  pytest -v
  ```
  Expected: all pass (conftest now provides a real test secret)

- [ ] **Step 4: Implement the guard in `backend/main.py`**

  Find lines 66–68:
  ```python
  JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
  JWT_ALGORITHM = "HS256"
  JWT_EXPIRE_DAYS = 30
  ```

  Replace with:
  ```python
  JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production-please")
  JWT_ALGORITHM = "HS256"
  JWT_EXPIRE_DAYS = 30

  _INSECURE_JWT_DEFAULT = "change-me-in-production-please"


  def _assert_jwt_secret_safe(secret: str, debug: str) -> None:
      """Raise RuntimeError in production if JWT_SECRET is the known-insecure default.
      Extracted as a function so it can be unit-tested directly.
      """
      if secret == _INSECURE_JWT_DEFAULT and debug.lower() != "true":
          raise RuntimeError(
              "JWT_SECRET must be set to a strong random secret in production. "
              "Generate one with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
          )


  _assert_jwt_secret_safe(JWT_SECRET, os.getenv("DEBUG", "false"))
  ```

- [ ] **Step 5: Run full test suite**
  ```bash
  pytest -v
  ```
  Expected: all pass (JWT_SECRET is set in conftest, guard does not trigger)

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/conftest.py tests/test_auth.py
  git commit -m "fix: crash on startup if JWT_SECRET is insecure default in production"
  ```

- [ ] **Step 7: Add env var to Vercel**

  In Vercel dashboard → Settings → Environment Variables:
  ```
  JWT_SECRET = <generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
  ```

---

### Task 1.8 — Add `GET /api/health` endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_auth.py` (add 1 test)

- [ ] **Step 1: Write failing test**

  Add to `backend/tests/test_auth.py`:
  ```python
  async def test_health_endpoint_returns_ok(client):
      """GET /api/health returns 200 with status ok, no auth required."""
      resp = await client.get("/api/health")
      assert resp.status_code == 200
      data = resp.json()
      assert data["status"] == "ok"
      assert "timestamp" in data
  ```

- [ ] **Step 2: Run test to confirm it fails**
  ```bash
  cd backend
  pytest tests/test_auth.py::test_health_endpoint_returns_ok -v
  ```
  Expected: FAIL (404 — route doesn't exist)

- [ ] **Step 3: Add the endpoint to `backend/main.py`**

  Add after the admin endpoints (around line 294), before `# --------------- Auth endpoint ---------------`:
  ```python
  # --------------- Health check ---------------
  @app.get("/api/health")
  async def health():
      """Liveness check — no auth, no DB. For uptime monitors."""
      return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
  ```

- [ ] **Step 4: Run test to confirm it passes**
  ```bash
  pytest tests/test_auth.py::test_health_endpoint_returns_ok -v
  ```
  Expected: PASS

- [ ] **Step 5: Run full suite**
  ```bash
  pytest -v
  ```
  Expected: all pass

- [ ] **Step 6: Commit**
  ```bash
  git add main.py tests/test_auth.py
  git commit -m "feat: add GET /api/health liveness endpoint"
  ```

---

## Chunk 2: Frontend quick wins (Tasks 1.5, 1.9)

### Task 1.5 — JWT expiry check inside `loadAuth()`

**Files:**
- Modify: `src/context/AuthContext.jsx` (lines 20–37)
- Create: `src/context/__tests__/AuthContext.test.jsx`

- [ ] **Step 1: Write failing tests**

  Create `src/context/__tests__/AuthContext.test.jsx`:
  ```jsx
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  // Helper to build a minimal JWT with a given exp timestamp
  function makeJwt(expSeconds) {
    const payload = { sub: '1', email: 'test@example.com', exp: expSeconds };
    const encoded = btoa(JSON.stringify(payload));
    return `header.${encoded}.signature`;
  }

  // We test loadAuth in isolation by importing the module under test
  // and mocking localStorage

  describe('loadAuth JWT expiry', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns null when JWT is expired', async () => {
      const { loadAuth } = await import('../AuthContext.jsx');
      const expiredExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = makeJwt(expiredExp);
      localStorage.setItem('swiss-tracker-auth', JSON.stringify({
        jwt_token: token,
        user: { id: 1, email: 'test@example.com', sub: 'google-sub' },
      }));
      expect(loadAuth()).toBeNull();
    });

    it('returns auth data when JWT is valid', async () => {
      const { loadAuth } = await import('../AuthContext.jsx');
      const validExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = makeJwt(validExp);
      localStorage.setItem('swiss-tracker-auth', JSON.stringify({
        jwt_token: token,
        user: { id: 1, email: 'test@example.com', sub: 'google-sub' },
      }));
      expect(loadAuth()).not.toBeNull();
    });
  });
  ```

  Note: Since `loadAuth` is not currently exported, the test will fail. We'll export it in Step 3.

- [ ] **Step 2: Run tests to confirm they fail**
  ```bash
  npx vitest run src/context/__tests__/AuthContext.test.jsx
  ```
  Expected: FAIL

- [ ] **Step 3: Update `loadAuth()` in `src/context/AuthContext.jsx`**

  Find the current `loadAuth` function (lines 20–37):
  ```js
  function loadAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.jwt_token && data.user) {
          // Backfill email from JWT payload if missing (e.g. older cached auth)
          if (!data.user.email) {
            data.user.email = decodeJwtEmail(data.jwt_token);
          }
          return data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
  ```

  Replace with:
  ```js
  function isJwtExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Add 60-second buffer to auto-logout slightly before exact expiry
      return payload.exp < Math.floor(Date.now() / 1000) + 60;
    } catch {
      return true; // treat unreadable tokens as expired
    }
  }

  export function loadAuth() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.jwt_token && data.user) {
          if (isJwtExpired(data.jwt_token)) {
            localStorage.removeItem(STORAGE_KEY); // clean up stale token
            return null;
          }
          // Backfill email from JWT payload if missing (e.g. older cached auth)
          if (!data.user.email) {
            data.user.email = decodeJwtEmail(data.jwt_token);
          }
          return data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
  ```

  Note: We export `loadAuth` for testing. The existing `useState(() => loadAuth())` call inside `AuthProvider` does not need to change — it will now automatically return `null` for expired tokens.

- [ ] **Step 4: Run tests to confirm they pass**
  ```bash
  npx vitest run src/context/__tests__/AuthContext.test.jsx
  ```
  Expected: PASS

- [ ] **Step 5: Run full frontend suite**
  ```bash
  npx vitest run
  ```
  Expected: all 182+ tests pass

- [ ] **Step 6: Commit**
  ```bash
  git add src/context/AuthContext.jsx src/context/__tests__/AuthContext.test.jsx
  git commit -m "fix: auto-logout if JWT is expired on app load (loadAuth expiry check)"
  ```

---

### Task 1.9 — Guard `console.log/warn` behind `import.meta.env.DEV`

**Files:**
- Create: `src/utils/logger.js`
- Modify: 19 files (listed below) — replace `console.log`, `console.warn`, `console.debug` with `logger.*`

The 19 files containing `console.*` calls:
```
src/App.jsx
src/components/ChallengeScreen.jsx
src/components/ChallengesPanel.jsx
src/components/DataExport.jsx
src/components/ExportButton.jsx
src/components/ProfileScreen.jsx
src/components/YearInReview.jsx
src/context/AuthContext.jsx
src/context/FriendsContext.jsx
src/hooks/useChallenges.js
src/hooks/useFriendsData.js
src/hooks/useUnescoVisited.js
src/hooks/useVisitedCantons.js
src/hooks/useVisitedCountries.js
src/hooks/useWishlist.js
src/utils/api.js
src/utils/batchQueue.js
src/utils/secureStorage.js
src/utils/syncLocalData.js
```

- [ ] **Step 1: Write a test for the logger**

  Create `src/utils/__tests__/logger.test.js`:
  ```js
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  describe('logger', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('calls console.log in dev mode', async () => {
      vi.stubEnv('DEV', true);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { logger } = await import('../logger.js');
      logger.log('test message');
      expect(spy).toHaveBeenCalledWith('test message');
      spy.mockRestore();
    });

    it('does not call console.log in production mode', async () => {
      vi.stubEnv('DEV', false);
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { logger } = await import('../logger.js');
      logger.log('test message');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('always calls console.error regardless of mode', async () => {
      vi.stubEnv('DEV', false);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { logger } = await import('../logger.js');
      logger.error('error message');
      expect(spy).toHaveBeenCalledWith('error message');
      spy.mockRestore();
    });
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**
  ```bash
  npx vitest run src/utils/__tests__/logger.test.js
  ```
  Expected: FAIL (logger.js does not exist)

- [ ] **Step 3: Create `src/utils/logger.js`**
  ```js
  /**
   * Production-safe logger. console.log/warn/debug are no-ops in production builds.
   * console.error is always enabled — unexpected errors should always surface.
   *
   * Usage: import { logger } from './logger.js';
   *        logger.log('message');   // dev only
   *        logger.error('oops');    // always logged
   */
  const isDev = import.meta.env.DEV;

  export const logger = {
    log: isDev ? console.log.bind(console) : () => {},
    warn: isDev ? console.warn.bind(console) : () => {},
    debug: isDev ? console.debug.bind(console) : () => {},
    error: console.error.bind(console),
  };
  ```

- [ ] **Step 4: Run test to confirm it passes**
  ```bash
  npx vitest run src/utils/__tests__/logger.test.js
  ```
  Expected: PASS

- [ ] **Step 5: Update all 19 files**

  For each file listed above, do the following:
  1. Add `import { logger } from '../utils/logger.js';` (adjust relative path based on file location)
  2. Replace every `console.log(` → `logger.log(`
  3. Replace every `console.warn(` → `logger.warn(`
  4. Replace every `console.debug(` → `logger.debug(`
  5. Leave `console.error(` as-is (it always logs — no change needed)

  Relative import paths by directory:
  - `src/utils/*.js` → `import { logger } from './logger.js';`
  - `src/hooks/*.js` → `import { logger } from '../utils/logger.js';`
  - `src/context/*.jsx` → `import { logger } from '../utils/logger.js';`
  - `src/components/*.jsx` → `import { logger } from '../utils/logger.js';`
  - `src/App.jsx` → `import { logger } from './utils/logger.js';`

- [ ] **Step 6: Run full frontend test suite**
  ```bash
  npx vitest run
  ```
  Expected: all tests pass

- [ ] **Step 7: Verify no stray `console.log` calls remain**
  ```bash
  grep -rn "console\.log\|console\.warn\|console\.debug" src/ --include="*.js" --include="*.jsx" | grep -v __tests__ | grep -v logger.js
  ```
  Expected: no output

- [ ] **Step 8: Commit**
  ```bash
  git add src/utils/logger.js src/utils/__tests__/logger.test.js \
    src/App.jsx \
    src/components/ChallengeScreen.jsx src/components/ChallengesPanel.jsx \
    src/components/DataExport.jsx src/components/ExportButton.jsx \
    src/components/ProfileScreen.jsx src/components/YearInReview.jsx \
    src/context/AuthContext.jsx src/context/FriendsContext.jsx \
    src/hooks/useChallenges.js src/hooks/useFriendsData.js \
    src/hooks/useUnescoVisited.js src/hooks/useVisitedCantons.js \
    src/hooks/useVisitedCountries.js src/hooks/useWishlist.js \
    src/utils/api.js src/utils/batchQueue.js \
    src/utils/secureStorage.js src/utils/syncLocalData.js
  git commit -m "refactor: replace console.log/warn/debug with logger (no-op in production)"
  ```

---

## Final verification

- [ ] **Run full frontend suite one last time**
  ```bash
  npx vitest run
  ```
  Expected: all tests pass

- [ ] **Run full backend suite one last time**
  ```bash
  cd backend && pytest -v
  ```
  Expected: all tests pass

- [ ] **Open a PR targeting `main`**

  Title: `fix: production hardening — Plan 1 quick wins (9 tasks)`

  Body should list the 9 tasks as a checklist so reviewers know what changed.
