# Year Summary + Shareable Cards — Design Spec

**Date:** 2026-03-10
**Status:** Approved

---

## Goal

Improve the existing Year in Review UI to match the Navy & Gold theme, and add shareable image cards (portrait 9:16 and square 1:1) for both yearly recaps and all-time stats.

---

## Part 1 — Year in Review Theme Update

**Problem:** The existing YearInReview cards use a generic dark background (`#1a1a2e`) and don't match the new Deep Navy & Gold theme.

**Fix:** Update `YearInReviewCard.jsx` card backgrounds to `#0a1628` (Deep Navy) with gold (`#c9a84c`) accent numbers and dividers. The summary card gets upgraded to match the approved mockup: stat boxes with gold borders, a gold gradient divider line, and a top tracker row.

The "📥 Save" button label changes to "Share" to reflect the new format-picker flow.

**Files:** `YearInReviewCard.jsx`, `YearInReview.css`

---

## Part 2 — ShareCard Component

**Design:** A purely presentational component rendered off-screen (positioned absolute, off-viewport) so `html2canvas` can capture it without affecting the visible UI.

**Props:**
- `variant: "yearly" | "alltime"`
- `format: "portrait" | "square"`
- `stats` — yearly stats object (from `computeYearStats`) or all-time stats object (from `computeAllTimeStats`)
- `cardRef` — forwarded ref for html2canvas targeting

**Fixed pixel dimensions:**
- Portrait: 450 × 800px
- Square: 600 × 600px

**Yearly card content:**
- App logo + "Right World" wordmark
- Year + "Year in Review" subtitle
- Gold divider line
- 2×2 grid of stat boxes: Regions, Trackers, Days, Badges (gold numbers, navy boxes with gold borders)
- Top tracker row (flag + name + count)
- `rightworld.app` footer

**All-time card content:**
- App logo + "Right World" wordmark
- "My Travel Journey" title
- Gold divider line
- 4-row stat list: Countries, Regions, Continents, Badges
- `rightworld.app` footer

**Files:** `src/components/ShareCard.jsx`, `src/components/ShareCard.css`

---

## Part 3 — All-time Stats Utility

**New function:** `computeAllTimeStats(userId)` in `src/utils/allTimeStats.js`

**Returns:**
```js
{
  worldCountries: number,   // from visited-world in localStorage
  totalRegions: number,     // sum across all tracker visited-* keys
  continentsVisited: number, // from continent breakdown of world countries
  achievements: number,     // achievements.filter(a => a.unlocked).length
}
```

Follows the same localStorage pattern as `yearStats.js` — reads `visited-{countryId}` for each tracker in `countryList`, plus `visited-world` for world countries. Uses `continents.json` for continent mapping.

**Files:** `src/utils/allTimeStats.js`

---

## Part 4 — Year in Review Share Flow

**Modified:** `YearInReview.jsx`

**Flow:**
1. User reaches the last card (summary)
2. "Share" button appears in the nav bar (replacing the old "Save" button)
3. Clicking "Share" reveals an inline format picker: **Portrait** · **Square** (two small buttons)
4. Selecting a format:
   - Mounts the off-screen `<ShareCard variant="yearly" format={chosen} stats={stats} />`
   - Runs `html2canvas` on the card ref
   - Downloads PNG as `year-in-review-{year}-{format}.png`
   - Unmounts the off-screen card

The format picker is a small row of buttons that appears inline below the nav, not a full modal.

---

## Part 5 — Profile Screen Share Button

**Modified:** `ProfileScreen.jsx`

**Placement:** Small "Share my stats" button in the Profile tab, below the XP bar and above any existing stats content.

**Flow:** Same portrait/square picker pattern as Part 4. Uses `computeAllTimeStats(userId)`. Downloads as `my-travel-stats.png`.

The button is visually subtle — a secondary/ghost style so it doesn't compete with the main profile content.

---

## Architecture Notes

- `ShareCard` is the single source of truth for card visuals — both integration points (Year in Review and Profile) use the same component
- Off-screen rendering approach (absolute positioned, off-viewport) is consistent with how `html2canvas` is already used in `ExportButton.jsx`
- No new dependencies — `html2canvas` is already in the project
- `computeAllTimeStats` is a pure utility (no React), testable in isolation
- The format picker state is local to each parent (`YearInReview`, `ProfileScreen`) — no global state needed
