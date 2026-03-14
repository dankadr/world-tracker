# PR #72 Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden PR #72 (`copilot/mobile-ios-native-finish`) by removing dead code, fixing 3 confirmed bugs, and resolving Copilot review comments before merging to main.

**Architecture:** All changes are isolated bug fixes and dead-code removal on the existing PR branch. No new abstractions introduced. DataImport gets wishlist persistence added to both authenticated and guest paths. usePullToRefresh switches its touchmove handler from React synthetic events (passive) to a direct DOM listener (non-passive). vite.config.js gets user-scoped SW cache keys and corrected tile cache settings.

**Tech Stack:** React 18, Vite + vite-plugin-pwa (Workbox), Vitest + @testing-library/react, sharp (new dev dep for icon generation)

**Working directory for all tasks:** `.worktrees/mobile-ios-native-finish/` (git worktree for branch `copilot/mobile-ios-native-finish`)

---

## Chunk 1: Dead code + quick one-liners

### Task 1: Delete `syncQueue.js`

**Files:**
- Delete: `src/utils/syncQueue.js`

- [ ] **Step 1: Confirm zero imports**

```bash
grep -r "syncQueue\|queueApiCall\|processQueue" src/ --include="*.js" --include="*.jsx" | grep -v "syncQueue.js"
```
Expected: no output (zero matches outside the file itself).

- [ ] **Step 2: Delete the file**

```bash
git rm src/utils/syncQueue.js
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete dead syncQueue.js — never imported, stores tokens in localStorage"
```

---

### Task 2: SSR guard on `navigator.onLine`

**Files:**
- Modify: `src/components/OfflineIndicator.jsx:5`

- [ ] **Step 1: Apply the fix**

In `src/components/OfflineIndicator.jsx`, change line 5 from:
```js
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
```
to:
```js
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass (no new failures).

- [ ] **Step 3: Commit**

```bash
git add src/components/OfflineIndicator.jsx
git commit -m "fix: guard navigator.onLine against SSR/non-browser environments"
```

---

## Chunk 2: DataImport fixes

### Task 3: Fix guest import event dispatch

**Files:**
- Modify: `src/components/DataImport.jsx`

- [ ] **Step 1: Verify the import path exists**

```bash
grep "export.*emitVisitedChange" src/utils/events.js
```
Expected: a line containing `export function emitVisitedChange`.

- [ ] **Step 2: Add the import**

At the top of `src/components/DataImport.jsx`, after line 3 (`import './DataImport.css';`), add:
```js
import { emitVisitedChange } from '../utils/events';
```

- [ ] **Step 3: Replace the event dispatch**

In `importGuest()` at the bottom of the file, replace:
```js
  // Dispatch storage event so hooks re-read
  window.dispatchEvent(new Event('storage'));
```
with:
```js
  emitVisitedChange();
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/DataImport.jsx
git commit -m "fix: dispatch emitVisitedChange after guest import instead of wrong storage event"
```

---

### Task 4: Omit unset fields in authenticated import PUT

**Files:**
- Modify: `src/components/DataImport.jsx:194-198`

- [ ] **Step 1: Apply the fix**

In `importAuthenticated()`, replace the PUT body at lines 194–198:
```js
      await fetch(`/api/visited/${trackerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ regions: toSave, dates: {}, notes: {}, wishlist: [] }),
      });
```
with:
```js
      await fetch(`/api/visited/${trackerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          regions: toSave,
          ...(data.dates?.[trackerId] && Object.keys(data.dates[trackerId]).length
            ? { dates: data.dates[trackerId] } : {}),
          ...(data.notes?.[trackerId] && Object.keys(data.notes[trackerId]).length
            ? { notes: data.notes[trackerId] } : {}),
        }),
      });
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataImport.jsx
git commit -m "fix: omit dates/notes from import PUT unless export contains them — prevents wiping server data"
```

---

### Task 5: Add wishlist import (authenticated)

**Files:**
- Modify: `src/components/DataImport.jsx` — `importAuthenticated()` function

- [ ] **Step 1: Add wishlist block after the regions loop**

In `importAuthenticated()`, insert the following block after the closing `}` of the `if (data.visited?.regions)` block and **before** the closing `}` of the `importAuthenticated` function itself (i.e., before the very last `}` of the function, currently at line 201). The result should be the last statement in the function body:

```js
  // Import wishlist items
  if (Array.isArray(data.wishlist) && data.wishlist.length > 0) {
    let itemsToImport = data.wishlist;
    if (mode === 'merge') {
      const existingRes = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } });
      if (existingRes.ok) {
        const existing = await existingRes.json();
        const existingKeys = new Set(existing.map((i) => `${i.tracker_id}:${i.region_id}`));
        itemsToImport = data.wishlist.filter((i) => !existingKeys.has(`${i.tracker_id}:${i.region_id}`));
      }
    }
    for (const item of itemsToImport) {
      if (!item.tracker_id || !item.region_id) continue;
      await fetch(`/api/wishlist/${item.tracker_id}/${item.region_id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(item),
      });
    }
  }
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataImport.jsx
git commit -m "fix: import wishlist items on authenticated import (merge and overwrite modes)"
```

---

### Task 6: Add wishlist import (guest)

**Files:**
- Modify: `src/components/DataImport.jsx` — `importGuest()` function

**Depends on Task 3 being applied first** (the `emitVisitedChange()` call must already exist before doing this step).

- [ ] **Step 1: Add wishlist block after the regions loop**

In `importGuest()`, insert the following block after the closing `}` of the `if (data.visited?.regions)` block and **before** the `emitVisitedChange()` call (which Task 3 placed there). The wishlist block must come before `emitVisitedChange()` so the UI refresh fires after all data is written:

```js
  // Wishlist items
  if (Array.isArray(data.wishlist) && data.wishlist.length > 0) {
    // Group by tracker_id
    const byTracker = {};
    for (const item of data.wishlist) {
      if (!item.tracker_id || !item.region_id) continue;
      if (!byTracker[item.tracker_id]) byTracker[item.tracker_id] = [];
      byTracker[item.tracker_id].push(item.region_id);
    }
    for (const [tid, regionIds] of Object.entries(byTracker)) {
      const key = `swiss-tracker-wishlist-${tid}`;
      let toSave = regionIds;
      if (mode === 'merge') {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          toSave = [...new Set([...existing, ...regionIds])];
        } catch {}
      }
      localStorage.setItem(key, JSON.stringify(toSave));
    }
  }
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DataImport.jsx
git commit -m "fix: import wishlist items on guest import (merge and overwrite modes)"
```

---

## Chunk 3: usePullToRefresh — non-passive touchmove

### Task 7: Fix passive touch listener in usePullToRefresh

**Files:**
- Modify: `src/hooks/usePullToRefresh.js`

The hook currently returns `onTouchMove` in the `bind` object. React attaches `onTouchMove` as a passive listener — `preventDefault()` inside it does nothing, so pull-to-refresh can't stop the scroll. The fix: add a `containerRef`, attach `touchmove` directly via `addEventListener({ passive: false })` in a `useEffect`, and remove `onTouchMove` from `bind`.

- [ ] **Step 1: Add `containerRef` and non-passive useEffect**

Replace the existing `usePullToRefresh.js` content with:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useReducedMotion from './useReducedMotion';

const DEFAULT_THRESHOLD = 64;
const DEFAULT_MAX_PULL = 96;
const DAMPING = 0.45;

export default function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
} = {}) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const startYRef = useRef(null);
  const pullActiveRef = useRef(false);
  const readyRef = useRef(false);
  const refreshingRef = useRef(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    pullActiveRef.current = false;
    startYRef.current = null;
    readyRef.current = false;
    setIsReady(false);
    setIsDragging(false);
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback((event) => {
    if (disabled || refreshingRef.current || event.touches.length !== 1) {
      return;
    }

    const target = event.currentTarget;
    if (target.scrollTop > 0) {
      return;
    }

    pullActiveRef.current = true;
    setIsDragging(true);
    startYRef.current = event.touches[0].clientY;
  }, [disabled]);

  const handleTouchMove = useCallback((event) => {
    if (!pullActiveRef.current || disabled || refreshingRef.current || event.touches.length !== 1) {
      return;
    }

    const touchY = event.touches[0].clientY;
    const delta = touchY - (startYRef.current || touchY);
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    const nextDistance = Math.min(maxPull, delta * DAMPING);
    event.preventDefault();
    setPullDistance(nextDistance);

    const nextReady = nextDistance >= threshold;
    if (nextReady !== readyRef.current) {
      readyRef.current = nextReady;
      setIsReady(nextReady);
    }
  }, [disabled, maxPull, threshold]);

  // Attach touchmove with { passive: false } so preventDefault() works.
  // React's synthetic onTouchMove is passive in React 17+ and cannot be overridden.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullActiveRef.current) {
      return;
    }

    pullActiveRef.current = false;
    startYRef.current = null;
    setIsDragging(false);

    if (!readyRef.current || typeof onRefresh !== 'function' || disabled || refreshingRef.current) {
      readyRef.current = false;
      setIsReady(false);
      setPullDistance(0);
      return;
    }

    refreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(Math.min(maxPull * 0.6, threshold * 0.8));

    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      readyRef.current = false;
      setIsReady(false);
      setPullDistance(0);
    }
  }, [disabled, maxPull, onRefresh, threshold]);

  const contentStyle = useMemo(() => ({
    transform: `translate3d(0, ${pullDistance}px, 0)`,
    transition: isDragging
      ? 'none'
      : (prefersReducedMotion ? 'none' : 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)'),
    willChange: pullDistance > 0 ? 'transform' : 'auto',
  }), [isDragging, prefersReducedMotion, pullDistance]);

  return {
    pullDistance,
    isReady,
    isRefreshing,
    indicatorText: isRefreshing
      ? 'Refreshing…'
      : (isReady ? 'Release to refresh' : 'Pull to refresh'),
    bind: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    containerRef,
    contentStyle,
    reset,
  };
}
```

Key changes from original:
- Added `useEffect` that attaches `touchmove` with `{ passive: false }` to `containerRef.current`
- Removed `onTouchMove` from the `bind` return object
- Added `containerRef` to return value

- [ ] **Step 2: Update all 3 consumer files to attach `containerRef`**

There are exactly 3 files using `usePullToRefresh`, with 4 total scroll elements to update:

**`src/components/FriendsPanel.jsx`**
- Add `containerRef` to the destructure on line 258:
  ```js
  const { bind, pullDistance, isReady, isRefreshing, indicatorText, contentStyle, containerRef } = usePullToRefresh({
  ```
- Add `ref={containerRef}` to the scroll container at line 331:
  ```jsx
  <div ref={containerRef} className="fp-scrollable" {...pullToRefresh.bind} onScroll={handleScroll...}>
  ```

**`src/components/ChallengesPanel.jsx`**
- Add `containerRef` to the destructure on line 272:
  ```js
  const { bind, ..., containerRef } = usePullToRefresh({
  ```
- Add `ref={containerRef}` to the scroll container at line 383:
  ```jsx
  <div ref={containerRef} className="ch-scrollable" {...pullToRefresh.bind} onScroll={handleScrollableScroll}>
  ```

**`src/components/ExploreScreen.jsx`** — TWO hook instances, TWO ref attachments:
- Add `containerRef` to the `countriesPull` destructure on line 113:
  ```js
  const { bind: countriesBind, ..., containerRef: countriesRef } = usePullToRefresh({
  ```
- Add `containerRef` to the `trackersPull` destructure on line 118:
  ```js
  const { bind: trackersBind, ..., containerRef: trackersRef } = usePullToRefresh({
  ```
- Add `ref={countriesRef}` to the element at line 327:
  ```jsx
  <div ref={countriesRef} className="explore-tab-pane" {...countriesPull.bind} onScroll={handlePan...}>
  ```
- Add `ref={trackersRef}` to the element at line 415:
  ```jsx
  <div ref={trackersRef} className="explore-tab-pane" {...trackersPull.bind} onScroll={handlePane...}>
  ```

Note: if ExploreScreen already spreads the hook result as `countriesPull.bind`, `countriesPull.containerRef`, etc. (object dot access rather than destructure), attach `ref={countriesPull.containerRef}` and `ref={trackersPull.containerRef}` directly.

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/usePullToRefresh.js src/components/FriendsPanel.jsx src/components/ChallengesPanel.jsx src/components/ExploreScreen.jsx
git commit -m "fix: attach touchmove with passive:false via containerRef — preventDefault now works in pull-to-refresh"
```

---

## Chunk 4: vite.config.js — SW cache fixes

### Task 8: Fix Carto tile URL regex + reduce cache limits

**Files:**
- Modify: `vite.config.js:17-25`

- [ ] **Step 1: Replace the single combined tile cache entry with two split entries**

In `vite.config.js`, replace the existing map-tiles `runtimeCaching` entry:
```js
          {
            urlPattern: /^https:\/\/(a|b|c)\.(tile\.openstreetmap|basemaps\.cartocdn)\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
```
with:
```js
          {
            urlPattern: /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(a|b|c|d)\.basemaps\.cartocdn\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
```

- [ ] **Step 2: Verify the build parses cleanly**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds, no Workbox config errors.

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "fix: split OSM/Carto tile cache entries, fix Carto URL (.org→.com), reduce maxEntries 3000→500 + TTL 30d→7d"
```

---

### Task 9: Add per-user cache key to `/api/*` SW caching (injectManifest mode)

**Context:** vite-plugin-pwa's `generateSW` mode serializes the Workbox config to a generated SW file. Function callbacks in `plugins` are not serializable — they'd be silently dropped. To use custom plugin logic, we must switch to `injectManifest` mode and write our own `src/sw.js`.

**Files:**
- Create: `src/sw.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Install Workbox packages as direct dev dependencies**

`injectManifest` mode imports Workbox packages directly. They exist as transitive deps today but need to be explicit:

```bash
npm install --save-dev workbox-precaching workbox-routing workbox-strategies workbox-expiration workbox-cacheable-response
```

- [ ] **Step 2: Create `src/sw.js`**

Create `src/sw.js` with the full service worker implementation. This replaces all the `workbox.runtimeCaching` entries that were in `vite.config.js`:

```js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Injected by VitePWA at build time — do not remove
precacheAndRoute(self.__WB_MANIFEST);

// OSM map tiles
registerRoute(
  /^https:\/\/(a|b|c)\.tile\.openstreetmap\.org\/.*/,
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Carto map tiles
registerRoute(
  /^https:\/\/(a|b|c|d)\.basemaps\.cartocdn\.com\/.*/,
  new CacheFirst({
    cacheName: 'carto-tiles',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// API routes — NetworkFirst with per-user cache key
// Note: localStorage is NOT available in SW scope.
// We decode the user ID from the JWT in the Authorization header.
registerRoute(
  /^https?:\/\/.*\/api\/.*/,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }),
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

// Google Fonts
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/,
  new StaleWhileRevalidate({ cacheName: 'google-fonts' })
);
```

- [ ] **Step 3: Switch vite.config.js to `injectManifest` mode**

**Note:** This step replaces the entire `VitePWA({...})` config, which means it **supersedes the Task 8 edits** (the tile cache entry split). That's intentional — the tile caching logic from Task 8 now lives in `src/sw.js` instead. Apply Task 8 first anyway to confirm the regex split is correct, then let Task 9 replace the config entirely.

In `vite.config.js`, replace the entire `VitePWA({...})` plugin config with:

```js
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['favicon.png'],
      manifest: false, // We provide our own public/manifest.json
      injectManifest: {
        // Only pre-cache app shell files — exclude large PNGs
        globPatterns: ['**/*.{js,css,html,ico,svg}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
```

The `workbox` key is removed — all caching logic now lives in `src/sw.js`.

- [ ] **Step 4: Verify the build succeeds**

```bash
npm run build 2>&1 | tail -30
```
Expected: build succeeds, `dist/sw.js` is generated, no Workbox errors.

- [ ] **Step 5: Commit**

```bash
git add src/sw.js vite.config.js package.json package-lock.json
git commit -m "fix: switch to injectManifest SW, add per-user API cache key via JWT decode"
```

---

## Chunk 5: PWA icons

### Task 10: Generate proper PWA icons and update manifest

**Files:**
- Create: `scripts/generate-icons.js`
- Modify: `public/manifest.json`
- Modify: `package.json`
- Create (generated, committed): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`

- [ ] **Step 1: Install sharp**

```bash
npm install --save-dev sharp
```

- [ ] **Step 2: Create the icon generation script**

Create `scripts/generate-icons.js`:
```js
import sharp from 'sharp';
import { mkdirSync } from 'fs';

mkdirSync('public/icons', { recursive: true });

const src = 'public/logo.png';

// Standard icons — crop to square and resize
await sharp(src).resize(192, 192, { fit: 'cover' }).toFile('public/icons/icon-192.png');
await sharp(src).resize(512, 512, { fit: 'cover' }).toFile('public/icons/icon-512.png');

// Maskable icon — add 10% safe-area padding (Android adaptive icons)
// The image occupies the inner 80% of the canvas; the outer 10% on each side is the safe zone.
const maskableSize = 512;
const innerSize = Math.round(maskableSize * 0.8);
const padding = Math.round(maskableSize * 0.1);
const inner = await sharp(src)
  .resize(innerSize, innerSize, { fit: 'cover' })
  .toBuffer();
await sharp({
  create: { width: maskableSize, height: maskableSize, channels: 4, background: { r: 245, g: 230, b: 208, alpha: 1 } },
})
  .composite([{ input: inner, top: padding, left: padding }])
  .png()
  .toFile('public/icons/icon-512-maskable.png');

console.log('Icons generated in public/icons/');
```

Note: the background color `#f5e6d0` matches the PWA `background_color` in `manifest.json`.

- [ ] **Step 3: Add the script to package.json**

In `package.json`, add to the `"scripts"` block:
```json
"icons": "node scripts/generate-icons.js"
```

- [ ] **Step 4: Run the script to generate icons**

```bash
npm run icons
```
Expected output: `Icons generated in public/icons/`
Expected files created: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`

Verify file sizes are reasonable (each should be well under 1 MB):
```bash
ls -lh public/icons/
```

- [ ] **Step 5: Update manifest.json**

Replace the two icon entries in `public/manifest.json` that reference `/logo.png`:
```json
  "icons": [
    { "src": "/favicon.png", "sizes": "64x64", "type": "image/png" },
    { "src": "/logo.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/logo.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
```
with:
```json
  "icons": [
    { "src": "/favicon.png", "sizes": "64x64", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
```

- [ ] **Step 6: Verify build still passes**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds.

- [ ] **Step 7: Commit everything**

```bash
git add scripts/generate-icons.js public/icons/ public/manifest.json package.json package-lock.json
git commit -m "feat: generate proper PWA icons (192/512/maskable) via sharp script, update manifest — replaces 16MB logo.png"
```

---

## Final: push and verify

- [ ] **Step 1: Run full test suite**

```bash
npm test 2>&1 | tail -30
```
Expected: all tests pass, no regressions.

- [ ] **Step 2: Push branch**

```bash
git push origin copilot/mobile-ios-native-finish
```

- [ ] **Step 3: Verify PR is no longer marked as having conflicts**

```bash
gh pr view 72 --repo dankadr/world-tracker --json mergeable,mergeStateStatus
```
Expected: `"mergeable": "MERGEABLE"` (or similar clean state).
