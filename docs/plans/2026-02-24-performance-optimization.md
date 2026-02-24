# Performance Optimization — localStorage Read Cache

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a TTL-backed localStorage cache to eliminate redundant DB reads on page refresh and tab switching.

**Architecture:** A thin `cache.js` utility (`get/set/invalidate/invalidatePrefix`) is wired into `api.js` and four hooks. The write side is already debounced — only reads change. Tab-switch refetches become TTL-aware instead of unconditional.

**Tech Stack:** Vanilla JS localStorage, React hooks, existing fetch utilities.

> **Note:** No test runner is configured. Verification is done via browser DevTools → Network tab. Filter by `XHR/Fetch`, reload, and confirm requests don't fire during the TTL window.

---

### Task 1: Create `src/utils/cache.js`

**Files:**
- Create: `src/utils/cache.js`

**Step 1: Create the file**

```js
// src/utils/cache.js

const PREFIX = 'cache:';

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key
 * @param {number} ttlMs  max age in milliseconds
 * @returns {*} cached value, or null if missing/expired
 */
export function cacheGet(key, ttlMs) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Store a value in the cache with the current timestamp.
 * @param {string} key
 * @param {*} value  must be JSON-serialisable
 */
export function cacheSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, ts: Date.now() }));
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

/**
 * Remove one cache entry.
 * @param {string} key
 */
export function cacheInvalidate(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

/**
 * Remove all cache entries whose key starts with `prefix`.
 * Used on logout to wipe a user's cached data.
 * @param {string} prefix  e.g. 'u42:'
 */
export function cacheInvalidatePrefix(prefix) {
  try {
    const fullPrefix = PREFIX + prefix;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
```

**Step 2: Verify manually**

Open the browser console on the running app and run:
```js
import('/src/utils/cache.js').then(m => {
  m.cacheSet('test', { hello: 'world' });
  console.log(m.cacheGet('test', 60000)); // should print { hello: 'world' }
  m.cacheInvalidate('test');
  console.log(m.cacheGet('test', 60000)); // should print null
});
```
Or just check that the file has no syntax errors by running `npm run build` (Vite will catch them).

**Step 3: Run build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/utils/cache.js
git commit -m "feat: add TTL localStorage cache utility"
```

---

### Task 2: Wire cache into `src/utils/api.js` — visited bulk fetch

**Files:**
- Modify: `src/utils/api.js`

Context: `fetchAllVisited` currently uses an in-memory cache (`_bulkCache`) that dies on page refresh. We persist it to localStorage with a 5-minute TTL. Cache key is scoped by userId extracted from the JWT (we pass token, so we use the token itself as a scope key — safe since tokens are user-specific and rotate on logout).

**Step 1: Add cache imports and key helper at the top of `api.js`**

Add after line 7 (after the JSDoc comment block, before `let _bulkCache`):

```js
import { cacheGet, cacheSet, cacheInvalidate } from './cache';

const VISITED_TTL = 5 * 60 * 1000; // 5 minutes

function visitedCacheKey(token) {
  // Use last 16 chars of token as scope — tokens are user-specific
  return `visited-all:${token.slice(-16)}`;
}
```

**Step 2: Update `fetchAllVisited` to check localStorage cache**

Replace the existing `fetchAllVisited` function (lines 21–41) with:

```js
export async function fetchAllVisited(token, force = false) {
  const cKey = visitedCacheKey(token);

  // Check persistent cache first (survives page refresh)
  if (!force) {
    const persisted = cacheGet(cKey, VISITED_TTL);
    if (persisted) {
      _bulkCache = persisted;
      _bulkToken = token;
      return persisted;
    }
  }

  // Fall back to in-memory deduplication
  if (!force && _bulkCache && _bulkToken === token) return _bulkCache;
  if (!force && _bulkPromise && _bulkToken === token) return _bulkPromise;

  _bulkToken = token;
  _bulkPromise = fetch('/api/visited/all', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      _bulkCache = data;
      _bulkPromise = null;
      if (data) cacheSet(cKey, data);
      return data;
    })
    .catch(() => {
      _bulkPromise = null;
      return null;
    });

  return _bulkPromise;
}
```

**Step 3: Update `invalidateBulkCache` to also clear localStorage**

Replace the existing `invalidateBulkCache` function (lines 46–49) with:

```js
export function invalidateBulkCache(token) {
  _bulkCache = null;
  _bulkPromise = null;
  if (token) cacheInvalidate(visitedCacheKey(token));
}
```

> **Important:** `invalidateBulkCache` now takes an optional `token` parameter. All callers that want to fully invalidate (not just in-memory) should pass their token. Callers that don't pass it will still clear in-memory cache only (safe, just won't clear localStorage).

**Step 4: Update callers of `invalidateBulkCache` to pass token**

Search for all `invalidateBulkCache()` calls:
```bash
grep -rn "invalidateBulkCache" /Users/dankadr/swiss-tracker/src/
```

For each call site inside a hook that has access to `token`, change:
```js
invalidateBulkCache()
```
to:
```js
invalidateBulkCache(token)
```

Hooks with access to `token`: `useVisitedCantons.js`, `useVisitedCountries.js`.

**Step 5: Build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```

**Step 6: Manual verification**

1. Run `npm run dev`
2. Log in, open DevTools → Network → filter Fetch/XHR
3. Hard-refresh the page (Cmd+Shift+R). Observe `/api/visited/all` fires once.
4. Hard-refresh again within 5 minutes. `/api/visited/all` should NOT fire — served from localStorage cache.
5. Check `localStorage` in DevTools → Application tab — you should see a `cache:visited-all:...` entry.

**Step 7: Commit**

```bash
git add src/utils/api.js
git commit -m "feat: persist visited bulk cache to localStorage with 5min TTL"
```

---

### Task 3: Make tab-switch refetch TTL-aware in `useVisitedCantons.js` and `useVisitedCountries.js`

**Files:**
- Modify: `src/hooks/useVisitedCantons.js`
- Modify: `src/hooks/useVisitedCountries.js`

Context: Both hooks listen to `visibilitychange` and `focus` and always call `invalidateBulkCache()` + `fetchAllVisited(token, true)`. This fires a DB read every time the user switches tabs. We gate it on TTL expiry instead.

**Step 1: Add cache import to `useVisitedCantons.js`**

At the top of the file, add to the existing imports:
```js
import { cacheGet } from '../utils/cache';
```

And add a constant near the top:
```js
const VISITED_TTL = 5 * 60 * 1000;
```

**Step 2: Update the `refetch` function inside the `visibilitychange`/`focus` effect in `useVisitedCantons.js`**

Find the `refetch` function (around line 274):
```js
const refetch = () => {
  invalidateBulkCache();
  fetchAllVisited(token, true).then((bulk) => {
```

Replace with:
```js
const refetch = () => {
  // Only refetch if cache has expired — avoids a DB read on every tab switch
  const cKey = `visited-all:${token.slice(-16)}`;
  if (cacheGet(cKey, VISITED_TTL)) return;

  invalidateBulkCache(token);
  fetchAllVisited(token, true).then((bulk) => {
```

**Step 3: Apply the same change to `useVisitedCountries.js`**

Add the same import and constant, and apply the identical `refetch` guard:
```js
const refetch = () => {
  const cKey = `visited-all:${token.slice(-16)}`;
  if (cacheGet(cKey, VISITED_TTL)) return;

  invalidateBulkCache(token);
  fetchAllVisited(token, true).then((bulk) => {
```

**Step 4: Build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```

**Step 5: Manual verification**

1. Log in and load the app.
2. Switch to another browser tab and back. Check Network — `/api/visited/all` should NOT fire (cache is fresh).
3. Open DevTools → Application → localStorage, find the `cache:visited-all:...` entry, and manually delete it.
4. Switch tabs again. Now `/api/visited/all` SHOULD fire (cache was expired/missing).

**Step 6: Commit**

```bash
git add src/hooks/useVisitedCantons.js src/hooks/useVisitedCountries.js
git commit -m "feat: make tab-switch refetch TTL-aware for visited data"
```

---

### Task 4: Cache leaderboard and activity in `useFriendsData.js`

**Files:**
- Modify: `src/hooks/useFriendsData.js`

Context: `loadLeaderboard` and `loadActivity` fetch fresh on every call. They're called when the Friends panel opens. With 10-100 users, leaderboard changes infrequently — a 10-minute cache is appropriate.

**Step 1: Add imports**

At the top of `useFriendsData.js`, add:
```js
import { cacheGet, cacheSet, cacheInvalidate } from '../utils/cache';
```

**Step 2: Add TTL constants and key helpers after imports**

```js
const LEADERBOARD_TTL = 10 * 60 * 1000;
const ACTIVITY_TTL = 5 * 60 * 1000;
const FRIEND_VISITED_TTL = 10 * 60 * 1000;

function leaderboardKey(token) { return `leaderboard:${token.slice(-16)}`; }
function activityKey(token) { return `activity:${token.slice(-16)}`; }
function friendVisitedKey(token, friendId) { return `friend-visited:${token.slice(-16)}:${friendId}`; }
```

**Step 3: Update `loadLeaderboard` to check cache first**

Replace the existing `loadLeaderboard` callback:
```js
const loadLeaderboard = useCallback(async () => {
  if (!token) return;
  const cached = cacheGet(leaderboardKey(token), LEADERBOARD_TTL);
  if (cached) { setLeaderboard(cached); return; }
  setLoading(true);
  try {
    const data = await fetchLeaderboard(token);
    const list = Array.isArray(data) ? data : [];
    setLeaderboard(list);
    cacheSet(leaderboardKey(token), list);
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  } finally {
    setLoading(false);
  }
}, [token]);
```

**Step 4: Update `loadActivity` to check cache first**

Replace the existing `loadActivity` callback:
```js
const loadActivity = useCallback(async () => {
  if (!token) return;
  const cached = cacheGet(activityKey(token), ACTIVITY_TTL);
  if (cached) { setActivity(cached); return; }
  try {
    const data = await fetchActivity(token);
    const list = Array.isArray(data) ? data : [];
    setActivity(list);
    cacheSet(activityKey(token), list);
  } catch (err) {
    console.error('Failed to load activity:', err);
  }
}, [token]);
```

**Step 5: Update `loadFriendVisited` to use localStorage cache instead of the in-memory `cache.current` ref**

The existing hook has an in-memory ref cache. Replace `loadFriendVisited` to use localStorage instead (survives refresh):
```js
const loadFriendVisited = useCallback(async (friendId) => {
  if (!token) return null;

  const cached = cacheGet(friendVisitedKey(token, friendId), FRIEND_VISITED_TTL);
  if (cached) return cached;

  try {
    const data = await fetchFriendVisited(token, friendId);
    if (data) cacheSet(friendVisitedKey(token, friendId), data);
    return data;
  } catch (err) {
    console.error('Failed to load friend visited:', err);
    return null;
  }
}, [token]);
```

**Step 6: Update `clearCache` to also clear localStorage entries**

```js
const clearCache = useCallback(() => {
  if (token) {
    cacheInvalidate(leaderboardKey(token));
    cacheInvalidate(activityKey(token));
    // Friend visited entries are TTL-scoped; clearing all would require prefix scan
    // They expire naturally in 10 min — acceptable
  }
  setFriendOverlayData({});
}, [token]);
```

**Step 7: Build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```

**Step 8: Manual verification**

1. Open Friends panel — check Network for `/api/friends/leaderboard` and `/api/friends/activity`.
2. Close and reopen Friends panel — those requests should NOT fire again (cache hit).
3. Hard-refresh — they should still NOT fire (localStorage cache).
4. Check DevTools → Application → localStorage for `cache:leaderboard:...` and `cache:activity:...` entries.

**Step 9: Commit**

```bash
git add src/hooks/useFriendsData.js
git commit -m "feat: add localStorage cache for leaderboard, activity, and friend visited data"
```

---

### Task 5: Cache challenges list in `useChallenges.js`

**Files:**
- Modify: `src/hooks/useChallenges.js`

Context: `loadChallenges` is called on mount and polls every 2 minutes. We cache the list so mount doesn't re-fetch within the TTL, and we extend the poll interval since cache handles the "is it fresh enough?" question. Invalidate on any write (create, join, leave, remove).

**Step 1: Add imports and constants**

At the top of `useChallenges.js`, add:
```js
import { cacheGet, cacheSet, cacheInvalidate } from '../utils/cache';
```

After imports:
```js
const CHALLENGES_TTL = 5 * 60 * 1000;
function challengesKey(token) { return `challenges:${token.slice(-16)}`; }
```

**Step 2: Update `loadChallenges` to use cache**

Replace the existing `loadChallenges` callback:
```js
const loadChallenges = useCallback(async (force = false) => {
  if (!token) return;
  if (!force) {
    const cached = cacheGet(challengesKey(token), CHALLENGES_TTL);
    if (cached) { setChallenges(cached); return; }
  }
  try {
    const data = await apiFetchChallenges(token);
    const list = Array.isArray(data) ? data : [];
    setChallenges(list);
    cacheSet(challengesKey(token), list);
  } catch (err) {
    console.error('Failed to load challenges:', err);
  }
}, [token]);
```

**Step 3: Update `refresh` to force-bypass cache**

```js
const refresh = useCallback(async () => {
  setLoading(true);
  await loadChallenges(true);
  setLoading(false);
}, [loadChallenges]);
```

**Step 4: Invalidate cache after write operations**

Update `create`, `join`, `leave`, and `remove` to invalidate the cache before re-loading:

```js
const create = useCallback(async (data) => {
  const result = await apiCreateChallenge(token, data);
  cacheInvalidate(challengesKey(token));
  await loadChallenges(true);
  return result;
}, [token, loadChallenges]);

const join = useCallback(async (challengeId) => {
  const result = await apiJoin(token, challengeId);
  cacheInvalidate(challengesKey(token));
  await loadChallenges(true);
  return result;
}, [token, loadChallenges]);

const leave = useCallback(async (challengeId) => {
  const result = await apiLeave(token, challengeId);
  cacheInvalidate(challengesKey(token));
  await loadChallenges(true);
  return result;
}, [token, loadChallenges]);

const remove = useCallback(async (challengeId) => {
  const result = await apiDelete(token, challengeId);
  cacheInvalidate(challengesKey(token));
  await loadChallenges(true);
  return result;
}, [token, loadChallenges]);
```

**Step 5: Build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```

**Step 6: Manual verification**

1. Open Challenges panel — observe `/api/challenges` fires once.
2. Hard-refresh — `/api/challenges` should NOT fire (localStorage cache).
3. Create or join a challenge — `/api/challenges` should fire immediately (cache invalidated).
4. Within the same session, close/reopen Challenges panel — no extra request.

**Step 7: Commit**

```bash
git add src/hooks/useChallenges.js
git commit -m "feat: add localStorage cache for challenges list with invalidation on writes"
```

---

### Task 6: Clear cache on logout

**Files:**
- Modify: `src/context/AuthContext.jsx`

Context: Cache keys are scoped by token suffix, so a different user logging in can't read another user's cached data. But old entries linger in localStorage after logout, wasting space. Clear them on logout.

**Step 1: Add import to `AuthContext.jsx`**

At the top of the file, add:
```js
import { cacheInvalidatePrefix } from '../utils/cache';
```

**Step 2: Update the `logout` function**

Find the existing `logout` callback (around line 68):
```js
const logout = useCallback(() => {
  setAuth(null);
  saveAuth(null);
}, []);
```

Replace with:
```js
const logout = useCallback(() => {
  // Clear all cache entries before wiping auth (token still needed for key)
  const currentToken = auth?.jwt_token;
  if (currentToken) {
    cacheInvalidatePrefix(`visited-all:${currentToken.slice(-16)}`);
    cacheInvalidatePrefix(`leaderboard:${currentToken.slice(-16)}`);
    cacheInvalidatePrefix(`activity:${currentToken.slice(-16)}`);
    cacheInvalidatePrefix(`friend-visited:${currentToken.slice(-16)}`);
    cacheInvalidatePrefix(`challenges:${currentToken.slice(-16)}`);
  }
  setAuth(null);
  saveAuth(null);
}, [auth]);
```

> **Note:** `auth` must now be in the dependency array. Verify that `auth` state is available in scope (it should be from the `useState` above this function).

**Step 3: Build check**

```bash
cd /Users/dankadr/swiss-tracker && npm run build 2>&1 | tail -5
```

**Step 4: Manual verification**

1. Log in and let the app cache some data (visit a region, open Friends panel).
2. Check DevTools → Application → localStorage — confirm `cache:*` entries exist.
3. Log out.
4. Check localStorage again — all `cache:*` entries for that token should be gone.

**Step 5: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: clear localStorage cache on logout"
```

---

### Task 7: Final smoke test and deploy

**Step 1: Full build**

```bash
cd /Users/dankadr/swiss-tracker && npm run build
```
Expected: no errors, `dist/` populated.

**Step 2: Full manual smoke test**

Run through this checklist in the browser:

- [ ] Hard-refresh with no cache: all data loads correctly
- [ ] Hard-refresh within 5 min: no `/api/visited/all` request fires
- [ ] Switch tabs and back: no request fires (within TTL)
- [ ] Toggle a region: PATCH fires immediately (write debounce already working)
- [ ] Open Friends panel twice: leaderboard/activity only fetched once
- [ ] Open Challenges panel, create a challenge: list refreshes, subsequent opens don't re-fetch
- [ ] Log out: localStorage cache entries cleared
- [ ] Log back in as same user: fresh fetch runs, cache repopulated

**Step 3: Deploy**

Follow the Vercel deploy skill or run:
```bash
vercel --prod
```
