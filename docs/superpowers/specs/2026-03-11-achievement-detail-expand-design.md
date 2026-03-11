# Achievement Detail — Expand In Place Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Feature:** Tap an achievement badge → it expands inline to show progress detail and region lists

---

## Overview

Tapping an achievement badge expands it in place (no modal, no navigation). The expanded state shows a large progress bar, and — where the achievement is tied to specific regions — two chip sections: **Visited** and **Still needed**. Only one badge can be expanded at a time.

---

## Interaction Model

- **Tap badge** → expands to full-width within the 2-column grid (grid-column: 1 / -1)
- **Tap expanded badge (or ✕ button)** → collapses back to normal size
- **Tap a different badge while one is expanded** → first collapses, second expands
- **One expanded at a time** — `expandedId` state string in `AchievementsTab`, null when none

---

## Expanded Badge Layout

```
┌─────────────────────────────────────────────┐
│ 🇨🇭  Swiss Complete                      ✕  │  ← header + 44×44px close
│      Visit all 26 Swiss cantons              │
│      [In progress]                           │  ← status pill
│                                             │
│  ██████████░░░░░░  16 / 26 cantons · 10 to go │  ← progress bar
│                                             │
│  VISITED  16                                │  ← section label + count badge
│  [Zürich] [Bern] [Geneva] [Basel-Stadt]     │  ← green chips
│  [Vaud] [Valais] [Ticino] [+8 more]        │
│                                             │
│  STILL NEEDED  10                           │  ← section label + count badge
│  [Appenzell IR] [Glarus] [Uri] [Obwalden]  │  ← muted chips
│  [Nidwalden] [Schaffhausen] [+4 more]      │
└─────────────────────────────────────────────┘
```

For **aggregate achievements** (no named region list):
```
┌─────────────────────────────────────────────┐
│ 🧭  Explorer                             ✕  │
│     Visit 25 regions total                  │
│     [In progress]                           │
│                                             │
│  ██████████████░░  18 / 25 regions · 7 to go│
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Any region in any tracker counts.  │   │  ← hint box
│  │  Keep exploring to unlock.          │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Region List Logic — `getDetailItems(rule, userId)`

New utility function (in `achievementProgress.js` or a new `achievementDetail.js`) that returns:

```ts
{
  isListable: boolean,
  visited: string[],    // region names, alphabetically sorted
  remaining: string[],  // region names, alphabetically sorted
}
```

### Rule types and their list sources

| Rule type | List source | Region name from |
|-----------|-------------|-----------------|
| `countryVisited` / `countryComplete` | `countryList.find(c => c.id === rule.country).data.features` filtered by `!isBorough` | `feature.properties.name` |
| `subregionVisited` | Same features but only those whose `properties.id` is in `rule.regionIds` | `feature.properties.name` |
| `worldVisited` / `worldPercent` | `worldData.features` | `feature.properties.name` |
| `worldContinentComplete` | `Object.entries(continentMap)` filtered by `value === rule.continent` to get country codes; names resolved via `worldData.features.find(f => f.properties.id === code)?.properties.name` — mirrors `getWorldContinentCounts()` in `achievementProgress.js` | `feature.properties.name` |
| `worldTagVisited` | `Object.entries(countryMeta)` filtered by `.tags.includes(rule.tag)`, matched to worldData for names | `feature.properties.name` |
| `continentsVisited` | Hardcoded: `['Africa','Asia','Europe','North America','South America','Oceania']` | Direct string |
| `capitalsVisited` / `capitalsComplete` | `countryList.find(c => c.id === 'capitals').data.features` | `feature.properties.name` |
| `allCapitalsVisited` | Same, filtered to `rule.capitalIds` | `feature.properties.name` |
| `countriesComplete` | `countryList` (each tracker) — visited if `getVisited(c.id) >= getTotalRegions(c.id)` | `c.name` from `countriesConfig` |
| `allCountriesHaveVisits` | `countryList` — visited if `getVisited(c.id) > 0` | `c.name` from `countriesConfig` |

### Non-listable rule types (show hint box instead)

`totalVisited`, `totalPercent`, `achievementsUnlocked`, `categoryComplete`, `worldAreaVisited`, `worldPopulationVisited`, `hemisphereVisited`, `gameCompleted`, `easterEggToggled`, `specificCapitalVisited`

---

## Chip Overflow — "+N more" Pattern

Chips wrap naturally. After the full list is passed to the component, a `MAX_CHIPS = 8` constant caps visible chips per section. If `items.length > MAX_CHIPS`, render the first 8 then a `+N more` chip styled with a dashed border.

**No scroll inside the expanded card** — the page itself scrolls. This avoids nested scroll conflicts on mobile (`overscroll-behavior: contain` on the page handles pull-to-refresh).

---

## Mobile UX Requirements

| Requirement | Implementation |
|-------------|----------------|
| 44×44px min touch target | Badge min-height: 56px; close button 44×44px absolute |
| Remove 300ms tap delay | `touch-action: manipulation` on `.achievement-badge` |
| No tap highlight flash | `-webkit-tap-highlight-color: transparent` |
| 12px+ chip text | `.achievement-chip { font-size: 12px; min-height: 28px }` |
| Status pill legibility | 11px font, 3px/9px padding, clearly coloured border |
| No nested scroll | Chips wrap, no overflow-y scroll on chip containers |

---

## Status Pills

| Condition | Label | Style |
|-----------|-------|-------|
| `unlocked` | ✓ Unlocked | Green bg, green text |
| `current > 0` | In progress | Gold bg, gold text |
| `current === 0` | Locked | Muted bg, muted text |

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/utils/achievementDetail.js` | New — `getDetailItems(rule, userId)` utility |
| `src/components/AchievementCard.jsx` | Add `isExpanded` + `onToggle` props; render expanded section |
| `src/components/AchievementCard.css` | Add expanded state styles, chips, sections, close button |
| `src/components/ProfileScreen.jsx` | `AchievementsTab` gets `expandedId` + `setExpandedId` state; passes to each `AchievementCard` |

---

## Component Interface Changes

### `AchievementCard` props (new)
```jsx
<AchievementCard
  achievement={a}         // existing
  isExpanded={bool}       // new — true when this card is open
  onToggle={() => void}   // new — called on tap; parent manages expandedId
/>
```

### `AchievementsTab` state (new)
```jsx
const [expandedId, setExpandedId] = useState(null);

function handleToggle(id) {
  setExpandedId(prev => prev === id ? null : id);
}
```

---

## Animation

- Expand: no height animation (avoids reflow jank on mobile) — the card simply appears at full width with `animation: fadeIn 0.2s ease-out`
- Chips: `animation: fadeIn 0.15s ease-out` with staggered delay (0.05s per section)
- Close: instant collapse (no animation needed — grid reflow handles it)

---

## Scope Exclusions

- No deep-link or URL routing to a specific badge
- No "share this achievement" from the detail panel (separate feature)
- No map preview inside the detail panel
- The `+N more` chip does **not** expand further — full list truncated at 8 per section
