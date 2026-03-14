# PR #72 Hardening — Design Spec

**Date:** 2026-03-14
**Branch:** `copilot/mobile-ios-native-finish`
**Goal:** Remove dead code, fix 3 confirmed bugs, and resolve 13 Copilot review comments before merging to main.

---

## Context

PR #72 adds iOS-native mobile UX primitives (haptics, pull-to-refresh, touch feedback, reduced motion), push-screen navigation for Stats/BucketList/ComparisonStats/YearInReview, loading skeletons, and data export/import. PWA infrastructure (vite-plugin-pwa, manifest, InstallPrompt, OfflineIndicator, syncQueue, dataExport) already exists on `main`; merge conflicts were resolved in commit `6b72b40`.

---

## Changes

### 1. Delete `src/utils/syncQueue.js`

**Why:** The file is never imported anywhere in `src/`. It also stores a raw Bearer token in localStorage (XSS risk) and uses a non-standard localStorage key prefix. Dead code — delete entirely.

**Files:** `src/utils/syncQueue.js` (delete)

---

### 2. Fix MapQuiz blue-highlight regression

**Bug:** `targetId` was removed from the `gameMode` memo in `MapQuiz.jsx`, but `WorldMap.jsx` still reads `gameMode.targetId` in both `getStyle()` (to render the blue country highlight) and the layer-reset `useEffect`. With `targetId` undefined, the target country never highlights during gameplay.

**Fix:** Re-add `targetId: question?.id` to the `gameMode` memo in `MapQuiz.jsx`. The `GameFocuser` component removal (which caused a separate background-interaction bug) was intentional and stays removed; only `targetId` needs to come back.

**Files:** `src/components/games/MapQuiz.jsx`

---

### 3. Fix wishlist data loss on import

**Bug:** `DataImport.jsx` shows the wishlist item count in the preview UI but never persists wishlist items when the import is committed.

**Fix (authenticated):** After writing visited regions, make a `PUT /api/wishlist/` call with the wishlist array from the import file. Only call this if the export file contains a non-empty `wishlist` array.

**Fix (guest):** Write each wishlist item to the `swiss-tracker-wishlist-*` localStorage keys that the app already uses for guest wishlist persistence.

**Files:** `src/components/DataImport.jsx`

---

### 4. Fix guest import event dispatch

**Bug:** After a guest import, the code dispatches `new StorageEvent('storage')` but the app listens for the custom `visitedchange` event (via `emitVisitedChange()`). Imported data is not reflected in the UI until a full page reload.

**Fix:** Replace the `StorageEvent` dispatch with a call to `emitVisitedChange()`.

**Files:** `src/components/DataImport.jsx`

---

### 5. Fix `preventDefault` in passive touch listener

**Bug:** `usePullToRefresh.js` calls `e.preventDefault()` inside a React synthetic event handler (which uses a passive listener by default). The call is silently ignored, causing the page to scroll instead of triggering pull-to-refresh.

**Fix:** Attach the `touchmove` listener directly via `addEventListener` with `{ passive: false }` on the scroll container ref, instead of relying on React's synthetic event system.

**Files:** `src/hooks/usePullToRefresh.js`

---

### 6. SSR guard on `navigator.onLine`

**Bug:** `OfflineIndicator.jsx` reads `navigator.onLine` at module initialisation without checking if `navigator` exists, which throws in non-browser environments (SSR, test runners).

**Fix:** Wrap the access in `typeof navigator !== 'undefined' ? navigator.onLine : true`.

**Files:** `src/components/OfflineIndicator.jsx`

---

### 7. Per-user cache key for `/api/*` Service Worker caching

**Bug:** The Workbox `NetworkFirst` strategy caches `/api/*` responses keyed only by URL. On a shared device, user B could receive user A's cached API responses.

**Fix:** Add a `cacheKeyWillBeUsed` Workbox plugin to the `/api/*` runtime cache entry. The plugin reads the current user ID from the `swiss-tracker-user` localStorage key (set by the existing auth flow). If a user ID is present, it appends `?_uid=<id>` to the cache key URL. If no user ID is present (guest/logged-out), the plugin returns `null` to skip caching for that request.

**Files:** `vite.config.js`

---

### 8. Reduce tile cache size and TTL

**Current:** `maxEntries: 3000`, TTL 30 days — can consume hundreds of MB on mobile and cause SW install failures.

**Fix:** Reduce to `maxEntries: 500`, TTL 7 days.

**Files:** `vite.config.js`

---

### 9. Fix Carto tile URL regex

**Bug:** The runtime cache pattern targets `basemaps.cartocdn.org` but actual tile requests go to `basemaps.cartocdn.com`. Carto tiles are never cached offline.

**Fix:** Change the regex from `cartocdn\.org` to `cartocdn\.com`.

**Files:** `vite.config.js`

---

### 10. Omit unset fields in authenticated import PUT

**Bug:** `importAuthenticated()` always sends `dates: {}, notes: {}, wishlist: []` in the PUT body, wiping existing server-side data for those fields even in `merge` mode.

**Fix:** Only include `dates`, `notes`, and `wishlist` in the PUT body if the import file explicitly contains those fields (i.e. if the exported JSON has non-empty values for them). Use a conditional spread to build the request body.

**Files:** `src/components/DataImport.jsx`

---

### 11. Generate PWA icons and update manifest

**Problem:** `public/manifest.json` references `/logo.png` for both the 192×192 and 512×512 icon slots. `logo.png` is the full-resolution source image (~16 MB), causing excessive download size at PWA install time.

**Fix:**
1. Add `sharp` as a dev dependency.
2. Create `scripts/generate-icons.js` — reads `public/logo.png`, outputs:
   - `public/icons/icon-192.png` (192×192, fit: cover)
   - `public/icons/icon-512.png` (512×512, fit: cover)
   - `public/icons/icon-512-maskable.png` (512×512 with 10% safe-area padding for maskable use)
3. Update `public/manifest.json` icon entries to reference the new paths, adding `"purpose": "any"` and `"purpose": "maskable"` variants.
4. Add `node scripts/generate-icons.js` as a `preinstall` or standalone `npm run icons` script in `package.json`.

**Files:** `scripts/generate-icons.js` (new), `public/icons/` (generated, gitignored or committed), `public/manifest.json`, `package.json`

---

## Out of Scope

- `dataExport.js` / `DataImport.jsx` regions schema — scoring confirmed this is a false positive; `Object.entries` handles the shape correctly.
- `InstallPrompt.jsx` — already resolved to main's improved version in the conflict-resolution commit.
- General test coverage gaps — no new tests added beyond what's needed to verify fixes.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/utils/syncQueue.js` | Delete |
| `src/components/games/MapQuiz.jsx` | Fix: re-add `targetId` to `gameMode` |
| `src/components/DataImport.jsx` | Fix: wishlist import (auth + guest), guest event, omit unset PUT fields |
| `src/hooks/usePullToRefresh.js` | Fix: non-passive touch listener |
| `src/components/OfflineIndicator.jsx` | Fix: SSR guard |
| `vite.config.js` | Fix: per-user cache key, tile cache size/TTL, Carto URL regex |
| `scripts/generate-icons.js` | New: icon generation script |
| `public/icons/` | New: generated icon files |
| `public/manifest.json` | Update: icon paths |
| `package.json` | Update: add sharp dev dep + icons script |
