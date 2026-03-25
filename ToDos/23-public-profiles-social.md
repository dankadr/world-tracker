# ToDo: Public Profiles & Enhanced Social Sharing

**Date:** 2026-03-16
**Status:** Planned — social foundations exist, but public profiles and feed-backed sharing do not
**Priority:** Medium
**Scope:** Public profile pages, shareable profile links, activity feed between friends, and social proof on the landing/onboarding experience

---

## Overview

Sharing is currently limited to a hash-based URL that encodes raw visited data. There are no persistent public profiles — sharing your friend code is the only social entry point. This plan adds real public profile pages (opt-in), a live activity feed between friends, and a better sharing flow that drives new user acquisition.

## Reality Check (2026-03-25)

- The app already has friend codes, friendships, leaderboard/comparison UI, `ShareCard`, and an `ActivityFeed` component
- `ActivityFeed` is currently driven by existing friend data loading, not a dedicated public feed backend
- There is no public profile route, username model, or opt-in profile visibility system in the repo

## Current State

- Friend system: friend codes, friend requests, friendships — all in DB
- `ShareCard` — PNG export of stats card (requires desktop/app to generate)
- Share hash URL (`#share=...`) — encodes visited data but is long and breaks easily
- `FriendsPanel` + `Leaderboard` — friend comparison exists but no feed
- No public-facing pages (app is a pure SPA, no SSR)
- `SocialScreen` on mobile — friends list + leaderboard

## Goals

1. **Public profile page** — `/{username}` (or `/u/{friendCode}`) shows a read-only profile card with stats, top achievements, and a world map snapshot
2. **Opt-in visibility** — profiles are private by default; user explicitly makes it public
3. **Activity feed** — in the Social tab, see a feed of what friends have been up to ("Alice visited 3 new US states", "Bob unlocked the Explorer badge")
4. **Profile link sharing** — one-tap copy of profile URL in the app
5. **Landing page social proof** — show anonymized aggregate stats on the app's landing/onboarding ("Join X travelers who've visited Y countries")
6. **Embed card** — Open Graph meta tags so profile links unfurl nicely in iMessage/Slack/Twitter

## Technical Design

### Public Profile System

New DB additions:
```sql
ALTER TABLE users ADD COLUMN username VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN bio VARCHAR(200);  -- encrypted
```

Username rules: 3–30 chars, alphanumeric + underscore, case-insensitive stored lowercase.

New endpoints:
- `GET /profile/{username}` — public profile data (only if `is_public = true`)
- `PATCH /api/me/profile` — update username, bio, is_public
- `GET /api/me/profile` — own profile settings

Public profile response (no auth required):
```json
{
  "username": "alice",
  "name": "Alice",         // first name only
  "level": 14,
  "totalCountries": 42,
  "totalRegions": 187,
  "topAchievements": [...],  // top 3 by rarity
  "topTrackers": [...],      // trackers with highest % completion
  "memberSince": "2024-01"
}
```

Note: world country list is NOT exposed in the public profile (privacy — don't reveal travel locations to strangers).

### Activity Feed

New DB table: `activity_feed`
```sql
CREATE TABLE activity_feed (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  event_type  VARCHAR(30) NOT NULL,  -- 'visit_country' | 'unlock_achievement' | 'level_up' | 'challenge_complete'
  payload     JSONB,                  -- encrypted event-specific data
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON activity_feed(user_id, created_at DESC);
```

Feed events are written whenever:
- A user visits a new world country
- A user unlocks an achievement
- A user levels up
- A challenge is completed

New endpoint:
- `GET /api/social/feed?limit=20&before={cursor}` — returns friend activity events, paginated

Frontend:
- `ActivityFeed.jsx` already exists! (found in component list — check its current usage and extend it)
- Add feed as a new tab/section in `SocialScreen`
- Events rendered as timeline items: avatar + event description + time ago
- Pull-to-refresh

### Profile Page (SPA Route)

Since this is a pure SPA, use hash routing for public profiles: `/#/u/{username}`.
Or use Vercel rewrites to serve the same `index.html` for `/u/*` and let client-side routing handle it.

`ProfilePublicView` component — shown when URL matches `/u/{username}`:
- Fetches `GET /profile/{username}`
- Shows: name, level badge, stat highlights, top achievements
- "Add as friend" button (if logged in)
- "Join World Tracker" CTA (if not logged in)

### Open Graph / Meta Tags

For public profile URLs, generate meta tags server-side using a lightweight Vercel Edge Function:

```
GET /og/profile/{username} → returns HTML with OG tags
```

Or use a dynamic OG image service (e.g. Vercel OG) to generate a preview card image.

### Username Picker

In Settings (Profile tab):
- "Set username" input with availability check (debounced `GET /api/username/available/{name}`)
- "Make profile public" toggle
- Short bio field
- "Copy profile link" button

## Implementation Phases

### Phase 1 — Backend profile infrastructure
- [ ] DB migration: `username`, `is_public`, `bio` on users
- [ ] `PATCH /api/me/profile` and `GET /api/me/profile`
- [ ] `GET /profile/{username}` (public, no auth)
- [ ] Username availability check endpoint

### Phase 2 — Frontend profile settings
- [ ] Username picker + availability check in Settings
- [ ] "Make profile public" toggle
- [ ] "Copy profile link" button
- [ ] Bio field

### Phase 3 — Public profile page
- [ ] `ProfilePublicView` component
- [ ] Hash-based routing: `/#/u/{username}`
- [ ] "Add as friend" flow from public profile
- [ ] OG meta tag edge function for link unfurls

### Phase 4 — Activity feed
- [ ] `activity_feed` table + write triggers (visit, achievement, level-up, challenge)
- [ ] `GET /api/social/feed` endpoint (cursor paginated)
- [ ] Extend/update `ActivityFeed.jsx` with new event types
- [ ] Wire into `SocialScreen` as a new tab: "Feed" | "Friends" | "Leaderboard"
- [ ] Pull-to-refresh

### Phase 5 — Polish
- [ ] Landing page aggregate stats counter
- [ ] OG image generation for profile links
- [ ] Tests: public vs private profile access, feed pagination, username validation

## Notes

- Username setting is optional — users without usernames can still use the app normally
- Activity feed events involving specific location data (which countries/regions visited) should be opt-in controlled by the `is_public` setting — don't expose private travel data in the feed
- Friend activity feed events should be softer: "Alice visited some new places" not "Alice visited Iran" — location privacy matters
