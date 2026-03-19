# ToDo: Collaborative Travel Maps

**Date:** 2026-03-16
**Status:** Planned
**Priority:** Medium (Premium feature)
**Scope:** Shared travel maps for couples, families, and travel groups — a single map where multiple users contribute visited places

---

## Overview

Many users travel with a partner or family and want a single shared map that represents "places WE have been" not just "places I have been." Currently the comparison view shows two maps side-by-side but doesn't let you build a unified shared map together. Collaborative maps are a premium feature that drives both paid conversions and viral sharing.

## Current State

- Comparison view: shows overlay of two users' visited countries (read-only, no shared state)
- Challenges: multi-user but goal-oriented, not a persistent shared map
- Friendships: exist but are 1-to-1, no group concept
- All visit data is private to each user

## Goals

1. Create a **shared map** ("Collab") that aggregates visited places from 2–6 members
2. Any member can mark a place as "we visited this together"
3. Shared map has its own world view + per-tracker views
4. Members can see who added each place (with initials/color indicator)
5. Map is accessible to all members (not just the creator)
6. **Premium feature** — limited to 1 collab map per user on premium plan
7. Sync in real-time (polling, not WebSockets for simplicity)

## Technical Design

### DB Schema

```sql
CREATE TABLE collab_maps (
  id          VARCHAR(12) PRIMARY KEY DEFAULT generate_collab_id(),
  name        VARCHAR(100) NOT NULL,   -- encrypted
  creator_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE collab_map_members (
  id          SERIAL PRIMARY KEY,
  collab_id   VARCHAR(12) REFERENCES collab_maps(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  color       VARCHAR(7) NOT NULL,  -- assigned color for this member
  joined_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collab_id, user_id)
);

CREATE TABLE collab_visits (
  id          SERIAL PRIMARY KEY,
  collab_id   VARCHAR(12) REFERENCES collab_maps(id) ON DELETE CASCADE,
  added_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tracker_id  VARCHAR(20) NOT NULL,  -- 'world', 'us', 'ch', etc.
  region_id   VARCHAR(50) NOT NULL,  -- country code or region id
  visit_date  VARCHAR(10),           -- encrypted YYYY-MM-DD
  note        VARCHAR(500),          -- encrypted
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collab_id, tracker_id, region_id)
);

CREATE INDEX ON collab_visits(collab_id, tracker_id);
```

### Backend Endpoints

- `POST /api/collab` — create a new collab map (premium required)
- `GET /api/collab` — list user's collab maps
- `GET /api/collab/{id}` — get collab map details + member list
- `POST /api/collab/{id}/invite` — invite a friend by friend_code
- `POST /api/collab/{id}/join/{invite_token}` — accept invite
- `DELETE /api/collab/{id}/members/{userId}` — leave or remove a member
- `GET /api/collab/{id}/visits/{tracker_id}` — get visits for a tracker
- `POST /api/collab/{id}/visits` — add a visit (any member)
- `DELETE /api/collab/{id}/visits/{visitId}` — remove a visit (creator or adder only)

Invite mechanism: generate a one-time token (`secrets.token_urlsafe(16)`), store in DB with 7-day expiry, share as a link: `/?collab-invite={token}`

### Frontend

**`CollabScreen`** — new screen accessible from the Social tab (mobile) or sidebar (desktop):
- List of collab maps the user is a member of
- "Create new collab map" button (premium-gated)
- Each card shows: map name, member avatars, last activity, visit count

**`CollabMapView`** — the actual shared map experience:
- Same world map + tracker views but data comes from `collab_visits`
- Each visited place shows a small color dot indicating who added it
- "Add this place" button on map click → opens dialog to log a shared visit
- Member list sidebar showing each person's color + contribution count
- Invite button → generates invite link to copy/share

**`useCollabMap(collabId)`** hook:
- Polls `GET /api/collab/{id}/visits/{tracker_id}` every 30 seconds for fresh data
- Optimistic updates on add/remove
- Merges with own personal data if user wants to see "personal + shared" overlay

### Member Colors

Assign a unique color from a fixed palette to each member at join time:
```js
const MEMBER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
```

Color is stored in `collab_map_members.color` and used consistently across the map.

### Conflict Resolution

When two members both want to mark a region: last write wins. The `UNIQUE` constraint on `(collab_id, tracker_id, region_id)` ensures no duplicates — `INSERT ... ON CONFLICT DO UPDATE SET added_by = ...`.

### Real-time Sync

30-second polling with `useInterval`. Show a subtle "syncing..." indicator when a poll is in flight.
For MVP, this is sufficient. Real-time WebSockets can be added if demand justifies it.

## Implementation Phases

### Phase 1 — Backend schema + CRUD
- [ ] DB migration for 3 new tables
- [ ] CRUD endpoints for collab maps and members
- [ ] Visit endpoints (add/remove/list)
- [ ] Invite token generation + validation

### Phase 2 — Frontend core
- [ ] `useCollabMap` hook with polling
- [ ] `CollabScreen` — list + create
- [ ] `CollabMapView` — world map with collab visit overlay
- [ ] Member color system
- [ ] Invite flow (generate link, handle `/?collab-invite=` URL)

### Phase 3 — Tracker views
- [ ] Extend collab map to support per-tracker views (US, Switzerland, etc.)
- [ ] "Add visit" dialog from any tracker map click
- [ ] Who-added indicators on region list items

### Phase 4 — Polish
- [ ] Premium gate on "Create collab map"
- [ ] Push notification when a member adds a new place (ToDo #19 prerequisite)
- [ ] Collab map share card (PNG export of shared map)
- [ ] Leave/delete collab map flow
- [ ] Tests: invite flow, conflict resolution, member permissions

## Notes

- Collab maps are separate from personal tracking — joining a collab doesn't affect your personal visited counts or XP
- Consider "read-only member" role for family members who didn't contribute (e.g., kids on a family trip)
- The polling approach (30s) is simple but means changes have a delay — show "last updated {time ago}" to set expectations
- Start with world map support only, add tracker support later
