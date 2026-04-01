# ToDo: Advanced Map Features

**Date:** 2026-03-16
**Status:** Phase 1–4 🔄 In Progress (PR #126) · Map layer improvements ✅ (#80, #110)
**Priority:** Medium
**Scope:** Heatmap overlay, visit-density visualization, custom map markers, and route drawing on the world map

---

## Overview

The world map currently shows visited countries with a flat gold fill. Adding a heatmap mode (intensity based on how deeply you've explored each country), custom markers for meaningful spots, and a route drawing feature turns the map into a visual travel story rather than just a checklist.

## Reality Check (2026-03-25)

- `MapLayerControl.jsx`, `mapLayers.json`, and UNESCO/wishlist/friends toggles already exist
- No exploration-depth logic, custom marker storage, or route-drawing UI exists today
- This plan is still fully open despite the mature baseline map controls

## Current State

- `WorldMap.jsx` — Leaflet-based, GeoJSON country fills, wishlist overlay, UNESCO layer
- `MapLayerControl.jsx` — tile switcher, wishlist/friends/UNESCO toggles
- `UnescoLayer.jsx` — marker cluster layer for UNESCO sites
- `leaflet.markercluster` is already installed (used by UnescoLayer)
- Map layers defined in `src/config/mapLayers.json`

## Goals

1. **Heatmap mode** — color intensity based on % of tracked sub-regions visited per country (e.g. 100% of US states → deepest gold; 50% → medium; 0% → unvisited grey)
2. **Custom pinpoint markers** — user can drop a pin on any lat/lng with a label and icon (for places not covered by a tracker — e.g. a village in rural Nepal)
3. **Route drawing** — draw a polyline between pins/countries to visualize a trip route
4. **"Explore depth" bar** — floating legend showing heatmap scale
5. All new features are toggleable from `MapLayerControl`

## Non-Goals

- 3D globe view (separate large feature)
- Real-time GPS tracking
- Animated flight paths (stretch goal, not MVP)

## Technical Design

### 1. Heatmap Mode

New `MapLayerControl` toggle: "Depth view"

When active, the world GeoJSON fill color becomes a gradient based on exploration depth:

```js
// utils/explorationDepth.js
export function getExplorationDepth(countryId, visitedRegions) {
  // countryId: ISO code (e.g. 'us')
  // visitedRegions: set of visited region IDs for that tracker
  // Returns 0.0 - 1.0
  const tracker = TRACKER_MAP[countryId]; // e.g. 'us' → usa.json features
  if (!tracker) return visitedRegions.has(countryId) ? 1.0 : 0.0;
  const total = tracker.features.filter(f => !f.properties.isBorough).length;
  const visited = [...visitedRegions].filter(r => r.startsWith(countryId + ':')).length;
  return total > 0 ? visited / total : 0;
}

export function depthToColor(depth, darkMode) {
  // 0.0 → grey, 0.01-0.33 → light amber, 0.33-0.66 → mid gold, 0.66-1.0 → deep gold
  if (depth === 0) return darkMode ? '#3a3a3a' : '#cfd8dc';
  const stops = darkMode
    ? ['#5a4a1a', '#8a6a1a', '#c9a84c', '#f0cc60']
    : ['#f5e8c0', '#e8c96a', '#c9a84c', '#b8943a'];
  const idx = Math.min(3, Math.floor(depth * 4));
  return stops[idx];
}
```

`WorldMap.jsx` gets a new `depthMode` prop. When active, `getStyle` uses `depthToColor(getExplorationDepth(...))` instead of the flat visited/unvisited colors.

Legend component: `ExplorationDepthLegend` — small floating card showing the 4 color stops with labels ("Unvisited", "Exploring", "Halfway", "Fully explored").

### 2. Custom Pinpoint Markers

New DB table: `custom_markers`
```sql
CREATE TABLE custom_markers (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  label       VARCHAR(200),   -- encrypted
  icon        VARCHAR(10),    -- emoji (e.g. '📍', '🏕️', '❤️')
  color       VARCHAR(7),     -- hex color
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

Frontend:
- Long-press on empty map area → "Add marker here" context menu (mobile)
- Right-click on desktop → same context menu
- `MarkerEditModal` — set label, choose icon emoji from preset list
- `useCustomMarkers` hook — CRUD against new API endpoints
- Markers rendered as `L.divIcon` elements (custom HTML/CSS icons) on a dedicated Leaflet pane
- Limit: 50 markers per user (generous but prevents abuse)

### 3. Route Drawing

Mode toggle in `MapLayerControl`: "Draw route"

When active:
- Clicking countries/markers connects them with a polyline
- Each segment labeled with distance (great-circle calculation)
- "Clear route" button
- Route stored locally (localStorage) — not persisted to backend for MVP
- Estimated total distance shown in a floating label
- `utils/geo.js` already exists — add `greatCircleDistance(lat1, lng1, lat2, lng2)`

Component: `RouteOverlay` — renders `L.polyline` with animated dash pattern

### 4. Satellite & Terrain Tile Options

Extend `src/config/mapLayers.json` with:
- Satellite (Esri WorldImagery — free for non-commercial)
- Terrain (Stamen Terrain / OpenTopoMap)
- Minimalist (CartoDB Positron — already partially there)

## Implementation Phases

### Phase 1 — Exploration Depth Heatmap (PR #126 open)
- [x] `utils/explorationDepth.js` — depth calculation + color mapping
- [x] Wire `depthMode` prop into `WorldMap.jsx`
- [x] `ExplorationDepthLegend` component
- [x] MapLayerControl toggle
- [ ] Tests for depth calculation

### Phase 2 — Custom Markers (backend) (PR #126 open)
- [x] `custom_markers` table migration
- [x] CRUD endpoints: `GET/POST /api/markers`, `PATCH/DELETE /api/markers/{id}`
- [x] `useCustomMarkers` hook

### Phase 3 — Custom Markers (frontend) (PR #126 open)
- [x] Long-press / right-click context menu on map
- [x] `MarkerEditModal`
- [x] Marker rendering with `L.divIcon`
- [x] Marker delete (tap marker → options)

### Phase 4 — Route Drawing (PR #126 open)
- [x] `greatCircleDistance` in `utils/geo.js`
- [x] `RouteOverlay` component
- [x] Route mode toggle in `MapLayerControl`
- [x] Distance label
- [x] Clear route button

### Phase 5 — New tile layers (PRs #80, #110 open — Streets, zoom 18, FitVisited, Stadia)
- [x] Streets layer + zoom 18 + higher-res GeoJSON + overlay fade (PR #80)
- [x] WorldMap map search, FitVisited button, layer state refactor, Stadia key support (PR #110)
- [ ] Satellite, Terrain tiles
- [ ] Verify attribution requirements

## Notes

- Exploration depth requires knowing the total region count per tracker — this is available from the static JSON data files
- Custom markers are not encrypted in transit (the lat/lng itself is not sensitive) but the label should be encrypted at rest using the existing `enc` helper
- Route drawing is a stateless client feature for MVP — no backend needed; if users ask for saved routes, add persistence later
