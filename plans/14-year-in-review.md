# Plan: Year-in-Review

## Overview
Generate an annual travel summary card for each year, showing stats like countries/regions visited, new trackers explored, and achievements unlocked — similar to Spotify Wrapped or GitHub Skyline.

## UX Design

### Entry Point
- Button in `StatsModal.jsx`: "🎉 Year in Review" (visible if user has data from a completed year)
- Auto-prompt in January for the previous year

### Card Sequence (swipeable or scrollable)
1. **Title Card** — "Your 2025 Travel Year" with animated globe
2. **Countries Card** — "You visited X new countries" + mini world map highlighting them
3. **Regions Card** — "You explored Y new regions across Z trackers"
4. **Top Tracker Card** — "Your most active tracker was [US States] with N new visits"
5. **Achievement Card** — "You unlocked X achievements"
6. **Streak Card** — "Your longest streak was X months" (ties into future streak feature)
7. **Comparison Card** — "You visited X% more than last year" or "You started tracking!"
8. **Share Card** — Summary image + share button

### Visual Style
- Full-screen modal overlay
- Dark gradient background with accent color pops
- Large numbers with animated count-up
- Swipe left/right or arrow buttons to navigate cards

## Files to Create

### `src/components/YearInReview.jsx`
- Main modal component
- Fetches/computes stats for selected year
- Manages card navigation state (current slide index)
- Swipe gesture support (touch events or a lightweight library)

### `src/components/YearInReviewCard.jsx`
- Individual card renderer
- Props: `type`, `data`, `year`
- Switch on `type` to render different card layouts

### `src/utils/yearStats.js`
```js
export function computeYearStats(allVisited, year) {
  // allVisited: { trackerId: [{ regionId, date }] }
  // Filter to entries where date falls in `year`
  // Return:
  return {
    year,
    newCountries: [...],
    newRegions: { total: N, byTracker: { ch: 5, us: 12, ... } },
    topTracker: { id: 'us', name: 'US States', count: 12 },
    achievementsUnlocked: N,
    totalVisitDays: N,         // unique dates with activity
    firstVisitDate: '2025-01-15',
    lastVisitDate: '2025-12-28',
    comparedToPrevYear: '+35%',
  };
}
```

### `src/components/YearInReviewShareCard.jsx`
- Renders a summary as a styled div
- "Capture as image" using `html2canvas` (already may be a dep for share feature)
- Download or share to social

## Files to Modify

### `src/components/StatsModal.jsx`
- Add "Year in Review" button
- Show for each year that has data (dropdown or pill selector)

### `src/hooks/useVisitedCantons.js`
- Ensure `getAllDates()` or equivalent returns dates per visit
- If dates aren't stored per-visit, this feature requires the `date` field in the visited data
- **Prerequisite check**: verify that the `visited` table has a `visited_at` or `date` column

### Backend: `backend/main.py`
- Add endpoint: `GET /api/user/year-review/{year}`
- Computes stats server-side (more efficient than sending all data to client)
- Returns the stats object
- Cache result (year stats are immutable for past years)

## Data Requirements
- **Critical**: Visits must have timestamps. Check if current schema stores `visited_at`.
  - If not → migration needed: `ALTER TABLE visited ADD COLUMN visited_at DATE;`
  - Backfill: set existing rows to `created_at` or today's date
  - Update `PATCH /api/visited` to record date on new visits

## Animations
- Count-up numbers: use `requestAnimationFrame` or `countUp.js`
- Card transitions: CSS transform + opacity
- Mini-map: highlight countries with a "reveal" animation (opacity fade-in per country)

## Testing Checklist
- [ ] Stats compute correctly for a given year
- [ ] Cards render all data types
- [ ] Navigation (swipe + arrows) works smoothly
- [ ] Share card generates a clean image
- [ ] Years with no data show "No travels this year" gracefully
- [ ] Works on mobile (full-screen, touch swipe)
- [ ] Dark mode looks good (it's always dark-themed anyway)
- [ ] Performance is fine with large datasets

## Estimated Effort
~8-10 hours
