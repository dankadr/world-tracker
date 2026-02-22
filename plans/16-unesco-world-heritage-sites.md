# Plan: UNESCO World Heritage Sites Layer

## Overview
Add a point-based tracker for UNESCO World Heritage Sites as an overlay on the world map. Users can check off sites they've visited, similar to how capitals work in `capitals.json`.

## Data

### Source
- Official UNESCO list: https://whc.unesco.org/en/list/
- ~1,199 sites (as of 2025): 933 cultural, 227 natural, 39 mixed
- Available as open data with lat/lng coordinates

### Data File: `src/data/unesco-sites.json`
```json
[
  {
    "id": 1,
    "name": "Galápagos Islands",
    "country": "Ecuador",
    "countryCode": "EC",
    "lat": -0.8,
    "lng": -91.1,
    "type": "natural",          // "cultural" | "natural" | "mixed"
    "year": 1978,               // year inscribed
    "region": "Latin America and the Caribbean"
  },
  ...
]
```

### Data Preparation Script
- Scrape/download from UNESCO API or use existing open datasets
- Validate coordinates (some sites span large areas — use centroid)
- ~50KB compressed JSON

## Files to Create

### `src/data/unesco-sites.json`
- Full list of UNESCO sites with metadata (see schema above)

### `src/components/UnescoLayer.jsx`
- Leaflet layer rendering UNESCO sites as markers
- Marker style: small circular marker with UNESCO icon or color-coded by type
  - 🟤 Cultural, 🟢 Natural, 🔵 Mixed
- Click marker → popup with site name, country, year, visited toggle
- Visited sites: filled marker, Unvisited: hollow/outlined marker

### `src/components/UnescoPanel.jsx`
- Side panel or modal listing all UNESCO sites
- Filters: by type (cultural/natural/mixed), by region, by country, visited/unvisited
- Search bar to find sites by name
- Stats: "You've visited 45 / 1,199 UNESCO sites (3.8%)"
- Grouped by country or region

### `src/components/UnescoStatsCard.jsx`
- Summary card for StatsModal integration
- Breakdown by type, by continent
- "Rarest site visited" (fewest visitors — if data available)

### `src/hooks/useUnescoVisited.js`
- Manages visited UNESCO sites (separate from region tracking)
- `visitedSites: Set<number>` (site IDs)
- `toggleSite(siteId)`
- Persistence: localStorage (guest) or API (authenticated)
- `TRACKER_ID = 'unesco'`

## Backend Changes

### Database
- Reuse existing `visited` table with `tracker_id = 'unesco'` and `region_id = site ID`
- No schema changes needed! Just a new tracker_id value.

### Validation
- Add `'unesco'` to `VALID_TRACKERS` in `backend/main.py`

## Files to Modify

### `src/components/WorldMap.jsx`
- Add UNESCO layer as an optional overlay
- Toggle via `MapLayerControl`

### `src/config/mapLayers.json`
Add overlay entry:
```json
{
  "id": "unesco",
  "label": "UNESCO Sites",
  "overlay": true,
  "icon": "🏛️"
}
```

### `src/components/MapLayerControl.jsx`
- Handle `unesco` overlay toggle (similar to `friends` toggle)
- Pass `unescoActive` state to parent → renders/hides `UnescoLayer`

### `src/components/StatsModal.jsx`
- Add UNESCO stats section if user has any UNESCO visits

### `src/components/Achievements.jsx`
- Add UNESCO-specific achievements:
  - "Visit your first UNESCO site"
  - "Visit 10 UNESCO sites"
  - "Visit a site on every continent"
  - "Visit all 3 types (cultural, natural, mixed)"
  - "Visit a site inscribed before 1980"

## Performance Considerations
- 1,199 markers on a Leaflet map can be heavy
- Use `Leaflet.markercluster` plugin for clustering at low zoom levels
- Only render markers in current viewport (Leaflet does this natively for most layers)
- Consider loading UNESCO data lazily (dynamic import)

## Marker Design
```css
.unesco-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
}
.unesco-marker.cultural { border-color: #8B4513; background: #DEB887; }
.unesco-marker.natural { border-color: #228B22; background: #90EE90; }
.unesco-marker.mixed { border-color: #4169E1; background: #87CEEB; }
.unesco-marker.visited { opacity: 1; }
.unesco-marker.unvisited { opacity: 0.5; background: transparent; }
```

## Guest Mode
- Visited UNESCO sites stored in localStorage under key `visited_unesco`
- Same migration pattern as other trackers on account creation

## Testing Checklist
- [ ] All 1,199 sites render on map without performance issues
- [ ] Clustering works at low zoom levels
- [ ] Click marker → popup with correct info
- [ ] Toggle visited/unvisited from popup
- [ ] UNESCO panel lists all sites with working filters
- [ ] Search finds sites by name
- [ ] Stats calculate correctly
- [ ] Map overlay toggle works in MapLayerControl
- [ ] Achievements unlock correctly
- [ ] Works in dark mode (marker colors visible)
- [ ] Mobile: markers are tappable, popup is readable
- [ ] Guest + authenticated modes both work

## Estimated Effort
~8-10 hours (data prep + clustering + UI)
