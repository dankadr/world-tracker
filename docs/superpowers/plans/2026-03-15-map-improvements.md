# Map Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Streets tile layer, increase max zoom to 18, swap to higher-res world GeoJSON, and fade the country overlay at high zoom levels.

**Architecture:** Four independent changes in sequence — config, component prop, data swap, new inner component. Each is self-contained. `OverlayFader` uses a custom Leaflet Pane wrapping the country GeoJSON and sets CSS `opacity` based on zoom level using the existing `gameModeRef` to skip fading in game mode.

**Tech Stack:** React, react-leaflet, Leaflet, Vitest, geo-countries (npm, data only, devDep)

---

## Chunk 1: Streets tile layer + maxZoom

### Task 1: Add Streets tile layer to config

**Files:**
- Modify: `src/config/mapLayers.json`
- Create: `src/config/__tests__/mapLayers.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/config/__tests__/mapLayers.test.js` (the directory already exists — it was created as part of project setup):

```js
import { describe, it, expect } from 'vitest';
import LAYERS from '../mapLayers.json';

describe('mapLayers config', () => {
  it('includes a streets layer with CartoDB Voyager URLs', () => {
    const streets = LAYERS.find((l) => l.id === 'streets');
    expect(streets).toBeDefined();
    expect(streets.label).toBe('Streets');
    expect(streets.light).toContain('voyager');
    expect(streets.dark).toContain('voyager');
  });

  it('all base layers have light and dark URLs', () => {
    LAYERS.filter((l) => !l.overlay).forEach((l) => {
      expect(l.light, `${l.id} missing light URL`).toBeTruthy();
      expect(l.dark, `${l.id} missing dark URL`).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/config/__tests__/mapLayers.test.js
```

Expected: FAIL — "streets layer with CartoDB Voyager URLs > Expected to be defined"

- [ ] **Step 3: Add Streets entry to mapLayers.json**

In `src/config/mapLayers.json`, add the following entry after the `"terrain"` object and before the `"friends"` overlay object:

```json
{
  "id": "streets",
  "label": "Streets",
  "light": "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  "dark":  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
}
```

> **Note:** `light` and `dark` are intentionally identical — CartoDB Voyager is a single neutral style with no dark variant. This is consistent with the Satellite entry, which also uses the same URL for both themes. The test deliberately checks for `voyager` in both URLs, not that they differ.

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run src/config/__tests__/mapLayers.test.js
```

Expected: PASS — 2 tests

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: all 182+ tests pass (the Streets entry is auto-picked up by `MapLayerControl` — no UI code change needed)

- [ ] **Step 6: Commit**

```bash
git add src/config/mapLayers.json src/config/__tests__/mapLayers.test.js
git commit -m "feat: add CartoDB Voyager streets tile layer"
```

---

### Task 2: Increase maxZoom to 18

**Files:**
- Modify: `src/components/WorldMap.jsx:462` (the `maxZoom` prop on `<MapContainer>`)
- Modify: `src/components/__tests__/WorldMap.test.jsx` (update mock to expose maxZoom)

- [ ] **Step 1: Update the MapContainer mock to expose maxZoom**

In `src/components/__tests__/WorldMap.test.jsx`, find the `MapContainer` line inside `vi.mock('react-leaflet', ...)`:

```js
  MapContainer: forwardRef(({ children, zoomControl, scrollWheelZoom, minZoom, maxZoom, worldCopyJump, maxBounds, maxBoundsViscosity, ...props }, ref) => (
    <div ref={ref} {...props}>{children}</div>
  )),
```

Replace **only this line** with:

```js
  MapContainer: forwardRef(({ children, zoomControl, scrollWheelZoom, minZoom, maxZoom, worldCopyJump, maxBounds, maxBoundsViscosity, ...props }, ref) => (
    <div ref={ref} data-max-zoom={maxZoom} {...props}>{children}</div>
  )),
```

No other changes to the mock file in this task.

- [ ] **Step 2: Write the failing test**

Add to the `describe('WorldMap', ...)` block in `src/components/__tests__/WorldMap.test.jsx`:

```js
it('sets maxZoom to 18 on the map container', () => {
  const { container } = render(
    <ThemeProvider>
      <WorldMap
        visited={new Set()}
        onToggle={() => {}}
        wishlist={new Set()}
        comparisonMode={false}
      />
    </ThemeProvider>
  );
  expect(container.querySelector('[data-max-zoom]').dataset.maxZoom).toBe('18');
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx vitest run src/components/__tests__/WorldMap.test.jsx
```

Expected: FAIL — `'8' !== '18'` (current maxZoom is 8)

- [ ] **Step 4: Change maxZoom in WorldMap.jsx**

In `src/components/WorldMap.jsx`, find:

```jsx
        maxZoom={8}
```

Replace with:

```jsx
        maxZoom={18}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/components/__tests__/WorldMap.test.jsx
```

Expected: PASS — 2 tests

- [ ] **Step 6: Run full suite**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/WorldMap.jsx src/components/__tests__/WorldMap.test.jsx
git commit -m "feat: increase map maxZoom from 8 to 18"
```

---

## Chunk 2: Higher-resolution world GeoJSON

### Task 3: Swap world.json with geo-countries 1:50m data

**Files:**
- Create: `scripts/normalize-world-geojson.cjs` (one-off script, not imported by the app)
- Replace: `src/data/world.json`

- [ ] **Step 1: Install geo-countries as a dev dependency**

```bash
npm install --save-dev geo-countries
```

Expected: package added to `devDependencies` in `package.json`

- [ ] **Step 2: Create the normalization script**

Create `scripts/normalize-world-geojson.cjs`:

```js
// One-off script: generates src/data/world.json from geo-countries package.
// Run with: node scripts/normalize-world-geojson.cjs
const src = require('geo-countries/data/countries.geojson');
const { writeFileSync } = require('fs');
const { join } = require('path');

function assert(condition, message) {
  if (!condition) { console.error(`✗ ${message}`); process.exit(1); }
}

// Verify source looks right
assert(src.type === 'FeatureCollection', 'Expected FeatureCollection');
assert(src.features.length > 150, `Expected 150+ features, got ${src.features.length}`);

// Normalize to match existing schema: { id: "zw", name: "Zimbabwe" }
const normalized = {
  type: 'FeatureCollection',
  features: src.features
    // Skip territories without a standard ISO alpha-2 code
    .filter((f) => f.properties.ISO_A2 !== '-99')
    .map((f) => ({
      ...f,
      properties: {
        id: f.properties.ISO_A2.toLowerCase(),
        name: f.properties.ADMIN,
      },
    })),
};

// Spot-check: a few known countries must survive normalization.
// If a name assertion fails, log the actual ADMIN value from the raw source and
// update the expected string in spots[] to match — but only after confirming
// the raw source value is correct (e.g. "United States of America" vs "United States").
const spots = [
  { id: 'zw', name: 'Zimbabwe' },
  { id: 'us', name: 'United States of America' },
  { id: 'fr', name: 'France' },
  { id: 'jp', name: 'Japan' },
];
spots.forEach(({ id, name }) => {
  const found = normalized.features.find((f) => f.properties.id === id);
  assert(found, `Missing expected country: ${id}`);
  assert(found.properties.name === name, `Name mismatch for ${id}: got "${found.properties.name}", expected "${name}"`);
});

const outPath = join(__dirname, '../src/data/world.json');
writeFileSync(outPath, JSON.stringify(normalized));

const sizeMB = (Buffer.byteLength(JSON.stringify(normalized)) / 1024 / 1024).toFixed(2);
console.log(`✓ Written ${normalized.features.length} countries to src/data/world.json (${sizeMB} MB)`);
```

- [ ] **Step 3: Run the script**

```bash
node scripts/normalize-world-geojson.cjs
```

Expected output (values approximate):
```
✓ Written 177 countries to src/data/world.json (2.xx MB)
```

If any `console.assert` fires, it will print an error and you must fix the normalization mapping before proceeding. Common issue: `"United States of America"` may differ — check the actual `ADMIN` field value and update the spot-check if the name differs but the country is correct.

- [ ] **Step 4: Verify the new file structure**

```bash
node -e "
const data = require('./src/data/world.json');
const zw = data.features.find(f => f.properties.id === 'zw');
console.log('Feature count:', data.features.length);
console.log('Zimbabwe:', JSON.stringify(zw.properties));
console.log('First coord:', JSON.stringify(zw.geometry.coordinates[0][0]));
"
```

Expected: feature count > 150, Zimbabwe properties `{id: 'zw', name: 'Zimbabwe'}`, first coord is a valid `[lon, lat]` pair.

- [ ] **Step 5: Run the full test suite**

```bash
npm test -- --run
```

Expected: all tests pass. The existing WorldMap test uses `world.json` via the `WorldMap` component — the GeoJSON mock renders `features.slice(0, 3)` so as long as the first 3 features have `properties.id` and `properties.name`, the test passes.

- [ ] **Step 6: Commit**

```bash
git add src/data/world.json scripts/normalize-world-geojson.cjs package.json package-lock.json
git commit -m "feat: upgrade world GeoJSON to geo-countries 1:50m resolution"
```

---

## Chunk 3: Overlay fade by zoom (OverlayFader)

### Task 4: Add OverlayFader component to WorldMap

**Files:**
- Modify: `src/components/WorldMap.jsx`
- Modify: `src/components/__tests__/WorldMap.test.jsx`

The strategy: wrap the country `<GeoJSON>` in a named `<Pane name="countryPane">`. `OverlayFader` gets the pane's DOM element via `map.getPane('countryPane')` and sets its CSS `opacity`. This approach doesn't require knowing per-feature base styles — it fades the entire GeoJSON layer as a single CSS operation.

`computeZoomFactor` is a pure function, exported for unit testing.

- [ ] **Step 1: Write the failing unit test for computeZoomFactor**

At the top of `src/components/__tests__/WorldMap.test.jsx`, add the import alongside the existing imports (not inside any `describe` block):

```js
import { computeZoomFactor } from '../WorldMap';
```

Then add two new `describe` blocks after the existing `describe('WorldMap', ...)` block:

```js
describe('computeZoomFactor', () => {
  it('returns 1 at zoom 6 and below', () => {
    expect(computeZoomFactor(0)).toBe(1);
    expect(computeZoomFactor(6)).toBe(1);
  });

  it('returns 0 at zoom 10 and above', () => {
    expect(computeZoomFactor(10)).toBe(0);
    expect(computeZoomFactor(18)).toBe(0);
  });

  it('linearly fades between zoom 6 and 10', () => {
    expect(computeZoomFactor(8)).toBe(0.5);
    expect(computeZoomFactor(7)).toBe(0.75);
    expect(computeZoomFactor(9)).toBe(0.25);
  });
});

describe('OverlayFader wiring', () => {
  beforeEach(() => {
    // Reset shared pane between tests
    mockPane.style.opacity = undefined;
  });

  it('initializes pane to full opacity at low zoom (zoom 2)', () => {
    render(
      <ThemeProvider>
        <WorldMap visited={new Set()} onToggle={() => {}} wishlist={new Set()} comparisonMode={false} />
      </ThemeProvider>
    );
    // OverlayFader calls onZoomEnd() at mount; getZoom() mock returns 2 → factor = 1
    // Note: mock stores a number (1), not a DOM string ("1") — toBe(1) is correct for this mock
    expect(mockPane.style.opacity).toBe(1);
  });

  it('initializes pane to full opacity when game mode is active', () => {
    render(
      <ThemeProvider>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
          gameMode={{ targetId: 'fr', onCountryClick: () => {} }}
        />
      </ThemeProvider>
    );
    // Game mode branch sets opacity = 1; mock stores number, toBe(1) is correct
    expect(mockPane.style.opacity).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/components/__tests__/WorldMap.test.jsx
```

Expected: FAIL — `computeZoomFactor` is not exported

- [ ] **Step 3: Add vi.hoisted mockPane and update useMap mock**

`OverlayFader` calls `map.getPane(name)`, `map.getZoom()`, `map.on('zoomend', fn)`, and `map.off('zoomend', fn)`. The current `useMap` mock only provides `setView` and `fitBounds`.

We use `vi.hoisted` so `mockPane` is accessible both inside the hoisted mock factory and in the tests.

First, add `beforeEach` to the vitest import at the top of `src/components/__tests__/WorldMap.test.jsx`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
```

Then, after all `import` statements but before the first `vi.mock(...)` call, add:

```js
const mockPane = vi.hoisted(() => ({ style: {} }));
```

> `vi.hoisted` must come after `import` statements (ES module syntax requires imports first) but before `vi.mock` calls, which Vitest hoists to the top of the module at runtime. Placing `vi.hoisted` here makes `mockPane` available inside both the mock factory and the test bodies.

Then find the `useMap` entry inside `vi.mock('react-leaflet', ...)`:

```js
  useMap: () => ({
    setView: () => {},
    fitBounds: () => {},
  }),
```

Replace **only this entry** with:

```js
  useMap: () => ({
    setView: () => {},
    fitBounds: () => {},
    getPane: () => mockPane,
    getZoom: () => 2,
    on: () => {},
    off: () => {},
  }),
```

No other changes to the mock in this step.

- [ ] **Step 4: Implement computeZoomFactor and OverlayFader in WorldMap.jsx**

Add after the existing imports and before the `VISITED_COLOR` constant in `src/components/WorldMap.jsx`:

```js
export function computeZoomFactor(zoom) {
  if (zoom <= 6) return 1;
  if (zoom >= 10) return 0;
  return (10 - zoom) / 4;
}
```

Add the `OverlayFader` component after `MapController` (around line 97) and before `FriendsWorldOverlay`:

```jsx
function OverlayFader({ gameModeRef }) {
  const map = useMap();

  useEffect(() => {
    const pane = map.getPane('countryPane');
    if (!pane) return;

    function onZoomEnd() {
      if (gameModeRef.current) {
        pane.style.opacity = 1;
        return;
      }
      pane.style.opacity = computeZoomFactor(map.getZoom());
    }

    // Apply at mount time (handles the case where map loads already zoomed in)
    onZoomEnd();

    map.on('zoomend', onZoomEnd);
    return () => { map.off('zoomend', onZoomEnd); };
  }, [map, gameModeRef]);

  return null;
}
```

- [ ] **Step 5: Confirm existing imports and wrap the country GeoJSON**

Verify these are already in `src/components/WorldMap.jsx` (no changes needed, just confirming):

```bash
grep "Pane, useMap" src/components/WorldMap.jsx
```

Expected output: `import { MapContainer, GeoJSON, TileLayer, Pane, useMap } from 'react-leaflet';`

Also confirm `gameModeRef` is already declared in `WorldMap`:

```bash
grep "gameModeRef" src/components/WorldMap.jsx | head -3
```

Expected: lines showing `const gameModeRef = useRef(gameMode)` and `gameModeRef.current = gameMode`

If either is missing, add the relevant import before proceeding. (In practice both exist in the current file.)

In the JSX returned by `WorldMap`, find the `<GeoJSON>` for the main country layer:

```jsx
        <GeoJSON
          key={`world-geojson-${greaterIsraelEnabled}`}
          ref={geoJsonRef}
          data={modifiedWorldData}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
```

Replace with:

```jsx
        <Pane name="countryPane" style={{ zIndex: 400 }}>
          <GeoJSON
            key={`world-geojson-${greaterIsraelEnabled}`}
            ref={geoJsonRef}
            data={modifiedWorldData}
            style={getStyle}
            onEachFeature={onEachFeature}
          />
        </Pane>
```

Also add `<OverlayFader gameModeRef={gameModeRef} />` inside `<MapContainer>`, right after `<MapController>`. Confirm `useMap` and `Pane` are already imported from `react-leaflet` and `useEffect` from `react` — no import changes needed.

```jsx
        <MapController center={[20, 0]} zoom={2} />
        <OverlayFader gameModeRef={gameModeRef} />
        {gameMode?.targetId && <GameFocuser targetId={gameMode.targetId} geoJsonRef={geoJsonRef} />}
```

- [ ] **Step 6: Run tests to confirm all pass**

```bash
npx vitest run src/components/__tests__/WorldMap.test.jsx
```

Expected: PASS — at least 7 tests (1 original toggle + 1 maxZoom from Chunk 1 + 3 computeZoomFactor + 2 OverlayFader wiring). The exact count may be higher if the baseline already had more tests — what matters is that all pass with 0 failures.

- [ ] **Step 7: Run full suite**

```bash
npm test -- --run
```

Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/WorldMap.jsx src/components/__tests__/WorldMap.test.jsx
git commit -m "feat: fade country overlay at high zoom levels"
```

---

## Final verification

- [ ] Start the dev server and manually verify:
  - Streets tile layer appears in the layer picker and renders correctly
  - Zoom goes past 8 on all tile layers
  - Country borders look sharper at zoom 6–9 than before
  - Country overlay visibly fades when zooming past zoom 6
  - Overlay is fully gone by zoom 10
  - Game mode (Map Quiz) shows full-opacity country fills regardless of zoom

```bash
npm run dev
```
