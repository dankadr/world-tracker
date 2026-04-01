# ToDo: Fix Map Tile Provider Reliability

**Date:** 2026-04-01
**Status:** Open
**Priority:** Medium
**Scope:** Replace CartoDB public tile CDN with a reliable provider for the Labels, Clean, and Streets map layers

---

## Overview

The Labels, Clean, and Streets map layers all use CartoDB's free public tile CDN (`{s}.basemaps.cartocdn.com`). This CDN is unauthenticated and uncontrolled — CartoDB can rate-limit, deprioritise, or decommission it without notice. On mobile, rapid tile requests during pinch-to-zoom already hit these limits and the tiles fail to load. Terrain and Satellite are unaffected because they use different providers (OpenTopoMap, ArcGIS).

## Current State

Tile URLs are defined in `src/config/mapLayers.json`:

| Layer | URL | Status |
|-------|-----|--------|
| Clean | `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png` | ⚠️ Unreliable |
| Labels | `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png` | ⚠️ Unreliable |
| Streets | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` | ⚠️ Unreliable |
| Terrain | `https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png` | ✅ Fine |
| Satellite | `https://server.arcgisonline.com/.../tile/{z}/{y}/{x}` | ✅ Fine |

Only `src/config/mapLayers.json` needs to change. No component logic needs modification.

## Recommended Fix: Stadia Maps

Stadia Maps is the most common CartoDB replacement. It provides the same Stamen-derived styles (Toner Lite ≈ CartoDB Light) and the Alidade Smooth style mirrors CartoDB's clean aesthetic closely. The free tier allows up to 200,000 tile requests/month per domain with no credit card required.

Sign up at https://stadiamaps.com → create an API key → restrict it to the production domain.

### Style mapping

| Current (CartoDB) | Replacement (Stadia) | Notes |
|---|---|---|
| `light_nolabels` → Clean | `alidade_smooth` | Same minimal look, no labels |
| `light_all` → Labels | `alidade_smooth` (default, has labels) | Closest match |
| `rastertiles/voyager` → Streets | `stamen_toner_lite` or `osm_bright` | Street-detail styles |

### New tile URL format (Stadia)

```
https://tiles.stadiamaps.com/tiles/{style}/{z}/{x}/{y}{r}.png?api_key={stadiaKey}
```

The `{stadiaKey}` placeholder is already handled by the existing `resolveUrl()` utility removed in PR #141 (was in `WorldMap.jsx`). It would need to be re-added, or the key can be baked into the URL via a Vite env var at build time.

## Implementation Steps

### 1. Get a Stadia API key
- Sign up at https://stadiamaps.com (free tier is sufficient to start)
- Create a key and lock it to `right-world-tracker.vercel.app` (production) and `localhost` (dev)

### 2. Add env var
```
# .env.local (and Vercel dashboard → Environment Variables)
VITE_STADIA_API_KEY=your_key_here
```

### 3. Update `src/config/mapLayers.json`
Replace CartoDB URLs with Stadia URLs. The `{r}` retina placeholder works the same way.

```json
{
  "id": "clean",
  "label": "Clean",
  "light": "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={stadiaKey}",
  "dark": "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key={stadiaKey}"
},
{
  "id": "labels",
  "label": "Labels",
  "light": "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key={stadiaKey}",
  "dark": "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key={stadiaKey}"
},
{
  "id": "streets",
  "label": "Streets",
  "light": "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key={stadiaKey}",
  "dark": "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key={stadiaKey}"
}
```

Note: `alidade_smooth` has labels baked in, so "Clean" and "Labels" would look identical with this mapping. If a truly label-free variant is needed, use `alidade_smooth` for Labels and check if Stadia has a `alidade_smooth_nolabels` style (they do as of 2024).

### 4. Re-add `resolveUrl()` in `WorldMap.jsx`
PR #141 removed `resolveUrl()` because the Stadia key wasn't in use. It needs to come back to inject the API key at render time:

```js
const STADIA_KEY = import.meta.env.VITE_STADIA_API_KEY ?? '';
function resolveUrl(url) {
  return url?.replace('{stadiaKey}', STADIA_KEY) ?? url;
}
```

Then wrap both `useState` defaults and the `useEffect` dark-mode toggle to pass through `resolveUrl()`.

### 5. Update the CSP (vercel.json) if re-added in future
`tiles.stadiamaps.com` is already listed in the `img-src` of the old CSP (the one removed in PR #141), so this is already accounted for.

### 6. Update attribution
The current attribution in `WorldMap.jsx` only credits OSM. Stadia requires crediting both Stadia and OpenStreetMap contributors. Update the `TileLayer` attribution:

```
&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
```

## Alternative: MapTiler

If Stadia styles don't match the design well, MapTiler is the other strong option:
- Free tier: 100,000 tiles/month
- Has `streets-v2` (≈ CartoDB Voyager), `dataviz` (≈ CartoDB Light)
- Same API key + URL pattern approach
- https://maptiler.com

## Files to Modify

| File | Change |
|------|--------|
| `src/config/mapLayers.json` | Replace CartoDB URLs with Stadia URLs |
| `src/components/WorldMap.jsx` | Re-add `resolveUrl()`, apply to tile URLs |
| `vercel.json` | Add `VITE_STADIA_API_KEY` is a build-time var, no vercel.json change needed |
| Vercel dashboard | Add `VITE_STADIA_API_KEY` env var for production + preview |
| `.env.local` (local dev) | Add `VITE_STADIA_API_KEY` |

## Testing

After implementation:
1. Open the app and switch between Clean, Labels, and Streets — tiles should load
2. On mobile, pinch-to-zoom rapidly — no tile failures
3. Dark mode toggle — tiles should switch to dark variants
4. Verify satellite and terrain layers still work (no regression)
5. Check attribution text is visible on all layers

## Estimated Effort

~2 hours total: 15 min for API key setup, 30 min for code changes, remainder for testing and verifying tile appearance across layers and themes.
