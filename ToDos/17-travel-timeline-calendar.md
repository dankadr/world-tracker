# ToDo: Travel Timeline & Calendar View

**Date:** 2026-03-15
**Status:** Planned — there is a lightweight stats timeline today, but not the calendar/timeline feature described here
**Priority:** Medium-High
**Scope:** Chronological timeline and calendar heatmap showing the user's travel history over time

---

## Overview

Users currently log visits with optional dates per region. There is no way to view this data chronologically — no "what did I do in 2024?" view beyond the year-in-review cards. A timeline + calendar heatmap turns raw visit dates into a compelling visual story of someone's travel life.

## Reality Check (2026-03-25)

- `StatsModal.jsx` already shows a basic recent timeline list built from stored visit dates
- `YearInReview` exists and covers yearly storytelling at a higher level
- The dedicated calendar heatmap, merged timeline utilities, and profile-surface integration from this plan have not been built

## Current State

- Dates stored as `{ regionId: "YYYY-MM-DD" }` encrypted JSONB per tracker
- `YearInReview` shows a summary per year (slide show format)
- `computeYearStats` and `computeAllTimeStats` extract aggregate counts
- No chronological/calendar visualization exists
- `StatsScreen` and `StatsModal` show aggregate numbers only

## Goals

1. **Calendar heatmap** (GitHub-style) showing days with visits across all trackers
2. **Timeline feed** — chronological list of visits, filterable by year/tracker/continent
3. **Month view** — see all places visited in a selected month
4. **"On this day"** card — "3 years ago you visited X" (retention driver)
5. Works on both mobile (tab screen) and desktop (modal/panel)
6. No new backend required — all computed from existing date data in local storage + API

## Technical Design

### Data Layer

`utils/timelineData.js` — builds a sorted array of visit events:

```js
// VisitEvent shape
{
  date: '2024-07-15',       // YYYY-MM-DD
  trackerId: 'us',
  regionId: 'CA',
  regionName: 'California',
  trackerName: 'USA States',
  flag: '🇺🇸',
}
```

Data sources (merged):
1. `secureStorage` for each known tracker (`swiss-tracker-u{id}-visited-{trackerId}`)
2. `/api/visited/all` response (already fetched by `useVisitedRegions` hooks)

Events with no date are excluded from the timeline but still counted in totals.

### Calendar Heatmap

Component: `TravelCalendar`

- Grid of weeks × days (52 columns, 7 rows per year)
- Color intensity based on number of visits that day (0→grey, 1→light gold, 3+→dark gold)
- CSS variables for theming — matches existing warm palette
- Clicking a day opens a popover listing the visits for that date
- Year selector (2020–current year)

```jsx
// Intensity calculation
const intensity = count === 0 ? 0 : Math.min(4, Math.ceil(count / 2));
// Maps to CSS class: cal-cell--0 ... cal-cell--4
```

### Timeline Feed

Component: `TimelineFeed`

- Virtualised list (`useVirtualList` hook or CSS `content-visibility: auto`)
- Groups by month (sticky month headers)
- Each item: flag + tracker name + region name + date chip
- Filter bar: year picker, continent filter, tracker filter
- "No dates recorded" empty state with prompt to add dates

### "On This Day" Card

`utils/onThisDay.js` — finds visits on the same month+day in previous years.
Shown as a dismissible card at the top of the Profile screen or as an XP notification variant.

### New Screen Entry Point

- Mobile: new "Timeline" section inside the Profile tab (new segment control option: Profile / Timeline / Badges / Settings)
- Desktop: button in the Stats panel header

## Implementation Phases

### Phase 1 — Data layer
- [ ] `utils/timelineData.js` — merge all tracker visit data into sorted events array
- [ ] Unit tests for edge cases (no dates, duplicate dates, all trackers)

### Phase 2 — Calendar heatmap
- [ ] `TravelCalendar` component + CSS
- [ ] Year selector
- [ ] Day popover with visit list
- [ ] Dark/light theme variants

### Phase 3 — Timeline feed
- [ ] `TimelineFeed` component
- [ ] Filter bar (year, continent, tracker)
- [ ] Virtual/windowed list for performance with large datasets
- [ ] Empty state with call-to-action to add dates to existing visits

### Phase 4 — "On This Day" + integration
- [ ] `utils/onThisDay.js`
- [ ] "On This Day" card in Profile screen
- [ ] Wire everything into Profile tab (new segment option)
- [ ] Desktop stats panel button
- [ ] Tests for onThisDay logic and calendar rendering

## Notes

- This is entirely client-side — no new API endpoints needed for MVP
- Calendar heatmap is a known engagement driver (GitHub proved this pattern works)
- "On this day" creates a daily re-engagement hook without needing push notifications
