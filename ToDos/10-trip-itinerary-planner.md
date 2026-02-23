# ToDo: Trip Itinerary Planner

**Date:** 2026-02-24
**Status:** Not Started
**Priority:** Medium
**Scope:** Full multi-stop trip planning with day-by-day itineraries, route visualization, and collaborative planning

---

## Overview

Go beyond the bucket list with a dedicated trip planner. Users can create multi-stop itineraries with day-by-day schedules, visualize routes on the map, track budgets, and share trip plans with friends for collaborative planning. This transforms the app from a "visited tracker" into a complete travel companion.

## Current State

- **Bucket list:** `src/components/BucketListPanel.jsx` — has priorities, dates, notes, categories
- **Trip grouping:** Proposed in `08-bucket-list-improvements.md` — groups bucket list items into named trips
- **No itinerary feature** — no day-by-day planning, no route visualization
- **Maps:** `src/components/WorldMap.jsx` and `src/components/SwissMap.jsx` support polyline overlays via Leaflet

## How It Differs from Bucket List

| Feature | Bucket List | Trip Planner |
|---------|-------------|--------------|
| Purpose | "Someday I want to visit..." | "Here's my plan for June 15-30" |
| Structure | Flat list of items | Day-by-day itinerary with stops |
| Map view | Pins on wishlist regions | Route with connected stops + day markers |
| Budget | Simple estimate per item | Detailed per-category breakdown |
| Collaboration | Share list | Co-edit itinerary with friends |
| Status | want-to-visit → visited | planning → booked → in-progress → completed |
| Integration | One-click "add to trip" | Contains bucket list items + new stops |

## Feature Design

### Trip Overview
```
┌──────────────────────────────────────────────┐
│  🗺️ Summer Europe 2026                      │
│  June 15 — June 30 · 15 days · 4 countries  │
│  Budget: $3,500 estimated                    │
│  Status: Planning                            │
│                                              │
│  [View on Map]  [Share]  [Export PDF]         │
├──────────────────────────────────────────────┤
│  Day 1-3  │  Zurich, CH      │ 🏨 ✈️ 🍽️   │
│  Day 4-5  │  Geneva, CH      │ 🏨 🚂       │
│  Day 6-10 │  Paris, FR       │ 🏨 🎭 🍽️   │
│  Day 11-15│  Rome, IT        │ 🏨 🏛️ 🍕   │
└──────────────────────────────────────────────┘
```

### Day Detail View
```
┌──────────────────────────────────────────────┐
│  📅 Day 1 — June 15 (Monday)                │
│  📍 Zurich, Switzerland                      │
│                                              │
│  Morning:                                    │
│    ✈️ Arrive ZRH 10:30 AM                   │
│    🚕 Airport → Hotel (30 min)              │
│    🏨 Check-in: Hotel Schweizerhof          │
│                                              │
│  Afternoon:                                   │
│    🚶 Walk around Old Town (Altstadt)        │
│    🏛️ Visit Swiss National Museum           │
│                                              │
│  Evening:                                     │
│    🍽️ Dinner at Zeughauskeller             │
│    🌉 Evening walk along Lake Zurich         │
│                                              │
│  Notes: Don't forget Swiss travel pass!      │
│  Budget: $250 (hotel $150, food $60, museum $20, transport $20) │
└──────────────────────────────────────────────┘
```

### Map Route View
On the world map or regional map, show the trip as a connected route:
- Each stop as a numbered marker (1, 2, 3...)
- Polylines connecting stops in order
- Day ranges displayed as labels on markers
- Color coding: visited stops (green), upcoming (amber), current (pulsing)
- Click a stop → shows day detail popup

## Data Model

### Database Schema
```sql
CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'planning',  -- planning | booked | in_progress | completed | cancelled
    cover_image TEXT,                -- URL to cover photo
    visibility TEXT DEFAULT 'private', -- private | friends | public
    budget_total DECIMAL,
    budget_currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_stops (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    tracker_id TEXT,            -- e.g., 'world', 'ch', 'us'
    region_id TEXT,             -- e.g., 'ch', 'us-ca'
    name TEXT NOT NULL,         -- "Zurich" (can be custom or from region data)
    latitude DECIMAL,           -- for custom stops not in a tracker
    longitude DECIMAL,
    day_start INTEGER,          -- day number (1-based)
    day_end INTEGER,            -- day number (can span multiple days)
    order_index INTEGER,        -- ordering within the trip
    notes TEXT,
    accommodation TEXT,         -- hotel name / Airbnb
    accommodation_url TEXT,     -- booking link
    budget_accommodation DECIMAL,
    budget_food DECIMAL,
    budget_activities DECIMAL,
    budget_transport DECIMAL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trip_activities (
    id TEXT PRIMARY KEY,
    stop_id TEXT NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    time_slot TEXT,             -- 'morning' | 'afternoon' | 'evening' | specific time
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,              -- 'flight' | 'transport' | 'food' | 'activity' | 'accommodation' | 'sightseeing'
    url TEXT,                   -- booking link or info link
    cost DECIMAL,
    order_index INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Collaborative trips
CREATE TABLE trip_collaborators (
    trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    role TEXT DEFAULT 'viewer',  -- 'viewer' | 'editor' | 'owner'
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    PRIMARY KEY (trip_id, user_id)
);
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips` | List user's trips (with optional status filter) |
| `POST` | `/api/trips` | Create a new trip |
| `GET` | `/api/trips/{id}` | Get full trip with stops and activities |
| `PUT` | `/api/trips/{id}` | Update trip metadata |
| `DELETE` | `/api/trips/{id}` | Delete a trip |
| `POST` | `/api/trips/{id}/stops` | Add a stop |
| `PUT` | `/api/trips/{id}/stops/{stop_id}` | Update a stop |
| `DELETE` | `/api/trips/{id}/stops/{stop_id}` | Remove a stop |
| `POST` | `/api/trips/{id}/stops/{stop_id}/activities` | Add activity to a stop |
| `PUT` | `/api/trips/{id}/activities/{activity_id}` | Update activity |
| `DELETE` | `/api/trips/{id}/activities/{activity_id}` | Delete activity |
| `POST` | `/api/trips/{id}/invite` | Invite collaborator |
| `PUT` | `/api/trips/{id}/invite/accept` | Accept invite |
| `POST` | `/api/trips/{id}/reorder` | Reorder stops |
| `GET` | `/api/trips/{id}/export` | Export as PDF/JSON |

## Frontend Components

### New Components
| Component | Purpose |
|-----------|---------|
| `src/components/TripPlanner.jsx` | Main trip planner panel (list of trips + create) |
| `src/components/TripDetail.jsx` | Full trip view with stops, timeline, budget |
| `src/components/TripStop.jsx` | Individual stop card with day range, notes, activities |
| `src/components/TripActivity.jsx` | Activity item within a stop |
| `src/components/TripMap.jsx` | Map overlay showing route with numbered markers |
| `src/components/TripTimeline.jsx` | Day-by-day timeline visualization |
| `src/components/TripBudget.jsx` | Budget breakdown and tracking |
| `src/components/AddStopModal.jsx` | Add a new stop (search region or custom location) |
| `src/components/TripExport.jsx` | Export trip as PDF/image |

### Hook
```javascript
// src/hooks/useTrips.js
export function useTrips() {
  return {
    trips,              // list of user's trips
    currentTrip,        // selected trip detail
    createTrip,         // (name, dates, ...) => trip
    updateTrip,         // (id, updates) => trip
    deleteTrip,         // (id) => void
    addStop,            // (tripId, stop) => stop
    updateStop,         // (tripId, stopId, updates) => stop
    removeStop,         // (tripId, stopId) => void
    reorderStops,       // (tripId, stopIds) => void
    addActivity,        // (stopId, activity) => activity
    updateActivity,     // (activityId, updates) => activity
    removeActivity,     // (activityId) => void
    inviteCollaborator, // (tripId, friendId, role) => void
    exportTrip,         // (tripId, format) => blob
    loading,
    error,
  };
}
```

### Map Route Rendering
```jsx
// In TripMap.jsx — uses Leaflet Polyline + numbered markers
import { Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

function TripMap({ trip }) {
  const stops = trip.stops.sort((a, b) => a.order_index - b.order_index);
  const coordinates = stops.map(s => [s.latitude, s.longitude]);

  return (
    <>
      {/* Route line */}
      <Polyline
        positions={coordinates}
        pathOptions={{
          color: '#c07a30',
          weight: 3,
          dashArray: '10, 8',
          opacity: 0.8,
        }}
      />

      {/* Numbered stop markers */}
      {stops.map((stop, i) => (
        <Marker
          key={stop.id}
          position={[stop.latitude, stop.longitude]}
          icon={createNumberedIcon(i + 1, stop.visited ? 'green' : 'amber')}
        >
          <Popup>
            <strong>Stop {i + 1}: {stop.name}</strong>
            <br />
            Day {stop.day_start}{stop.day_end !== stop.day_start ? `-${stop.day_end}` : ''}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
```

## Integration with Existing Features

- **Bucket List:** "Add to trip" button on bucket list items, or "Create trip from bucket list items"
- **Visited Data:** When a trip stop's region is marked as visited, update trip stop status
- **Achievements:** New achievements: "Plan your first trip", "Complete a 5-stop trip", "Plan a trip with 3+ friends"
- **Friends:** Invite friends to co-plan a trip, share trip plans
- **Year in Review:** Include trip data in Year in Review cards ("You planned 3 trips in 2026")
- **Map View:** Toggle trip routes on/off in MapLayerControl

## Guest Mode
- Trips stored in localStorage
- Structure: `{ trips: [{ id, name, stops: [...], activities: [...] }] }`
- Synced to server on login

## Testing Checklist
- [ ] Create a trip with multiple stops
- [ ] Add activities to stops with day/time assignments
- [ ] Reorder stops via drag-and-drop
- [ ] Map shows route with numbered markers and polylines
- [ ] Budget calculates correctly per stop and total
- [ ] Share trip with friend (collaborator)
- [ ] Collaborator can edit (if role = editor)
- [ ] Trip status transitions: planning → booked → in_progress → completed
- [ ] Add bucket list item to an existing trip
- [ ] Export trip (JSON)
- [ ] Guest mode localStorage persistence
- [ ] Mobile layout is usable

## Estimated Effort
- Data model & API: ~6-8 hours
- Trip list & detail UI: ~6-8 hours
- Map route overlay: ~4-5 hours
- Day-by-day timeline: ~4-5 hours
- Budget tracker: ~3-4 hours
- Collaborative editing: ~4-5 hours
- Integration (bucket list, achievements): ~3-4 hours
- **Total: ~30-39 hours**
