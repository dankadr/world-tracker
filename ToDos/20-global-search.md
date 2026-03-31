# ToDo: Global Search

**Date:** 2026-03-15
**Status:** Phases 1–4 🔄 In Progress (PR #141)
**Priority:** Medium
**Scope:** A unified search that spans all trackers, countries, regions, bucket list items, and UNESCO sites

---

## Overview

Currently each tracker (Switzerland, USA, Norway, etc.) has its own local search inside the sidebar. There is no way to search across trackers — if I want to find "where is Zurich?" or "do I have Bavaria in my bucket list?" I have to navigate to the right tracker first. A global search command palette solves this and is a natural power-user feature for a geography app.

## Reality Check (2026-03-25)

- `CitySearch.jsx`, `WorldSidebar.jsx`, `ExploreScreen.jsx`, and `UnescoPanel.jsx` all have local search/filtering
- There is still no unified index, command palette, or cross-tracker keyboard shortcut
- This plan is still valid, but it should start from existing local search patterns rather than from zero

## Current State

- `CitySearch.jsx` — handles in-sidebar search for individual trackers
- Each `Sidebar` has its own `searchRef` passed down from `App.jsx`
- No cross-tracker search exists
- `countryMeta.json` contains country codes/names
- UNESCO sites searchable only within the UNESCO layer when active
- No keyboard shortcut to open a search overlay

## Goals

1. **Cmd/Ctrl+K** (desktop) or a search button in the header (mobile) opens a command palette overlay
2. Search across: world countries, all tracked regions (cantons, states, parks, etc.), bucket list items, UNESCO sites, game high scores
3. Results grouped by category with icons
4. Selecting a result navigates to the relevant tracker and optionally opens the region
5. Fast — entirely client-side, no backend call
6. Fuzzy matching (tolerate typos: "Baveria" → "Bavaria")
7. Recent searches persisted to localStorage

## Technical Design

### Search Index

`utils/searchIndex.js` — builds a flat array of `SearchEntry` objects at startup (lazy, on first open):

```js
// SearchEntry shape
{
  id: 'ch:ZH',
  type: 'region',        // 'country' | 'region' | 'bucket' | 'unesco' | 'tracker'
  trackerId: 'ch',
  regionId: 'ZH',
  label: 'Zurich',
  sublabel: 'Switzerland · Canton',
  flag: '🇨🇭',
  isVisited: false,
  isWishlisted: true,
}
```

Sources merged into the index:
- `src/data/world.json` → world countries
- `src/data/{country}.json` for each tracker → regions
- `src/data/unesco-sites.json` → UNESCO sites
- Active wishlist/bucket list items from `useWishlist`

### Fuzzy Matching

Use `fuse.js` (already a common dep — if not installed, it's ~10 KB):
```js
import Fuse from 'fuse.js';
const fuse = new Fuse(entries, {
  keys: ['label', 'sublabel'],
  threshold: 0.3,
  includeScore: true,
});
```

Or implement a simple trigram-based fuzzy match to avoid a new dependency.

### Component: `GlobalSearch`

```jsx
// Features:
// - Overlay with backdrop blur
// - Input autofocused on open
// - Results list with keyboard navigation (up/down arrows, Enter to select)
// - Groups: "Countries", "Regions", "Bucket List", "UNESCO"
// - Each result has icon, label, sublabel, visited indicator
// - Cmd+K to open, Escape to close
// - "Recently viewed" section when input is empty
```

Hooks:
- `useGlobalSearch(query)` — debounced (150ms), returns grouped results
- `useRecentSearches()` — persists last 8 searches to localStorage

### Navigation on Select

When user selects a result:
1. **World country** → switch to world view, fly map to that country
2. **Region in a tracker** → `setCountryId(trackerId)`, `setView('detail')`, highlight region
3. **UNESCO site** → switch to world view, activate UNESCO layer, center on site
4. **Bucket list item** → open BucketListPanel filtered to that item

### Mobile Integration

- Trigger: search icon in `BottomTabBar` header area or a dedicated search pill in the world map peek content
- Same overlay component — renders full-screen on mobile with `position: fixed`

## Implementation Phases

### Phase 1 — Index + fuzzy search (PR #141 open)
- [x] `utils/searchIndex.js` — build flat index from all data sources
- [x] Fuzzy matching logic (fuse.js or trigram)
- [x] `useGlobalSearch` hook with debounce
- [ ] Unit tests for index building and fuzzy matching

### Phase 2 — UI component (PR #141 open)
- [x] `GlobalSearch` overlay component + CSS
- [x] Result groups with icons
- [x] Keyboard navigation (up/down/enter/escape)
- [x] Recently viewed with `useRecentSearches`

### Phase 3 — Navigation actions (PR #141 open)
- [x] World country → fly-to on map
- [x] Tracker region → navigate + highlight
- [x] UNESCO site → activate layer + center
- [ ] Bucket list → open panel filtered

### Phase 4 — Integration + shortcuts (PR #141 open)
- [x] Cmd/Ctrl+K keyboard shortcut (add to `useKeyboardShortcuts`)
- [ ] Search button in BottomTabBar (mobile)
- [ ] Search icon in desktop header
- [ ] Tests: result navigation, keyboard shortcut

## Notes

- The search index should be lazy — only built when the user first opens the palette
- Memoize the index — rebuild only when visit data changes (listen to `visitedchange` event)
- Fuse.js is 23 KB gzipped — worth it for the UX. Trigram is ~2 KB but more complex to tune
- Consider adding a "Did you mean..." suggestion for zero-result searches
