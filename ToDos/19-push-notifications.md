# ToDo: Push Notifications (PWA)

**Date:** 2026-03-15
**Status:** Planned — PWA/service-worker groundwork exists, but there is no push subscription system
**Priority:** Medium
**Scope:** Add Web Push notifications for social events (friend requests, challenge updates, leaderboard changes) and engagement nudges

---

## Overview

The app is a PWA with a service worker (`src/sw.js`) already in place. Web Push is the natural next step — it allows the app to re-engage users even when they're not actively using it. Key use cases: friend requests, challenge completions, and "your friend just visited 5 new countries" nudges.

## Reality Check (2026-03-25)

- The repo already has a service worker, install prompt, and offline indicator
- There are no push subscription tables, no VAPID keys, no push endpoints, and no notification preference UI
- This remains a future feature rather than partially implemented work

## Current State

- `src/sw.js` exists (Workbox-based) — handles offline caching
- No push subscription logic exists
- No notification infrastructure on the backend
- Friends and challenges exist as data models but emit no notifications
- `OfflineIndicator` handles connectivity — no notification UI beyond that

## Goals

1. **Social notifications**: friend request received, friend request accepted, challenge invite received, challenge completed
2. **Engagement nudges**: weekly summary ("You visited X places this week"), "Your friend just unlocked a new achievement"
3. **"On this day"**: push version of the in-app on-this-day card
4. User can opt in/out per notification category in Settings
5. Notifications only sent to users who granted permission (never auto-prompt)
6. Backend sends pushes via Web Push Protocol (no third-party service needed for MVP)

## Non-Goals

- Email notifications (separate ToDo #07)
- Native push on iOS App Store / Android builds (separate ToDos #05, #06)
- Marketing / promotional pushes

## Technical Design

### Backend Push Infrastructure

Dependencies to add to `requirements.txt`:
```
pywebpush>=2.0.0
```

New DB table: `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT NOT NULL,  -- encrypted in DB
  auth_key     TEXT NOT NULL,  -- encrypted in DB
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, endpoint)
);
```

New endpoints:
- `POST /api/push/subscribe` — save push subscription
- `DELETE /api/push/unsubscribe` — remove subscription
- `POST /api/push/send` (internal/admin) — trigger push to a user

VAPID keys generated once: `openssl ecparam -genkey -name prime256v1 -out vapid_private.pem`
Env vars: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_CONTACT` (mailto:)

Push sending helper `backend/push.py`:
```python
from pywebpush import webpush, WebPushException

def send_push(subscription_info: dict, payload: dict) -> bool:
    """Send a push notification. Returns False if subscription is expired."""
    ...
```

### Frontend Push Logic

`utils/pushNotifications.js`:
```js
export async function subscribeToPush(vapidPublicKey) { ... }
export async function unsubscribeFromPush() { ... }
export function isPushSupported() { ... }
export function isPushGranted() { ... }
```

`hooks/usePushNotifications.js`:
- Manages subscription state
- Syncs with backend on mount (re-register if subscription changed)
- Exposes `requestPermission()`, `isSubscribed`, `isSupported`

### Service Worker Push Handler

In `src/sw.js`, add a `push` event listener:
```js
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url },
      tag: data.tag,   // deduplicate same-type notifications
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Notification Categories & Settings

Settings panel new section "Notifications":
```
[ ] Friend requests
[ ] Challenge updates
[ ] Weekly summary (Sundays)
[ ] "On this day" reminders
```

Preferences stored in `push_preferences` JSON column on `users` table (or localStorage for anonymous users).

### Trigger Points

| Event | When | Payload |
|-------|------|---------|
| Friend request received | `POST /api/friends/request` | "X wants to be your travel buddy" |
| Friend request accepted | `PATCH /api/friends/request/{id}` | "X accepted your friend request!" |
| Challenge invite | `POST /api/challenges` | "X invited you to a challenge: {title}" |
| Challenge completed | Challenge completion check | "Challenge complete! You earned 100 XP" |
| Weekly summary | Cron (Sunday 10am user TZ) | "This week: X places visited" |

## Implementation Phases

### Phase 1 — Infrastructure
- [ ] Generate VAPID keys, add to Vercel env vars
- [ ] `push_subscriptions` table migration
- [ ] `backend/push.py` helper
- [ ] Subscribe/unsubscribe endpoints

### Phase 2 — Frontend subscription
- [ ] `utils/pushNotifications.js`
- [ ] `hooks/usePushNotifications.js`
- [ ] Service worker push + notificationclick handlers
- [ ] Settings UI: notification preferences toggles
- [ ] First-time opt-in prompt (shown after second session, not on first visit)

### Phase 3 — Trigger integration
- [ ] Friend request received → push to recipient
- [ ] Friend request accepted → push to requester
- [ ] Challenge invite → push to invitees
- [ ] Weekly summary cron (Vercel Cron or a separate scheduled worker)

### Phase 4 — Polish
- [ ] Notification icons / badge asset
- [ ] Respect `Do Not Disturb` / quiet hours (check user TZ)
- [ ] Handle expired subscriptions gracefully (auto-remove on 410 response)
- [ ] Tests: mock push API, verify payload shape

## Notes

- iOS Safari added Web Push support in iOS 16.4 (requires Add to Home Screen) — worth testing
- Never auto-prompt for push permission — always user-initiated via Settings
- VAPID keys must be rotated carefully — rotating invalidates all existing subscriptions
