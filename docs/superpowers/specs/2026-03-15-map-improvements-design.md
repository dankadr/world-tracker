# Map Improvements Design

**Date:** 2026-03-15
**Branch:** fix/bug-tracker-additions
**Status:** Approved

## Overview

Three related improvements to the world map:
1. Add a "Streets" tile layer (CartoDB Voyager)
2. Increase max zoom from 8 to 18
3. Replace low-resolution world GeoJSON with a higher-resolution source
4. Fade the country overlay at high zoom levels so the streets map is usable

## Problem Statement

- Country borders look blocky/jagged when zoomed past ~zoom 5 (low-res GeoJSON)
- Users cannot zoom past zoom 8, making the satellite and terrain layers less useful
- No "streets" tile layer exists — users can't see roads or city-level detail
- At high zoom, the country fill polygon covers the whole viewport, blocking the tile map underneath

## Approach

Approach B (Full improvement) was selected over:
- Approach A (tile + zoom only, skips GeoJSON fix)
- Approach C (progressive lazy-loading, too complex for the gain)

## Design

### 1. New tile layer — CartoDB Voyager

Add to `src/config/mapLayers.json`:

```json
{
  "id": "streets",
  "label": "Streets",
  "light": "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  "dark":  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
}
```

- CartoDB Voyager has no dark variant; same URL used for both themes
- Appears automatically in the existing `MapLayerControl` dropdown — no UI code changes needed
- Tile provider supports up to zoom 19

### 2. Max zoom increase

In `src/components/WorldMap.jsx`, change `maxZoom={8}` → `maxZoom={18}`.

Tile zoom support across all current layers:
- CartoDB (Clean, Labels, Streets): zoom 19
- Esri Satellite: zoom 18
- OpenTopoMap (Terrain): zoom 17

Cap at 18 to remain safe across all layers. Users on Terrain who zoom past 17 will see blurry tiles — acceptable degradation, consistent with how map apps handle this.

### 3. Higher-resolution world GeoJSON

Replace `src/data/world.json` with Natural Earth 1:50m data from the `geo-countries` npm package (MIT license).

- Same `FeatureCollection` structure
- Same `properties.id` (ISO alpha-2 lowercase) and `properties.name` fields
- No code changes required — drop-in swap
- File size: ~3MB vs current ~1.9MB (negligible on modern connections)
- Fields must be verified to match before swapping

### 4. Overlay fade by zoom

Add a new `<OverlayFader>` component inside `WorldMap.jsx`:

```
Zoom ≤ 6  → full overlay (fillOpacity as defined per style)
Zoom 6–10 → linear fade
Zoom ≥ 10 → minimal opacity (fillOpacity ~0.05, border invisible)
```

Implementation:
- Uses `useMapEvents` from react-leaflet to listen to `zoomend`
- Calls `geoJsonRef.current.setStyle(...)` imperatively on each zoom change
- Scales the existing style's `fillOpacity` and `color` opacity by a `zoomFactor`
- Skipped entirely when `gameMode` is active (game mode manages styles independently)

## Files Changed

| File | Change |
|------|--------|
| `src/config/mapLayers.json` | Add Streets entry |
| `src/components/WorldMap.jsx` | maxZoom → 18, add OverlayFader component |
| `src/data/world.json` | Replace with higher-res Natural Earth 1:50m |

## Out of Scope

- No changes to `MapLayerControl.jsx` (Streets layer appears automatically)
- No changes to Swiss map, MapQuiz, or other map-using components
- No dark variant for Streets layer (Voyager is already neutral enough)
- No per-layer zoom caps (all layers share the same maxZoom)

## Testing

- Verify all 5 base tile layers still render correctly
- Verify country click/toggle still works after GeoJSON swap
- Verify `data-country-id` attributes still present on features (used by Playwright tests)
- Verify overlay fades smoothly and doesn't interfere with game mode
- Verify zoom 18 is reachable on Streets and Satellite layers
