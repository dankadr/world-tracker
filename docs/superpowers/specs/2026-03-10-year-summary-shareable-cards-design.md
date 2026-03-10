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
- Use `React.forwardRef` and attach the forwarded `ref` to the root div — callers pass a standard `ref` prop for html2canvas targeting

**Fixed pixel dimensions:**
- Portrait: 450 × 800px
- Square: 600 × 600px

**Yearly card content:**
- App logo + "Right World" wordmark
- Year + "Year in Review" subtitle
- Gold divider line
- 2×2 grid of stat boxes: Regions, Trackers, Days, Badges (all time) (gold numbers, navy boxes with gold borders)
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
  worldCountries: number,    // from visited-world in localStorage
  totalRegions: number,      // sum of visited regions across all tracker visited-{countryId} keys
  continentsVisited: number, // from continent breakdown of world countries using continents.json
  achievements: number,      // call getAchievements(userId), then .filter(a => a.unlocked).length
}
```

Follows the same localStorage pattern as `yearStats.js` — reads `visited-{countryId}` for each tracker in `countryList`, plus `visited-world` for world countries. Uses `continents.json` for continent mapping. Uses `getAchievements(userId)` from `src/data/achievements.js` for the badge count — identical to the pattern in `yearStats.js` lines 138–141.

**Files:** `src/utils/allTimeStats.js`

---

## Part 4 — Year in Review Share Flow

**Modified:** `YearInReview.jsx`

**Flow:**
1. User reaches the last card (summary)
2. "Share" button appears in the nav bar (replacing the old "Save" button)
3. Clicking "Share" reveals an inline format picker: **Portrait** · **Square** (two small buttons)
4. Selecting a format:
   - Sets `exportFormat` state → React renders the off-screen `<ShareCard ref={cardRef} variant="yearly" format={exportFormat} stats={stats} />`
   - Use a `useEffect` watching `cardRef.current` (or a ref callback) to fire html2canvas only **after** the element is mounted in the DOM — do not call html2canvas synchronously after `setState`, as the DOM update is asynchronous
   - While capturing: disable the format buttons and show a loading indicator ("Saving…" text or spinner)
   - Downloads PNG as `year-in-review-{year}-{format}.png` (e.g. `year-in-review-2025-portrait.png`)
   - Clears `exportFormat` state to unmount the off-screen card

The format picker is a small row of buttons that appears inline below the nav, not a full modal.

---

## Part 5 — Profile Screen Share Button

**Modified:** `ProfileScreen.jsx`

**Placement:** Small "Share my stats" button in the Profile tab, below the XP bar and above any existing stats content.

**Flow:** Same portrait/square picker pattern as Part 4. Call `computeAllTimeStats(userId)` at the `ProfileScreen` level (before the tab split) and pass `allTimeStats` down as a prop to `ProfileTab` — this avoids needing to plumb `userId` into the sub-component. Downloads as `my-travel-stats-{format}.png` (e.g. `my-travel-stats-portrait.png`).

The button is visually subtle — a secondary/ghost style so it doesn't compete with the main profile content.

---

## Architecture Notes

- `ShareCard` is the single source of truth for card visuals — both integration points (Year in Review and Profile) use the same component
- Off-screen rendering approach (absolute positioned, off-viewport) is consistent with how `html2canvas` is already used in `ExportButton.jsx`
- No new dependencies — `html2canvas` is already in the project
- `computeAllTimeStats` is a pure utility (no React), testable in isolation
- The format picker state is local to each parent (`YearInReview`, `ProfileScreen`) — no global state needed
- html2canvas `scale: 2` for retina output (consistent with the existing YearInReview save handler) — portrait output will be 900×1600px, square will be 1200×1200px
- `ShareCard` is purely self-contained (no external images, no cross-origin assets) — `useCORS` and `allowTaint` are not needed
- Both integration points must show a loading/disabled state during capture to handle slow devices
