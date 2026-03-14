# PR #72 Hardening — Design Spec

**Date:** 2026-03-14
**Branch:** `copilot/mobile-ios-native-finish`
**Goal:** Remove dead code, fix confirmed bugs, and resolve Copilot review comments before merging to main.

---

## Context

PR #72 adds iOS-native mobile UX primitives (haptics, pull-to-refresh, touch feedback, reduced motion), push-screen navigation for Stats/BucketList/ComparisonStats/YearInReview, loading skeletons, and data export/import. PWA infrastructure (vite-plugin-pwa, manifest, InstallPrompt, OfflineIndicator, syncQueue, dataExport) already exists on `main`; merge conflicts were resolved in commit `6b72b40`.

The original code review flagged `targetId` missing from MapQuiz's `gameMode` memo as a bug, but verification confirms `targetId: question?.id` is already present at line 115. No action needed there.

---

## Changes

### 1. Delete `src/utils/syncQueue.js`

**Why:** Confirmed zero imports — a project-wide grep finds no reference to `queueApiCall` or `processQueue` in any file other than `syncQueue.js` itself. The file also serializes raw Bearer tokens into localStorage queue entries under the non-standard key `rw-sync-queue` (rest of the app uses `swiss-tracker-*`). Dead code — delete entirely.

**Files:** `src/utils/syncQueue.js` (delete)

---

### 2. Fix wishlist data loss on import

**Bug:** `DataImport.jsx`'s `importAuthenticated()` and `importGuest()` both show the wishlist item count in the preview UI but never persist wishlist items when the import is committed.

**Fix (authenticated):**
After writing visited regions, iterate over `data.wishlist` (the array exported by `GET /api/wishlist`) and call `PUT /api/wishlist/${item.tracker_id}/${item.region_id}` for each item. In `merge` mode, first fetch the existing wishlist from `GET /api/wishlist` and skip items that are already present (match on `tracker_id` + `region_id`). Only run this block if `Array.isArray(data.wishlist) && data.wishlist.length > 0`.

Note: wishlist item fields are snake_case (`tracker_id`, `region_id`) as returned by the API — not camelCase.

**Fix (guest):**
After writing visited regions, iterate over `data.wishlist`. Group items by `tracker_id`. For each group, write the array of `region_id` strings to `localStorage.setItem('swiss-tracker-wishlist-${tracker_id}', JSON.stringify(regionIds))`. In `merge` mode, read the existing value first and merge the arrays with `[...new Set([...existing, ...incoming])]`.

**Files:** `src/components/DataImport.jsx`

---

### 3. Fix guest import event dispatch

**Bug:** `importGuest()` dispatches `new Event('storage')` (line 235), but the app listens for the custom `visitedchange` event emitted by `emitVisitedChange()`. Imported data is not reflected in the UI without a full page reload.

**Fix:** Replace `window.dispatchEvent(new Event('storage'))` with a call to `emitVisitedChange()`.
Import: `import { emitVisitedChange } from '../utils/events';`

**Files:** `src/components/DataImport.jsx`

---

### 4. Fix `preventDefault` in passive touch listener

**Bug:** `usePullToRefresh.js` returns `handleTouchMove` as `onTouchMove` in the `bind` object (line 120). React attaches synthetic `onTouchMove` handlers as passive listeners (React 17+), so `event.preventDefault()` at line 62 is silently ignored — the page scrolls instead of triggering pull-to-refresh.

**Fix:**
1. Add an internal `containerRef = useRef(null)` to the hook.
2. Add a `useEffect` that calls `containerRef.current.addEventListener('touchmove', handleTouchMove, { passive: false })` and returns a cleanup that removes it. The effect re-runs when `handleTouchMove` changes.
3. Remove `onTouchMove: handleTouchMove` from the `bind` return object.
4. Add `containerRef` to the hook's return value so consumers can attach it to the scroll element: `<div ref={containerRef} {...bind}>`.

**Files:** `src/hooks/usePullToRefresh.js`

---

### 5. SSR guard on `navigator.onLine`

**Bug:** `OfflineIndicator.jsx` reads `navigator.onLine` directly inside a `useState` initializer with no environment guard, throwing in non-browser environments (SSR, Vitest with jsdom that lacks navigator).

**Fix:** Change the `useState` initializer to:
```js
useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
```

**Files:** `src/components/OfflineIndicator.jsx`

---

### 6. Per-user cache key for `/api/*` Service Worker caching

**Bug:** The Workbox `NetworkFirst` strategy caches `/api/*` responses keyed only by URL. On a shared device, user B can receive user A's cached API responses after user A logs out.

**Fix:** Add two Workbox plugins to the `api-cache` runtime entry in `vite.config.js`:

**Plugin 1 — `cacheWillUpdate`:** Returns `null` (skips caching) if the request has no `Authorization` header, preventing unauthenticated/guest responses from entering the cache.

**Plugin 2 — `cacheKeyWillBeUsed`:** If an `Authorization: Bearer <token>` header is present, decodes the JWT payload (base64, no verification needed) to extract the `sub` claim, then returns a new URL string with `?_sw_uid=<sub>` appended as the cache key. If JWT decode fails, returns the original request unchanged.

Note: `localStorage` is not available in Service Worker scope. Both plugins operate only on the request's `Authorization` header, which is fully accessible in SW context.

```js
// Pseudocode for the two plugins:
{
  cacheWillUpdate: async ({ request, response }) => {
    if (!request.headers.get('Authorization')) return null;
    return response;
  },
  cacheKeyWillBeUsed: async ({ request }) => {
    const auth = request.headers.get('Authorization') ?? '';
    try {
      const payload = JSON.parse(atob(auth.replace('Bearer ', '').split('.')[1]));
      const uid = payload.sub ?? payload.id ?? payload.user_id;
      if (!uid) return request;
      const url = new URL(request.url);
      url.searchParams.set('_sw_uid', String(uid));
      return url.toString();
    } catch {
      return request;
    }
  },
}
```

**Files:** `vite.config.js`

---

### 7. Reduce tile cache size and TTL

**Current:** `maxEntries: 3000`, TTL 30 days — can consume hundreds of MB on mobile and cause SW install failures.

**Fix:** Reduce to `maxEntries: 500`, TTL 7 days.

**Files:** `vite.config.js`

---

### 8. Fix Carto tile URL regex

**Bug:** The current combined regex `/^https:\/\/(a|b|c)\.(tile\.openstreetmap|basemaps\.cartocdn)\.org\/.*/` targets `basemaps.cartocdn.org` but actual Carto tile requests go to `basemaps.cartocdn.com`. Carto tiles are never cached offline. A naive `.org` → `.com` substitution would also break OSM tile caching (correct domain is `tile.openstreetmap.org`).

**Fix:** Split the single combined cache entry into two separate `runtimeCaching` entries — one for OSM (`.org`) and one for Carto (`.com`):
```js
// OSM tiles
{ urlPattern: /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/, ... }
// Carto tiles
{ urlPattern: /^https:\/\/(a|b|c|d)\.basemaps\.cartocdn\.com\/.*/, ... }
```
Both entries use the same caching strategy and the corrected limits from Change 7.

**Files:** `vite.config.js`

---

### 9. Omit unset fields in authenticated import PUT

**Bug:** `importAuthenticated()` always sends `dates: {}, notes: {}, wishlist: []` in the per-tracker PUT body (line 197), wiping existing server-side data for those fields even in `merge` mode.

**Fix:** Build the PUT body conditionally — only include `dates`, `notes` if the import file contains non-empty values for them. Omit `wishlist` entirely from this PUT (wishlist is handled separately via Change 2 above via the `/api/wishlist/${trackerId}/${regionId}` endpoint, so there is no overlap).

```js
body: JSON.stringify({
  regions: toSave,
  ...(data.dates?.[trackerId] && Object.keys(data.dates[trackerId]).length
    ? { dates: data.dates[trackerId] } : {}),
  ...(data.notes?.[trackerId] && Object.keys(data.notes[trackerId]).length
    ? { notes: data.notes[trackerId] } : {}),
}),
```

**Files:** `src/components/DataImport.jsx`

---

### 10. Generate PWA icons and update manifest

**Problem:** `public/manifest.json` references `/logo.png` for both the 192×192 and 512×512 icon slots. `logo.png` is the full-resolution source image (~16 MB).

**Fix:**
1. Install `sharp` as a dev dependency (`npm install --save-dev sharp`).
2. Create `scripts/generate-icons.js` — reads `public/logo.png`, outputs:
   - `public/icons/icon-192.png` (192×192, `fit: 'cover'`)
   - `public/icons/icon-512.png` (512×512, `fit: 'cover'`)
   - `public/icons/icon-512-maskable.png` (512×512 with 10% padding for maskable safe area)
3. Add `"icons": "node scripts/generate-icons.js"` to `package.json` scripts. This is a standalone manual/CI step, not a `preinstall` hook.
4. Run the script once now to generate the icons; commit the generated PNGs to the repo (simpler than a CI-only generation step — avoids the icons being missing on fresh checkouts).
5. Update `public/manifest.json` icon entries:
   - `{ "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" }`
   - `{ "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }`
   - `{ "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }`

**Files:** `scripts/generate-icons.js` (new), `public/icons/` (committed), `public/manifest.json`, `package.json`

---

## Out of Scope

- `dataExport.js` / `DataImport.jsx` regions schema — false positive; `Object.entries` handles the shape correctly.
- `InstallPrompt.jsx` — already resolved to main's improved version in the conflict-resolution commit `6b72b40`.
- MapQuiz `targetId` — already present in `gameMode` at line 115. No action needed.
- General test coverage gaps — no new tests added beyond what's needed to verify fixes.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/utils/syncQueue.js` | Delete |
| `src/components/DataImport.jsx` | Fix: wishlist import (auth + guest), guest event, omit unset PUT fields |
| `src/hooks/usePullToRefresh.js` | Fix: non-passive touchmove via containerRef |
| `src/components/OfflineIndicator.jsx` | Fix: SSR guard on navigator.onLine |
| `vite.config.js` | Fix: per-user SW cache key, tile cache size/TTL, Carto URL regex |
| `scripts/generate-icons.js` | New: icon generation script |
| `public/icons/` | New: committed generated icons |
| `public/manifest.json` | Update: icon paths and purpose fields |
| `package.json` | Update: add sharp dev dep + icons script |
