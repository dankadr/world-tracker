# Dynamic GeoJSON Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lazy-load country GeoJSON files on demand instead of bundling all 4+ MB statically, reducing the initial JS bundle from 5.1 MB → ~1.8 MB.

**Architecture:** Add `regionCount` to `countries.json` so metadata lookups stay synchronous. Convert all country-specific GeoJSON imports to Vite dynamic `import()` chunks in `countries.js`. `App.jsx` loads GeoJSON async when a country is selected and passes it as `geoData` prop to `SwissMap` and `Sidebar`. `world.json` stays static (needed on first paint).

**Tech Stack:** Vite dynamic imports (automatic code splitting), React state (`useState`/`useEffect`), existing `loadCountryGeoData()` cache pattern.

> **No test runner.** Verification = `npm run build` (check chunk output) + browser DevTools Network tab (confirm GeoJSON chunks are absent on initial load and appear only when a country is opened).

---

### Task 1: Add `regionCount` to `src/config/countries.json`

**Files:**
- Modify: `src/config/countries.json`

This provides a synchronous source of truth for region counts so the rest of the app doesn't need GeoJSON geometry just to answer "how many regions does this country have?"

Counts (verified from the actual GeoJSON files, filtering `isBorough=true` which currently has no effect on any file):

| id | regionCount |
|----|------------|
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

**Step 1: Add `regionCount` to each entry**

Open `src/config/countries.json` and add `"regionCount": <N>` to every object. The final file should look like (abbreviated):

```json
[
  {
    "id": "ch",
    "name": "Switzerland",
    "flag": "🇨🇭",
    "regionLabel": "Cantons",
    "regionLabelSingular": "canton",
    "geoFile": "cantons.json",
    "regionCount": 26,
    "center": [46.8, 8.22],
    "zoom": 8,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#d89648",
    "visitedHover": "#c07a30"
  },
  {
    "id": "us",
    "name": "United States",
    "flag": "🇺🇸",
    "regionLabel": "States",
    "regionLabelSingular": "state",
    "geoFile": "usa.json",
    "regionCount": 52,
    "center": [39.5, -98.35],
    "zoom": 4,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#d89648",
    "visitedHover": "#c07a30"
  },
  {
    "id": "usparks",
    "name": "US Nat. Parks",
    "flag": "🏞️",
    "regionLabel": "National Parks",
    "regionLabelSingular": "national park",
    "geoFile": "us-parks.json",
    "regionCount": 63,
    "center": [39.5, -98.35],
    "zoom": 4,
    "minZoom": 2,
    "maxZoom": 15,
    "visitedColor": "#d89648",
    "visitedHover": "#c07a30",
    "pointMode": true
  },
  {
    "id": "nyc",
    "name": "NYC",
    "flag": "🗽",
    "regionLabel": "Neighborhoods",
    "regionLabelSingular": "neighborhood",
    "geoFile": "nyc.json",
    "regionCount": 197,
    "center": [40.7128, -74.006],
    "zoom": 11,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#9b59b6",
    "visitedHover": "#8e44ad"
  },
  {
    "id": "no",
    "name": "Norway",
    "flag": "🇳🇴",
    "regionLabel": "Counties & Territories",
    "regionLabelSingular": "county/territory",
    "geoFile": "norway.json",
    "regionCount": 16,
    "center": [68.0, 16.0],
    "zoom": 3,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#e74c3c",
    "visitedHover": "#c0392b"
  },
  {
    "id": "ca",
    "name": "Canada",
    "flag": "🇨🇦",
    "regionLabel": "Provinces & Territories",
    "regionLabelSingular": "province/territory",
    "geoFile": "canada.json",
    "regionCount": 13,
    "center": [60.0, -96.0],
    "zoom": 3,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#e67e22",
    "visitedHover": "#d35400"
  },
  {
    "id": "capitals",
    "name": "World Capitals",
    "flag": "🏛️",
    "regionLabel": "Capitals",
    "regionLabelSingular": "capital",
    "geoFile": "capitals.json",
    "regionCount": 192,
    "center": [20, 0],
    "zoom": 2,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#f39c12",
    "visitedHover": "#e67e22",
    "pointMode": true
  },
  {
    "id": "jp",
    "name": "Japan",
    "flag": "🇯🇵",
    "regionLabel": "Prefectures",
    "regionLabelSingular": "prefecture",
    "geoFile": "japan.json",
    "regionCount": 47,
    "center": [36.5, 138.0],
    "zoom": 5,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#dc143c",
    "visitedHover": "#b01030"
  },
  {
    "id": "au",
    "name": "Australia",
    "flag": "🇦🇺",
    "regionLabel": "States & Territories",
    "regionLabelSingular": "state/territory",
    "geoFile": "australia.json",
    "regionCount": 8,
    "center": [-25.0, 134.0],
    "zoom": 4,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#f4a020",
    "visitedHover": "#d48b1a"
  },
  {
    "id": "ph",
    "name": "Philippines",
    "flag": "🇵🇭",
    "regionLabel": "Regions",
    "regionLabelSingular": "region",
    "geoFile": "philippines.json",
    "regionCount": 17,
    "center": [12.5, 122.0],
    "zoom": 5,
    "minZoom": 2,
    "maxZoom": 18,
    "visitedColor": "#d89648",
    "visitedHover": "#c07a30"
  }
]
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/config/countries.json
git commit -m "feat: add regionCount to countries.json config"
```

---

### Task 2: Refactor `src/data/countries.js` to dynamic imports

**Files:**
- Modify: `src/data/countries.js`

Remove all static GeoJSON imports. Export a new `loadCountryGeoData(geoFile)` async function. Each GeoJSON file becomes a separate Vite chunk loaded on demand. A module-level `Map` caches results so each file is only fetched once per session.

**Step 1: Replace the entire file**

```js
import countriesConfig from '../config/countries.json';

// ── Dynamic GeoJSON loaders ────────────────────────────────────────────────
// Vite splits each import() into a separate browser-cached chunk.
// Keys must be static strings so Vite can statically analyse them.

const geoCache = new Map();

const geoLoaders = {
  'cantons.json':     () => import('./cantons.json'),
  'usa.json':         () => import('./usa.json'),
  'us-parks.json':    () => import('./us-parks.json'),
  'nyc.json':         () => import('./nyc.json'),
  'norway.json':      () => import('./norway.json'),
  'canada.json':      () => import('./canada.json'),
  'capitals.json':    () => import('./capitals.json'),
  'japan.json':       () => import('./japan.json'),
  'australia.json':   () => import('./australia.json'),
  'philippines.json': () => import('./philippines.json'),
};

/**
 * Load GeoJSON for a country on demand.
 * Results are cached in-memory after the first load.
 * @param {string} geoFile  e.g. 'cantons.json'
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function loadCountryGeoData(geoFile) {
  if (geoCache.has(geoFile)) return geoCache.get(geoFile);
  const loader = geoLoaders[geoFile];
  if (!loader) throw new Error(`No loader registered for ${geoFile}`);
  const mod = await loader();
  geoCache.set(geoFile, mod.default);
  return mod.default;
}

// ── Countries config ───────────────────────────────────────────────────────
// countryList entries contain only config metadata (no .data field).
// Use loadCountryGeoData(country.geoFile) to get the GeoJSON when needed.

const countries = {};
for (const entry of countriesConfig) {
  countries[entry.id] = { ...entry };
}

export const countryList = Object.values(countries);
export default countries;
```

**Step 2: Verify build**

```bash
npm run build 2>&1 | tail -10
```
Expected: build succeeds; output shows multiple `*.json-*.js` chunks (one per country GeoJSON). Example:
```
dist/assets/cantons-Xxx.js    380 kB
dist/assets/usa-Xxx.js        220 kB
...
```

**Step 3: Commit**

```bash
git add src/data/countries.js
git commit -m "feat: convert country GeoJSON to dynamic import() chunks"
```

---

### Task 3: Fix metadata-only usages of `c.data`

**Files:**
- Modify: `src/utils/achievementProgress.js` (line 41)
- Modify: `src/data/achievements.js` (line 33)
- Modify: `src/components/OverallProgress.jsx` (line 27)
- Modify: `src/components/WorldSidebar.jsx` (lines 44–46)
- Modify: `src/components/StatsModal.jsx` (lines 320–323)

All of these only need the region _count_, not geometry. Replace `c.data.features.filter(...).length` with `c.regionCount ?? 0`.

**Step 1: Fix `src/utils/achievementProgress.js`**

Find line 41:
```js
  return c ? c.data.features.filter((f) => !f.properties?.isBorough).length : 0;
```
Replace with:
```js
  return c ? (c.regionCount ?? 0) : 0;
```

**Step 2: Fix `src/data/achievements.js`**

Find line 33:
```js
  return c ? c.data.features.filter((f) => !f.properties?.isBorough).length : 0;
```
Replace with:
```js
  return c ? (c.regionCount ?? 0) : 0;
```

**Step 3: Fix `src/components/OverallProgress.jsx`**

Find line 27:
```js
    const total = c.data.features.filter((f) => !f.properties?.isBorough).length;
```
Replace with:
```js
    const total = c.regionCount ?? 0;
```

**Step 4: Fix `src/components/WorldSidebar.jsx`**

Find lines 44–46 (the `getTotalRegions` function):
```js
function getTotalRegions(country) {
  return country.data.features.filter((f) => !f.properties?.isBorough).length;
}
```
Replace with:
```js
function getTotalRegions(country) {
  return country.regionCount ?? 0;
}
```

**Step 5: Fix `src/components/StatsModal.jsx`**

Find lines 320–323:
```js
  const stats = countryList.map((c) => {
    const total = c.data.features.filter(f => !f.properties?.isBorough).length;
    const visited = getVisitedIds(c.id, userId).length;
    return { ...c, total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });
```
Replace with:
```js
  const stats = countryList.map((c) => {
    const total = c.regionCount ?? 0;
    const visited = getVisitedIds(c.id, userId).length;
    return { ...c, total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });
```

**Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 7: Commit**

```bash
git add src/utils/achievementProgress.js src/data/achievements.js \
        src/components/OverallProgress.jsx src/components/WorldSidebar.jsx \
        src/components/StatsModal.jsx
git commit -m "feat: replace c.data.features.length with c.regionCount for metadata lookups"
```

---

### Task 4: Make `StatsModal.getVisitedCoords` async

**Files:**
- Modify: `src/components/StatsModal.jsx`

`getVisitedCoords` iterates over `c.data.features` for all countries (to find centroids of visited regions). With dynamic loading, `c.data` no longer exists. Fix: load GeoJSON async for each country that has visited regions, then compute centroids. Show a loading state in the modal while computing.

**Step 1: Add the import at the top of `StatsModal.jsx`**

After the existing imports, add:
```js
import { loadCountryGeoData } from '../data/countries';
```

**Step 2: Make `getVisitedCoords` async**

Find the `getVisitedCoords` function (around line 63–76):
```js
function getVisitedCoords(userId) {
  const points = [];
  for (const c of countryList) {
    const visitedIds = new Set(getVisitedIds(c.id, userId));
    if (visitedIds.size === 0) continue;
    for (const f of c.data.features) {
      if (f.properties.isBorough) continue;
      if (visitedIds.has(f.properties.id)) {
        const pt = centroid(f.geometry);
        if (pt) points.push({ lng: pt[0], lat: pt[1], name: f.properties.name, country: c.name, flag: c.flag });
      }
    }
  }
  return points;
}
```
Replace with:
```js
async function getVisitedCoords(userId) {
  const points = [];
  for (const c of countryList) {
    const visitedIds = new Set(getVisitedIds(c.id, userId));
    if (visitedIds.size === 0) continue;
    const geoData = await loadCountryGeoData(c.geoFile);
    for (const f of geoData.features) {
      if (f.properties.isBorough) continue;
      if (visitedIds.has(f.properties.id)) {
        const pt = centroid(f.geometry);
        if (pt) points.push({ lng: pt[0], lat: pt[1], name: f.properties.name, country: c.name, flag: c.flag });
      }
    }
  }
  return points;
}
```

**Step 3: Change the component to use async geo insights**

Find the `StatsModal` function body where `coords` and `geo` are computed synchronously (around line 330–332):
```js
  const coords = getVisitedCoords(userId);
  const geo = computeGeoInsights(coords);
```

Replace these two lines with a `useEffect`-driven loading state. Add a `geoInsights` state:

At the top of the `StatsModal` function, after the existing `useState` calls, add:
```js
  const [geoInsights, setGeoInsights] = useState(null);
  const [geoInsightsLoading, setGeoInsightsLoading] = useState(true);
```

Then remove the two synchronous lines and add a `useEffect` after the existing `useMemo` calls:
```js
  useEffect(() => {
    let cancelled = false;
    setGeoInsightsLoading(true);
    getVisitedCoords(userId).then((coords) => {
      if (cancelled) return;
      setGeoInsights(computeGeoInsights(coords));
      setGeoInsightsLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);
```

**Step 4: Update JSX that references `geo`**

In the JSX, find every place `geo` is used and replace with `geoInsights`. Also add a loading guard around any geo insights section. Look for patterns like:
```jsx
{geo && (
  <div>...</div>
)}
```
These just need to change `geo` → `geoInsights`. The loading indicator is only needed if you want to show "Computing..." — for simplicity, `null` (no insights section) while loading is acceptable and matches the existing `{geo && ...}` guard.

If there is a dedicated "Geographic Insights" section that previously used `geo`, also add:
```jsx
{geoInsightsLoading && <p style={{color:'var(--text-secondary)'}}>Computing geographic insights…</p>}
```
before the `{geoInsights && ...}` block.

**Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 6: Commit**

```bash
git add src/components/StatsModal.jsx
git commit -m "feat: make StatsModal geo insights async-load GeoJSON on demand"
```

---

### Task 5: Add async GeoJSON loading to `App.jsx`

**Files:**
- Modify: `src/App.jsx`

`App.jsx` accesses `country.data.features` in two places and passes `country` to `SwissMap` and `Sidebar`. Add `geoData`/`geoDataLoading` state, load GeoJSON when the selected country changes, and pass `geoData` as a prop.

**Step 1: Add `loadCountryGeoData` import**

At the top of `App.jsx`, find the existing countries import:
```js
import countries from './data/countries';
import { countryList } from './data/countries';
```
Change to:
```js
import countries, { countryList, loadCountryGeoData } from './data/countries';
```

**Step 2: Add `geoData` state**

In the `App` function, near the other state declarations (around line 133), add:
```js
const [geoData, setGeoData] = useState(null);
const [geoDataLoading, setGeoDataLoading] = useState(false);
```

**Step 3: Load GeoJSON when country changes**

Add a `useEffect` that triggers when `country.geoFile` changes. Place it near the other `countryId`-dependent effects:
```js
useEffect(() => {
  if (!country?.geoFile) return;
  setGeoDataLoading(true);
  setGeoData(null);
  loadCountryGeoData(country.geoFile).then((data) => {
    setGeoData(data);
    setGeoDataLoading(false);
  });
}, [country?.geoFile]);
```

**Step 4: Replace `country.data.features` references in App.jsx**

There are two:

Line ~419:
```js
const regionList = country.data.features.filter((f) => !f.properties.isBorough);
const total = regionList.length;
```
Replace with:
```js
const total = country.regionCount ?? 0;
```
(The `regionList` variable is used only to derive `total` here; `count` and `pct` are still correct.)

Line ~828 (inside `ComparisonStats` props):
```js
total={isWorldView ? worldData.features.length : country.data.features.filter((f) => !f.properties.isBorough).length}
```
Replace with:
```js
total={isWorldView ? worldData.features.length : (country.regionCount ?? 0)}
```

**Step 5: Pass `geoData` to `RegionMap` and `Sidebar`**

Find where `RegionMap` is called (~line 727):
```jsx
<RegionMap
  country={country}
  visited={displayVisited}
  ...
/>
```
Add the prop:
```jsx
<RegionMap
  country={country}
  geoData={geoData}
  visited={displayVisited}
  ...
/>
```

Find where `Sidebar` is called (two occurrences, ~lines 663 and 691). Add `geoData` prop to both:
```jsx
<Sidebar
  country={country}
  geoData={geoData}
  visited={displayVisited}
  ...
/>
```

**Step 6: Add loading overlay in map area**

Find the `<main className="map-container">` block (~line 717). Add a loading overlay just before `RegionMap`:
```jsx
{geoDataLoading && (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.1)', zIndex: 500,
    pointerEvents: 'none',
  }}>
    <span style={{ fontSize: 14, opacity: 0.7 }}>Loading map…</span>
  </div>
)}
```

**Step 7: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: load country GeoJSON async in App.jsx, pass geoData prop"
```

---

### Task 6: Update `Sidebar.jsx` to use `geoData` prop

**Files:**
- Modify: `src/components/Sidebar.jsx`

`Sidebar` currently reads `country.data.features` directly (line 58–61). Accept `geoData` as a new prop and use `geoData.features` instead. Guard against `null` when still loading.

**Step 1: Add `geoData` to the prop list**

Find the function signature:
```js
export default function Sidebar({
  country,
  visited,
  ...
```
Add `geoData,` after `country,`:
```js
export default function Sidebar({
  country,
  geoData,
  visited,
  ...
```

**Step 2: Guard and replace `country.data.features` usage**

Find lines 58–61:
```js
  const regionList = country.data.features
    .filter((f) => !f.properties.isBorough)
    .map((f) => ({ id: f.properties.id, name: f.properties.name, borough: f.properties.borough || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
```
Replace with:
```js
  const regionList = (geoData?.features ?? [])
    .filter((f) => !f.properties.isBorough)
    .map((f) => ({ id: f.properties.id, name: f.properties.name, borough: f.properties.borough || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
```

The rest of the Sidebar uses `regionList`, `total`, etc. which are derived from this. When `geoData` is null (loading), `regionList` will be `[]` and `total` will be `0` — Sidebar renders an empty list, which is fine since the map shows a loading overlay.

**Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 4: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "feat: Sidebar accepts geoData prop, guards against null during loading"
```

---

### Task 7: Update `SwissMap.jsx` to use `geoData` prop

**Files:**
- Modify: `src/components/SwissMap.jsx`

`SwissMap` (imported as `RegionMap`) currently reads `country.data.features` in the main component and in the `FriendsRegionOverlay` sub-component. Pass `geoData` as a new prop and propagate it.

**Step 1: Find the main `export default` function signature**

Search for the function that receives `country` as a prop. It will be the main exported function. Add `geoData` to its props.

**Step 2: Pass `geoData` to `FriendsRegionOverlay`**

Find where `FriendsRegionOverlay` is rendered in JSX:
```jsx
<FriendsRegionOverlay country={country} friendOverlayData={...} />
```
Add `geoData`:
```jsx
<FriendsRegionOverlay country={country} geoData={geoData} friendOverlayData={...} />
```

**Step 3: Update `FriendsRegionOverlay` props and usage**

Find `FriendsRegionOverlay` (around line 40). Its signature:
```js
function FriendsRegionOverlay({ country, friendOverlayData }) {
```
Add `geoData`:
```js
function FriendsRegionOverlay({ country, geoData, friendOverlayData }) {
```

Find lines 58–63:
```js
  const overlayData = useMemo(() => ({
    type: 'FeatureCollection',
    features: country.data.features.filter(
      (f) => !f.properties.isBorough && friendsByRegion[f.properties.id]
    ),
  }), [country.data.features, friendsByRegion]);
```
Replace with:
```js
  const overlayData = useMemo(() => ({
    type: 'FeatureCollection',
    features: (geoData?.features ?? []).filter(
      (f) => !f.properties.isBorough && friendsByRegion[f.properties.id]
    ),
  }), [geoData, friendsByRegion]);
```

**Step 4: Replace all remaining `country.data.features` in the main component**

There are three occurrences remaining in the main component (~lines 137, 140, 375, 379). For each, replace `country.data.features` with `geoData?.features ?? []`. Also update the `useMemo` dependency arrays accordingly (replace `country.data.features` with `geoData`).

Example — find:
```js
    features: country.data.features.filter(
```
Replace all with:
```js
    features: (geoData?.features ?? []).filter(
```

And in `useMemo` deps, replace `country.data.features` with `geoData`.

**Step 5: Guard the map from rendering with no data**

Find the main `return` statement of the SwissMap component. If `geoData` is null, return null (App.jsx shows the loading overlay instead):

At the top of the main render logic, before any JSX:
```js
  if (!geoData) return null;
```

**Step 6: Verify build**

```bash
npm run build 2>&1 | tail -5
```
Expected: no errors.

**Step 7: Commit**

```bash
git add src/components/SwissMap.jsx
git commit -m "feat: SwissMap accepts geoData prop, guards against null"
```

---

### Task 8: Verify build output and chunk splitting

**Files:** (none — verification only)

**Step 1: Run a clean build**

```bash
npm run build 2>&1
```

Look for these signals in the output:
1. No errors
2. Multiple `.json-*.js` or named GeoJSON chunks in `dist/assets/` (one per country)
3. The main `index-*.js` chunk should be significantly smaller than the previous 5,097 kB

**Step 2: Inspect chunk sizes**

```bash
ls -lh dist/assets/ | sort -k5 -rh | head -20
```

Expected: `index-*.js` around 1.8–2.5 MB; individual country chunks 100–600 KB each.

**Step 3: Start dev server and verify network behavior**

```bash
npm run dev
```

Open the app in a browser with DevTools → Network tab → filter "Fetch/XHR" or "JS".

1. **Initial load:** Country GeoJSON chunks should NOT appear in network requests
2. **Open Switzerland detail view:** `cantons-*.js` chunk loads
3. **Open Switzerland again:** no new network request (in-memory cache)
4. **Open Japan:** `japan-*.js` chunk loads; `cantons-*.js` does not reload

**Step 4: Verify functionality**

- [ ] Switzerland map renders correctly with cantons
- [ ] Achievements and progress % still correct for visited regions
- [ ] Overall progress widget shows correct totals
- [ ] WorldSidebar tracker cards show correct region counts
- [ ] StatsModal opens, shows "Computing geographic insights…" briefly, then shows insights
- [ ] Switching countries shows map loading overlay then renders
- [ ] XP system and visit toggling work correctly
- [ ] Share URLs still work (visit a country, copy hash, open in new tab)

**Step 5: Final commit if any fixes were needed**

```bash
git add -p  # review and stage fixes
git commit -m "fix: address any issues found in verification"
```
