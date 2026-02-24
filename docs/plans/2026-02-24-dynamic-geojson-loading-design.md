# Design: Dynamic GeoJSON Loading (Bundle Size & Load Performance)

**Date:** 2026-02-24
**Status:** Approved
**Driver:** Reduce initial JS bundle from 5.1 MB → ~1.8 MB by lazy-loading country GeoJSON on demand

---

## Problem

All 10 country GeoJSON files are statically imported into `countries.js`, bundling 4+ MB of geographic data into every user's initial page load. A user who only uses Switzerland still downloads Norway, Canada, Philippines, NYC, Australia, etc.

The result: a 5.1 MB JS bundle (1.6 MB gzip) that's especially painful on mobile.

**Write-side debouncing and frontend read caching are already done** — this addresses the remaining major performance gap.

---

## Approach

1. Add `regionCount` to `countries.json` config so metadata lookups (achievement progress, region totals) remain synchronous without needing GeoJSON geometry.
2. Convert all country-specific GeoJSON imports to Vite dynamic `import()` chunks in `countries.js`.
3. Load GeoJSON asynchronously in `App.jsx` when a country is selected, with a short loading state.
4. Cache loaded data in a module-level `Map` so each file is only fetched once per session.
5. `world.json` stays as a static import (needed on first paint).

---

## Architecture

### Part 1: `src/config/countries.json` — add `regionCount`

Add `regionCount` (non-borough feature count) to each entry:

| Country | `regionCount` |
|---------|--------------|
| ch | 26 |
| us | 52 |
| usparks | 63 |
| nyc | 197 |
| no | 16 |
| ca | 13 |
| capitals | 192 |
| jp | 47 |
| au | 8 |
| ph | 17 |

This unblocks synchronous metadata reads in `achievementProgress.js`, `achievements.js`, `OverallProgress.jsx`, `WorldSidebar.jsx`, and `StatsModal.jsx`.

### Part 2: `src/data/countries.js` — dynamic loaders

Remove all static GeoJSON imports. Export an async `loadCountryGeoData(geoFile)` function:

```js
const geoCache = new Map();

const geoLoaders = {
  'cantons.json':    () => import('./cantons.json'),
  'usa.json':        () => import('./usa.json'),
  'us-parks.json':   () => import('./us-parks.json'),
  'nyc.json':        () => import('./nyc.json'),
  'norway.json':     () => import('./norway.json'),
  'canada.json':     () => import('./canada.json'),
  'capitals.json':   () => import('./capitals.json'),
  'japan.json':      () => import('./japan.json'),
  'australia.json':  () => import('./australia.json'),
  'philippines.json':() => import('./philippines.json'),
};

export async function loadCountryGeoData(geoFile) {
  if (geoCache.has(geoFile)) return geoCache.get(geoFile);
  const mod = await geoLoaders[geoFile]();
  geoCache.set(geoFile, mod.default);
  return mod.default;
}
```

Vite creates a separate browser-cached chunk per dynamic import. `countryList` continues to export synchronous config metadata (name, flag, center, zoom, regionCount, etc.) — only `data` is removed.

### Part 3: `src/App.jsx` — async load on country select

When a country is selected (e.g. from world map click or tab switch):

```js
const [geoData, setGeoData] = useState(null);
const [geoDataLoading, setGeoDataLoading] = useState(false);

useEffect(() => {
  if (!country) return;
  setGeoDataLoading(true);
  loadCountryGeoData(country.geoFile).then((data) => {
    setGeoData(data);
    setGeoDataLoading(false);
  });
}, [country]);
```

`SwissMap` and `Sidebar` receive `geoData` as a prop instead of reading `country.data`. While loading, a lightweight spinner is shown over the map area. First load per country: ~50–200ms on fast connection. Subsequent visits: instant (in-memory cache).

---

## Files Modified

| File | Change |
|------|--------|
| `src/config/countries.json` | Add `regionCount` to all 10 entries |
| `src/data/countries.js` | Remove static imports; add `loadCountryGeoData()` async fn; remove `data` from `countryList` entries |
| `src/App.jsx` | `loadCountryGeoData()` on country select; `geoData`/`geoDataLoading` state; pass `geoData` to children |
| `src/components/SwissMap.jsx` | Accept `geoData` prop instead of `country.data` |
| `src/components/Sidebar.jsx` | Accept `geoData` prop instead of `country.data` |
| `src/utils/achievementProgress.js` | `c.data.features.filter(...).length` → `c.regionCount` |
| `src/data/achievements.js` | Same as above |
| `src/components/OverallProgress.jsx` | Same as above |
| `src/components/WorldSidebar.jsx` | Same as above |
| `src/components/StatsModal.jsx` | Same as above |

---

## What Doesn't Change

- `world.json` static import (needed for first paint)
- All visit tracking, XP system, achievements logic
- Backend, database, caching layer
- URL/hash-based sharing
- Guest (localStorage) mode

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Initial JS bundle | 5.1 MB (1.6 MB gzip) | ~1.8 MB (0.6 MB gzip) |
| Time to interactive (mobile 4G ~10 Mbps) | ~4–6s | ~1.5–2s |
| Countries never opened | All downloaded | Never downloaded |
| Repeated country opens | In-memory (instant) | In-memory (instant) |

---

## Verification

1. `npm run build` — no errors; chunk output shows separate `.json` chunks per country
2. DevTools → Network tab: on first load, country GeoJSON chunks absent; appear only when that country is opened
3. `world.json` chunk loads on first paint
4. Switching countries: brief spinner → map renders; second switch to same country: instant
5. Achievements / region counts still correct (using `regionCount`)
6. Visit toggling, XP, share URLs all unchanged
