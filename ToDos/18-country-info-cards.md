# ToDo: Country Info Cards

**Date:** 2026-03-15
**Status:** Planned — country metadata exists, but there is still no info-card UX
**Priority:** Medium
**Scope:** Show rich contextual information about countries and regions when clicking/tapping them on the map

---

## Overview

When a user clicks a country on the world map or a region on a detail tracker, they get no information about it — just a toggle and a tooltip with the name. Adding contextual info (capital, population, currency, language, fun facts) transforms the app from a pure tracker into an educational/discovery tool, increasing time-on-app and making the bucket list workflow more compelling.

## Reality Check (2026-03-25)

- `src/config/countryMeta.json` exists and can support this direction
- The current world-map interaction is still primarily toggle/tooltip based
- No `CountryInfoPanel`, no `useCountryInfo` hook, and no static `countryInfo.json` dataset are present

## Current State

- World map `onEachFeature` binds a plain tooltip with just the country name
- Clicking a world country toggles visited status immediately (no detail panel opens)
- `WorldSidebar` shows a list of countries but only name + visited toggle
- `ExploreScreen` shows trackers grouped by continent — still no country info
- `countryMeta.json` (`src/config/countryMeta.json`) exists but needs inspection for completeness

## Goals

1. **Country Info Panel** — slides up (mobile) or opens as a side panel (desktop) when tapping a country on the world map
2. Shows: flag emoji, name, capital, continent, area km², population, currency, top language, ISO code
3. **Quick actions** from the panel: Mark Visited, Add to Bucket List, Explore Regions (if tracked)
4. Data sourced from a static local JSON bundle (no external API calls — fast, offline-friendly)
5. **Region Info** — for tracked countries (US states, Swiss cantons, etc.), show region-level info (state capital, population if available)
6. Panel is dismissible via swipe-down (mobile) or click-outside (desktop)

## Non-Goals

- Live/dynamic data (exchange rates, current events) — use static data only
- Wikipedia article embed
- Travel advisories / safety info

## Technical Design

### Data Bundle

`src/data/countryInfo.json` — static JSON ~200 KB (one entry per ISO country code):

```json
{
  "us": {
    "name": "United States",
    "capital": "Washington, D.C.",
    "continent": "North America",
    "population": 331000000,
    "area": 9833520,
    "currency": "USD",
    "currencySymbol": "$",
    "language": "English",
    "flag": "🇺🇸",
    "callingCode": "+1",
    "drivingSide": "right",
    "funFact": "Has the world's largest economy by nominal GDP."
  }
}
```

Generate once from RestCountries API or a public dataset and commit as static JSON. Update quarterly via a `scripts/update-country-info.js` script.

### Frontend Components

**`CountryInfoPanel`** — the main panel component
- Props: `{ countryId, countryName, isVisited, isWishlisted, isTracked }`
- Renders: flag, name, two-column stat grid, quick action buttons
- Mobile: renders inside `MobileBottomSheet` at half-snap
- Desktop: renders as a floating card anchored near the map click point

**`useCountryInfo(countryId)`** hook
- Lazily imports `countryInfo.json` on first access
- Returns `{ info, loading }`
- Memoized — only one import per session

**Integration points:**
1. `WorldMap.jsx` — on country click, instead of immediately toggling, open the `CountryInfoPanel` first. Toggle happens from the panel's "Mark Visited" button OR via double-tap (power user shortcut).
2. `WorldSidebar` country list items — add an info (ℹ) button
3. `ExploreScreen` country cards — tap to open info panel

### Behavior: Tap vs Double-Tap on World Map

Current behavior: single tap toggles visited.
New behavior:
- **Single tap** → open CountryInfoPanel
- **Double tap** → toggle visited directly (preserves power user flow)
- **Long press** (existing) → easter egg prompt (unchanged)

This is a behavioral change that needs a brief onboarding tooltip the first time a user encounters it.

## Implementation Phases

### Phase 1 — Data
- [ ] `scripts/fetch-country-info.js` — fetch from RestCountries API and output `src/data/countryInfo.json`
- [ ] Run the script, commit the JSON
- [ ] `useCountryInfo` hook with lazy import

### Phase 2 — Panel component
- [ ] `CountryInfoPanel` component + CSS
- [ ] Mobile bottom sheet integration
- [ ] Desktop floating card variant
- [ ] Quick action buttons (Mark Visited, Bucket List, Explore Regions)

### Phase 3 — Map integration
- [ ] Update `WorldMap.jsx` click handler: single tap = open panel, double tap = toggle
- [ ] Brief first-time tooltip explaining new behavior
- [ ] Update `WorldSidebar` list items with info button
- [ ] Update `ExploreScreen` cards

### Phase 4 — Region-level info (stretch)
- [ ] `src/data/regionInfo/{countryId}.json` files for tracked countries
- [ ] Show region info in `SwissMap`, `RegionMap` detail views
- [ ] Tests

## Notes

- Single-tap to toggle is the current core UX — the transition to tap-for-info needs careful handling to avoid frustrating existing users. Consider a toggle in Settings: "Tap behavior: Toggle / Info first"
- RestCountries API (restcountries.com) is free, offline-usable as a static snapshot
- ~195 countries × ~200 bytes = ~39 KB of JSON — well within budget
