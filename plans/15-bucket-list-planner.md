# Plan: Bucket List / Wishlist Planner

## Overview
Expand the existing wishlist system (already in Sidebar + backend `patch_visited_wishlist`) into a dedicated planning view with priorities, target dates, notes, and a visual map layer.

## Current State
- Wishlist toggle exists in `Sidebar.jsx` (regions can be marked as "want to visit")
- Backend has `PATCH /api/visited` that supports a `wishlist` field
- Stored as a simple boolean per region

## Enhanced Wishlist Data Model

```json
{
  "regionId": "JP",
  "priority": "high",         // "high" | "medium" | "low"
  "targetDate": "2026-06",    // optional, month precision
  "notes": "Cherry blossom season",
  "addedAt": "2025-02-23",
  "category": "solo"          // "solo" | "friends" | "family" | "work"
}
```

## Files to Create

### `src/components/BucketListPanel.jsx`
- Dedicated panel/tab (replaces simple wishlist toggle)
- Sections:
  - **Upcoming** — items with target dates, sorted chronologically
  - **High Priority** — no date but marked important
  - **All Wishlist** — full list grouped by tracker
- Each item shows: region name, flag/tracker icon, priority badge, target date, notes preview
- Inline edit: click to change priority, date, notes
- Quick action: "Mark as Visited" → moves to visited + removes from wishlist

### `src/components/BucketListItem.jsx`
- Individual wishlist entry component
- Priority color indicator (🔴 high, 🟡 medium, 🟢 low)
- Target date with "in X months" relative time
- Expandable notes section
- Delete / Edit / Mark Visited buttons

### `src/components/BucketListMap.jsx`
- Optional: a map overlay showing wishlist regions
- Wishlist regions shown with dashed borders or a different color (e.g., yellow)
- Could be integrated into existing maps as a toggle in `MapLayerControl`

### `src/components/AddToBucketListModal.jsx`
- Modal that appears when adding to wishlist (instead of simple toggle)
- Fields: priority selector, target date picker, notes textarea, category
- "Quick Add" — skip modal, add with defaults (medium priority, no date)

### `src/hooks/useWishlist.js`
- `wishlist` — array of enriched wishlist items
- `addToWishlist(regionId, trackerId, opts)` — with priority, date, notes
- `updateWishlistItem(regionId, trackerId, updates)`
- `removeFromWishlist(regionId, trackerId)`
- `markVisited(regionId, trackerId)` — removes from wishlist + adds to visited

## Backend Changes

### Database Schema Update
```sql
-- If wishlist is currently a boolean on visited table:
CREATE TABLE wishlist (
    user_id TEXT NOT NULL,
    tracker_id TEXT NOT NULL,
    region_id TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    target_date TEXT,               -- 'YYYY-MM' format
    notes TEXT,
    category TEXT DEFAULT 'solo',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, tracker_id, region_id)
);
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/wishlist` | Get all wishlist items (all trackers) |
| `GET` | `/api/wishlist/{tracker_id}` | Get wishlist for a tracker |
| `PUT` | `/api/wishlist/{tracker_id}/{region_id}` | Add/update wishlist item |
| `DELETE` | `/api/wishlist/{tracker_id}/{region_id}` | Remove from wishlist |

### Migration
- Migrate existing boolean wishlist entries to new table with default values

## Files to Modify

### `src/components/Sidebar.jsx`
- Replace simple wishlist toggle with link to `BucketListPanel`
- Or embed `BucketListPanel` as a tab in the sidebar

### `src/components/MapLayerControl.jsx`
- Add "Wishlist" overlay toggle (show wishlist regions on map)
- Add entry to `mapLayers.json`:
  ```json
  { "id": "wishlist", "label": "Bucket List", "overlay": true, "icon": "📌" }
  ```

### `src/components/SwissMap.jsx` (and other map components)
- When wishlist overlay is active, render wishlist regions with distinct style
- Dashed border + translucent fill

### `src/utils/api.js`
- Add wishlist CRUD functions

## Smart Suggestions
- "You have 3 bucket list items in Europe — consider a trip!"
- "Cherry blossom season is in April — your Japan trip target is March" (date proximity alerts)
- Integrate with "Nearest Unvisited" (Plan 17 from feature list) to suggest nearby wishlist items

## Guest Mode
- Enriched wishlist stored in localStorage
- Structure: `{ trackerId: { regionId: { priority, targetDate, notes, category } } }`

## Testing Checklist
- [ ] Add item with all fields (priority, date, notes, category)
- [ ] Quick add works (defaults applied)
- [ ] Edit priority/date/notes inline
- [ ] Delete from wishlist
- [ ] "Mark as Visited" moves to visited + removes from wishlist
- [ ] Map overlay shows wishlist regions
- [ ] Sorting works (by date, priority)
- [ ] Migration from old boolean wishlist preserves data
- [ ] Guest mode localStorage works
- [ ] Mobile layout is usable

## Estimated Effort
~8-10 hours
