# Plan: Japan & Australia Sub-Trackers

## Overview
Add two new country sub-trackers: Japan (47 prefectures) and Australia (8 states/territories).
Follow the exact same pattern as existing trackers (CH, US, Norway, Canada).

## Files to Create

### Japan 🇯🇵
- `src/data/japan-prefectures.json` — GeoJSON with 47 prefectures (Hokkaido, Tokyo, Osaka, etc.)
  - Each feature needs `properties.name` (English) and a unique `id`
  - Source: Natural Earth or japan-geojson open-source datasets
- `src/components/JapanMap.jsx` — Clone of `NorwayMap.jsx` / `CanadaMap.jsx`
  - Import `japan-prefectures.json`
  - Color: use a distinct fill color (e.g., `#dc143c` crimson for Japan's flag theme)
  - `TRACKER_ID = 'japan'`
- `src/pages/JapanPage.jsx` — Wrapper page component
  - Sidebar, map, stats, achievements
- `src/config/japan-achievements.json` — Achievement definitions
  - Examples: "Visit all Kanto prefectures", "Visit Hokkaido", "Visit 25 prefectures"
- `src/data/japan-capitals.json` — Prefecture capitals (lat/lng + name)

### Australia 🇦🇺
- `src/data/australia-states.json` — GeoJSON with 6 states + 2 territories
  - NSW, VIC, QLD, WA, SA, TAS, NT, ACT
- `src/components/AustraliaMap.jsx` — Clone structure
  - Color: e.g., `#f4a020` golden/ochre
  - `TRACKER_ID = 'australia'`
- `src/pages/AustraliaPage.jsx` — Wrapper page
- `src/config/australia-achievements.json`
  - Examples: "Visit all states", "Visit the Outback (NT + WA + SA)"
- `src/data/australia-capitals.json`

## Files to Modify

### `vite.config.js`
- Add two new entries to the multi-page `build.rollupOptions.input`:
  ```
  japan: resolve(__dirname, 'japan/index.html')
  australia: resolve(__dirname, 'australia/index.html')
  ```

### `japan/index.html` & `australia/index.html`
- Create root HTML files (clone from `norway/index.html` pattern)

### `japan/main.jsx` & `australia/main.jsx`
- Entry points that render `JapanPage` / `AustraliaPage`

### `src/components/WorldMap.jsx`
- Add Japan and Australia to the world map's clickable country list
- Add navigation links (same as existing CH, US, etc.)

### `src/config/trackerMeta.js` (or wherever tracker metadata lives)
- Register `japan` and `australia` with display names, flag emojis, region counts

### Backend: `backend/main.py`
- Add `japan` and `australia` to the `VALID_TRACKERS` list (or equivalent)
- No schema changes needed — existing `visited` table structure supports any tracker_id

## Data Sources
- Japan prefectures GeoJSON: https://github.com/dataofjapan/land or Natural Earth admin-1
- Australia states GeoJSON: Natural Earth admin-1 (filter for AU)
- Simplify geometries to <500KB each using mapshaper.org

## Testing Checklist
- [ ] GeoJSON renders correctly on the map (no gaps, correct boundaries)
- [ ] Click to visit / unvisit works
- [ ] Guest mode (localStorage) works
- [ ] Authenticated mode (API) works
- [ ] Achievements unlock correctly
- [ ] Stats modal shows correct counts
- [ ] Share button generates valid link
- [ ] Friends overlay works on new maps
- [ ] World map links to new sub-trackers
- [ ] Dark mode colors look good

## Estimated Effort
~4-6 hours (mostly GeoJSON prep + testing)
