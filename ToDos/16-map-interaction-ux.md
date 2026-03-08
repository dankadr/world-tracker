# ToDo: Map Interaction UX Overhaul

**Date:** 2026-03-06
**Status:** Not Started
**Priority:** High
**Scope:** Simplify how users interact with countries on the world map — remove the "mark or explore" popup, make clicking always toggle visited, and move sub-tracker navigation to the sidebar

---

## Overview

### Current Behavior (Problem)
When a user clicks a country that has a sub-region tracker (US, Switzerland, Canada, etc.), a popup appears asking:
- "Mark visited" / "Mark unvisited"
- "Explore Regions →"

This adds unnecessary friction for the most common action (marking a country). Users who want to dive into a country's regions have to click, read the popup, then click again.

### New Behavior (Goal)
- **Click on any country** (tracked or not) → immediately toggles visited/unvisited. No popup, no extra step.
- **Navigate to a country's sub-tracker** → done from the sidebar "Region Trackers" section, which is already present and shows all available trackers with progress bars.
- The sidebar becomes the clear, intentional entry point for region-level exploration.

---

## Changes Required

### 1. `src/components/WorldMap.jsx`

**Remove the popup branch for tracked countries.**

Currently, the `click` handler has two branches:
```js
click: (e) => {
  if (comparisonModeRef.current) return;
  if (isTracked) {
    // Show popup with "Mark visited" + "Explore Regions" buttons
    L.popup(...).setContent(html).openOn(map);
  } else {
    onToggle(id);  // Direct toggle
  }
}
```

**New behavior** — unified toggle for all countries:
```js
click: (e) => {
  if (comparisonModeRef.current) return;
  onToggle(id);
  // animate the color change (same animation already used for untracked countries)
}
```

- Remove the `L.popup(...)` block and all associated HTML template strings (`world-popup-content`, `world-popup-toggle`, `world-popup-explore`)
- Remove the `world-explore` custom event listener and `handleExplore` function (no longer triggered from the map)
- The `TRACKED_COUNTRY_IDS` object can stay — it's still used for applying a distinct visual style (`TRACKED_STYLE` / `TRACKED_VISITED_STYLE`) to countries that have sub-trackers, which is useful for discoverability
- Remove CSS for `.world-country-popup`, `.world-popup-content`, `.world-popup-actions`, `.world-popup-toggle`, `.world-popup-explore`, `.world-popup-status`

### 2. `src/components/WorldSidebar.jsx`

The "Region Trackers" section already exists and already calls `onExploreCountry(t.id)` when a tracker card is clicked. Make it more prominent so it's clearly the entry point for sub-region navigation:

- Move the "Region Trackers" section **above** the continent breakdown (currently it's below Achievements)
- Add a short helper text: *"Click a tracker to explore regions within that country"*
- Visually highlight tracked countries that the user has partially explored (e.g., "12/16 Bundesländer visited" as a subtitle)

### 3. `src/App.jsx` (or wherever `onExploreCountry` is wired)

- Confirm `onExploreCountry` prop still flows correctly from App → WorldSidebar → tracker navigation
- The `onExploreCountry` prop on `WorldMap` can be removed (or kept as a no-op) since the map no longer triggers it

---

## Visual Behavior After Change

| Scenario | Before | After |
|----------|--------|-------|
| Click untracked country | Toggle visited | Toggle visited (no change) |
| Click tracked country (US, CH, etc.) | Popup with 2 options | Toggle visited immediately |
| Navigate to US States tracker | Click US → popup → "Explore Regions" | Click "United States" card in sidebar |
| Navigate to Swiss cantons | Click CH → popup → "Explore Regions" | Click "Switzerland" card in sidebar |

---

## Discoverability

Since the popup was one way users could discover that a country has sub-regions, we need to maintain that discoverability through other means:

- **Distinct visual style on tracked countries:** Keep `TRACKED_STYLE` (slightly different border/color) so users can see which countries have sub-trackers at a glance
- **Tooltip enhancement:** Update the tooltip that appears on hover to mention sub-regions, e.g.:
  ```
  United States
  [sub-regions available — see sidebar]
  ```
  Or more subtly, show the sub-tracker progress inline:
  ```
  United States  •  32/50 states visited
  ```
- **Sidebar label:** The "Region Trackers" heading in the sidebar should always be visible (not collapsed by default)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/WorldMap.jsx` | Remove popup logic; unify click handler to always call `onToggle(id)`; remove `world-explore` event; remove `onExploreCountry` prop usage |
| `src/components/WorldSidebar.jsx` | Move "Region Trackers" section higher; add helper text; ensure it's always visible |
| `src/App.jsx` | Remove or clean up `onExploreCountry` prop passed to `WorldMap` (keep the one passed to `WorldSidebar`) |
| `src/App.css` (or relevant CSS file) | Remove popup styles (`.world-country-popup`, `.world-popup-*`) |

---

## Testing Checklist
- [ ] Clicking any country (tracked or untracked) immediately toggles visited/unvisited
- [ ] No popup appears on click for any country
- [ ] Color animation plays correctly on toggle for tracked countries
- [ ] Sidebar "Region Trackers" section is visible and prominent
- [ ] Clicking a tracker card in the sidebar navigates to the correct sub-tracker
- [ ] Tooltip on tracked country hover still works and shows region info
- [ ] Comparison mode still blocks clicks correctly
- [ ] Wishlist overlay still renders correctly on the map
- [ ] Friends overlay still works
- [ ] Mobile tap behavior works correctly (no ghost popup)
- [ ] Existing tracker navigation (from sidebar) works for all 10+ trackers

---

## Estimated Effort
- WorldMap.jsx changes: ~1–2 hours
- WorldSidebar.jsx reordering + polish: ~1 hour
- CSS cleanup: ~30 min
- Testing: ~1 hour
- **Total: ~3–4 hours**
