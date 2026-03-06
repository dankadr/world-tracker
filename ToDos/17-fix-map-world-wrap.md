# ToDo: Fix World Map Wrap-Around (Duplicate / Non-Interactive Copies)

**Date:** 2026-03-06
**Status:** Not Started
**Priority:** High
**Scope:** Fix the world map so that scrolling east or west past the edge doesn't show non-interactive duplicate copies of the map

---

## Problem

Leaflet's default behavior repeats the tile background infinitely east and west (the world "wraps"). The `TileLayer` displays correctly everywhere, but the `GeoJSON` layer — which carries all the interactivity (click, hover, style) — only exists at its real-world coordinates (longitude –180 to +180). So:

- Scroll west enough → tiles show Russia, but the GeoJSON Russia is not there → clicks do nothing, no hover effect, no color for visited countries
- The duplicate copies look like the real map but are completely dead

### Current `WorldMap.jsx` config (no wrap protection):
```jsx
<MapContainer
  center={[20, 0]}
  zoom={2}
  minZoom={2}
  maxZoom={8}
  // ❌ no worldCopyJump
  // ❌ no maxBounds
>
  <TileLayer url={tileUrl} />  {/* ❌ no noWrap */}
  <GeoJSON ... />               {/* only exists at real coordinates */}
</MapContainer>
```

---

## Root Cause

Leaflet renders `GeoJSON` features at their actual geographic coordinates only. When tiles wrap, the background repeats but the vector/interactive layer does not. There is no built-in Leaflet mechanism to auto-repeat GeoJSON across copies of the world.

---

## Solution

Use Leaflet's **`worldCopyJump`** option combined with **`maxBounds`** to prevent the user from ever panning far enough to reach a non-interactive duplicate.

### Option A — `worldCopyJump` (Recommended)
Add `worldCopyJump={true}` to `MapContainer`. When the map center crosses the antimeridian (±180°), Leaflet silently "jumps" the viewport back by 360° so the real GeoJSON is always in view. The visual appearance is seamless to the user — they never notice the jump.

**Pros:** Simple one-line fix, seamless UX, tiles still look nice at edges
**Cons:** Users can briefly see the duplicate edge before the jump; at low zoom levels the entire world is visible so the duplicate is always partially in view

### Option B — `maxBounds` clamping
Set `maxBounds` to one world width (–180 to +180 longitude, roughly –85 to +85 latitude). The user physically cannot scroll past the edge. Pan is "bouncy" at the boundary.

**Pros:** No duplicate visible at all
**Cons:** Slightly jarring UX at the edges; the bounce can feel restrictive

### Option C — `worldCopyJump` + `maxBounds` (Best)
Combine both:
- `worldCopyJump` handles the case when the user pans fast and crosses the antimeridian
- `maxBounds` with `maxBoundsViscosity={1.0}` creates a hard clamp so the user simply cannot pan to a duplicate
- `noWrap={true}` on the `TileLayer` removes tile repetition entirely — the map background shows grey/empty beyond the world edges

This gives the cleanest result: the world appears exactly once, edges are hard-clamped, and all GeoJSON interactions always work.

---

## Implementation

### `src/components/WorldMap.jsx`

```jsx
// Before:
<MapContainer
  center={[20, 0]}
  zoom={2}
  minZoom={2}
  maxZoom={8}
>
  <TileLayer url={tileUrl} />

// After:
<MapContainer
  center={[20, 0]}
  zoom={2}
  minZoom={2}
  maxZoom={8}
  worldCopyJump={true}
  maxBounds={[[-90, -Infinity], [90, Infinity]]}
  maxBoundsViscosity={0.7}
>
  <TileLayer url={tileUrl} noWrap={false} />
```

**Notes on the config values:**
- `worldCopyJump={true}` — the primary fix; snaps the map back when the center crosses ±180°
- `maxBounds={[[-90, -Infinity], [90, Infinity]]}` — clamps vertical panning (no scrolling above the North Pole or below the South Pole) while leaving horizontal free for `worldCopyJump` to handle
- Setting longitude bounds to `±Infinity` avoids blocking `worldCopyJump` from doing its snap
- `maxBoundsViscosity={0.7}` — soft resistance at the poles (0 = no resistance, 1 = hard stop); 0.7 gives a natural "elastic" feel
- `noWrap={false}` on `TileLayer` — keep tiles wrapping so the edges don't show a blank void; `worldCopyJump` means the user never stays on a duplicate long enough for it to matter

### Vertical-only `maxBounds` alternative
If locking the poles feels too restrictive, the latitude bounds can be widened slightly:
```js
maxBounds={[[-85, -Infinity], [85, Infinity]]}
```
This prevents users from scrolling to see mostly empty ocean above/below the maps.

### All other `TileLayer` instances in `WorldMap.jsx`
The friend labels tile layer should get the same `noWrap` setting:
```jsx
<TileLayer
  key={`friend-labels-${dark ? 'dark' : 'light'}`}
  url={dark ? FRIEND_LABEL_LAYERS.dark : FRIEND_LABEL_LAYERS.light}
  opacity={0.95}
  noWrap={false}  // consistent with base tile layer
/>
```

---

## Does This Affect Other Maps?

The Swiss map (`SwissMap.jsx`) and individual country maps (Japan, USA, etc.) use a much higher zoom and don't have the wrap problem — users can't zoom out far enough to see the duplicate. No changes needed there.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/WorldMap.jsx` | Add `worldCopyJump`, `maxBounds`, `maxBoundsViscosity` to `MapContainer` |

That's it — a 3-line change to a single file.

---

## Testing Checklist
- [ ] Scrolling far west eventually "snaps" back so Russia is always the real, interactive copy
- [ ] Scrolling far east does the same for the Americas
- [ ] Countries near the antimeridian (Russia, Fiji, Kiribati, New Zealand) are still clickable and interactive
- [ ] Hover effects still work at the map edges
- [ ] Vertical panning feels natural — poles have slight resistance, not a hard wall
- [ ] Zoom in/out still works at all levels (minZoom 2, maxZoom 8)
- [ ] Tile layers still render without visible seams at the edges
- [ ] Friends overlay and UNESCO layer still render correctly
- [ ] Works on mobile (touch pan/pinch)

---

## Estimated Effort
~30 minutes (code change + cross-browser testing)
