# ToDo: Bucket List Feature Improvements

**Date:** 2026-02-24
**Status:** Partially complete — bucket list CRUD shipped, but the planning/collaboration upgrades are still open
**Priority:** Medium
**Scope:** Enhance the bucket list from a simple wishlist to a full trip planning & inspiration tool

---

## Overview

The current bucket list feature was implemented per `plans/15-bucket-list-planner.md` and provides basic CRUD with priorities, target dates, notes, and categories. This plan takes it to the next level with trip grouping, collaborative lists, cost estimates, auto-suggestions, photo attachments, and richer map visualization.

## Reality Check (2026-03-25)

- `BucketListPanel.jsx`, `BucketListItem.jsx`, `AddToBucketListModal.jsx`, and `useWishlist.js` are live
- Bucket list items already support notes, dates, categories, priorities, and map overlay integration
- Trip grouping, budgets, collaboration, suggestions, routes, and photo attachments are still unbuilt

## Current State

- **Panel:** `src/components/BucketListPanel.jsx` (227 lines) — tabs: Upcoming, High Priority, All
- **Item:** `src/components/BucketListItem.jsx` — priority, target date, notes, actions
- **Modal:** `src/components/AddToBucketListModal.jsx` — add with priority/date/notes/category
- **Hook:** `src/hooks/useWishlist.js` — CRUD operations, localStorage + API sync
- **Data model:** `{ tracker_id, region_id, priority, target_date, notes, category, created_at }`
- **Categories:** solo, friends, family, work
- **Sorting:** by date, priority, tracker, newest
- **Map integration:** Wishlist regions shown with dashed borders on maps

## Planned Enhancements

### 1. Trip Grouping
Group multiple bucket list items into a named trip:
```
Trip: "Summer Europe 2026"
├── Switzerland — Zurich (June 15-18)
├── Switzerland — Geneva (June 18-20)
├── France (June 20-25)
├── Italy (June 25-30)
└── Budget: $3,500 estimated
```

**Data model extension:**
```json
{
  "id": "trip-uuid",
  "name": "Summer Europe 2026",
  "start_date": "2026-06-15",
  "end_date": "2026-06-30",
  "items": ["item-uuid-1", "item-uuid-2", ...],
  "budget": { "estimated": 3500, "currency": "USD" },
  "notes": "Focus on alpine regions",
  "status": "planning",  // planning | confirmed | completed | cancelled
  "shared_with": ["friend-id-1"]  // collaborative trip planning
}
```

### 2. Cost Estimates & Budget Tracking
- Add optional cost estimate per bucket list item
- Currency selector (USD, EUR, CHF, GBP, JPY, etc.)
- Trip total budget = sum of item estimates
- Track actual vs. estimated after visiting
- Simple budget breakdown: flights, accommodation, food, activities

```jsx
// In AddToBucketListModal
<div className="budget-section">
  <label>Estimated Cost</label>
  <div className="budget-input">
    <select value={currency}><option>USD</option><option>EUR</option>...</select>
    <input type="number" placeholder="0" value={estimatedCost} />
  </div>
  <div className="budget-breakdown">
    <input placeholder="Flights" />
    <input placeholder="Hotel" />
    <input placeholder="Activities" />
    <input placeholder="Food" />
  </div>
</div>
```

### 3. Collaborative Bucket Lists
- Share a bucket list / trip plan with friends
- Friends can add items to shared lists
- Real-time sync (or pull-to-refresh sync)
- Permission levels: viewer, editor
- Voting on items: "I want to go here too" (+1)

**API:**
```
POST /api/wishlist/share/{trip_id}          # Share trip with a friend
GET  /api/wishlist/shared                   # Get trips shared with me
PUT  /api/wishlist/shared/{trip_id}/vote     # Vote on an item
```


### 3.5. Friends Travel Intel & Recommendation Prompts
Surface social context on every country/region so users can immediately see:

- Which friends have already visited that country/region
- Which friends currently have it on their bucket list
- Which friends can provide recommendations before a trip

**Core UX ideas:**
- On each country/region detail or bucket list card, show two friend rows: `Visited by friends` and `Want to go`
- When a user adds a country/region to their own bucket list, show a contextual prompt like: `3 friends have already been here — ask them for recommendations`
- Add quick actions: `Message friends`, `Ask for tips`, or `Start a shared trip idea`
- Support both countries and sub-regions (states, provinces, cantons, prefectures, etc.) where tracker data exists

**Example experience:**
```jsx
<FriendTravelInsightCard
  regionName="Japan — Tokyo"
  visitedFriends={[anna, liam, maya]}
  wishlistFriends={[noah, sara]}
  cta={{ label: "Ask 3 friends for recommendations", action: openRecommendationThread }}
/>
```

**Suggested data model additions:**
```json
{
  "friend_travel_insights": {
    "visited_by": ["friend-id-1", "friend-id-2"],
    "want_to_visit": ["friend-id-3"],
    "recommendation_candidates": ["friend-id-1", "friend-id-2"]
  }
}
```

**Potential API support:**
```
GET /api/regions/{tracker_id}/{region_id}/friends-insights
GET /api/wishlist/friends-overlap
POST /api/recommendations/request
```

### 4. Auto-Suggestions
Based on user's travel patterns, suggest new destinations:

- **Nearby unvisited:** "You've visited 24/26 Swiss cantons — only Appenzell and Glarus left!"
- **Friends' favorites:** "3 of your friends have visited Tokyo — add it to your list?"
- **Seasonal:** "Cherry blossom season in Japan is in April — your target date is March, consider adjusting?"
- **Completion-based:** "You're 2 countries away from completing Scandinavia"
- **Achievement-driven:** "Visit Reykjavik to unlock 'Top of the World' achievement"
- **UNESCO driven:** "There are 5 UNESCO sites near your bucket list destinations"

```jsx
// In BucketListPanel — new "Suggestions" tab
<Tab label="Suggestions">
  <SuggestionCard
    type="completion"
    title="Complete Scandinavia"
    description="You've visited 4/5 Nordic countries. Add Finland to complete the set!"
    action={{ label: "Add Finland", onClick: () => addToBucketList('world', 'fi') }}
  />
</Tab>
```

### 5. Photo Attachments & Inspiration
- Attach inspiration photos to bucket list items (before visiting)
- After visiting, attach trip photos
- Photo gallery view in bucket list item detail
- Storage: use Vercel Blob Storage or external service (Cloudinary)

### 6. Rich Map Visualization
Enhance the existing wishlist map overlay:

- **Route view:** Draw a suggested route between bucket list items on the world map (using polylines)
- **Cluster view:** Group nearby bucket list items with marker clusters
- **Heat map:** Show concentration of bucket list items by region
- **Timeline view:** Show bucket list items on a timeline by target date
- **Pin colors by priority:** Red (high), Amber (medium), Green (low)
- **Pin icons by category:** ✈️ (solo), 👥 (friends), 👨‍👩‍👧 (family), 💼 (work)

### 7. Inspiration Feed
- Curated destination highlights (hardcoded or API-based)
- "Did you know?" travel facts for bucket list regions
- Link to relevant blog posts, travel guides (external links)
- Seasonal destination recommendations

### 8. Progress Tracking
- Trip completion percentage (X of Y items visited)
- "Days until trip" countdown on upcoming trips
- Streak: "You've completed 3 bucket list items this month"
- Integration with achievements: "Complete 10 bucket list items" achievement

## New Components

| Component | Purpose |
|-----------|---------|
| `src/components/TripGroup.jsx` | Trip grouping container with items, budget, dates |
| `src/components/BudgetTracker.jsx` | Cost estimate input + breakdown |
| `src/components/BucketListSuggestions.jsx` | Auto-generated suggestions |
| `src/components/BucketListTimeline.jsx` | Timeline view of upcoming items |
| `src/components/BucketListRoute.jsx` | Map polyline route visualization |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/BucketListPanel.jsx` | Add Suggestions tab, trip grouping, enhanced filters |
| `src/components/BucketListItem.jsx` | Add budget display, photo thumbnails, trip assignment |
| `src/components/AddToBucketListModal.jsx` | Add budget fields, trip selector, photo upload |
| `src/hooks/useWishlist.js` | Add trip CRUD, budget operations, suggestion logic |
| `src/components/SwissMap.jsx` | Enhanced wishlist overlay (route, clusters, pin colors) |
| `src/components/WorldMap.jsx` | Enhanced wishlist overlay |
| `backend/main.py` | Add trip endpoints, budget fields, sharing endpoints |
| `backend/models.py` | Add Trip model, budget fields on wishlist |

## Database Schema Extensions

```sql
-- Trip grouping
CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    budget_estimated DECIMAL,
    budget_actual DECIMAL,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    status TEXT DEFAULT 'planning',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Link bucket list items to trips
ALTER TABLE wishlist ADD COLUMN trip_id TEXT REFERENCES trips(id);
ALTER TABLE wishlist ADD COLUMN estimated_cost DECIMAL;
ALTER TABLE wishlist ADD COLUMN actual_cost DECIMAL;
ALTER TABLE wishlist ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE wishlist ADD COLUMN photos JSONB DEFAULT '[]';

-- Shared trips
CREATE TABLE trip_shares (
    trip_id TEXT REFERENCES trips(id),
    shared_with_user_id TEXT REFERENCES users(id),
    permission TEXT DEFAULT 'viewer',  -- 'viewer' | 'editor'
    PRIMARY KEY (trip_id, shared_with_user_id)
);
```

## Testing Checklist
- [ ] Create a trip, add multiple bucket list items to it
- [ ] Budget estimates calculate correctly per trip
- [ ] Share a trip with a friend, friend can view
- [ ] Auto-suggestions appear based on travel history
- [ ] Map route view draws polylines between bucket list items
- [ ] Timeline view shows items sorted by target date
- [ ] Priority pin colors work on map overlay
- [ ] Photo upload and display works
- [ ] Trip completion percentage updates when items are visited
- [ ] Existing bucket list functionality still works (regression)
- [ ] Guest mode handles all new features in localStorage

## Estimated Effort
- Trip grouping: ~5-6 hours
- Budget tracking: ~3-4 hours
- Collaborative lists: ~5-6 hours
- Auto-suggestions: ~4-5 hours
- Map visualization enhancements: ~4-5 hours
- Photo attachments: ~4-5 hours
- **Total: ~25-31 hours**
