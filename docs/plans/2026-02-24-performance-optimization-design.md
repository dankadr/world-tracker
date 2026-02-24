# Design: Frontend Read Cache (Performance & Cost Optimization)

**Date:** 2026-02-24
**Status:** Approved
**Driver:** Reduce Neon serverless DB cost by eliminating redundant read queries

---

## Problem

The app makes a full DB read on every page load and on every tab focus/visibility change. The in-memory cache in `api.js` (`_bulkCache`) is lost on page refresh, so each new session hits the DB regardless of how recently data was fetched. Friends, leaderboard, activity feed, wishlist, and challenges have no caching at all.

Write-side debouncing is already well-implemented in `useVisitedCantons` and `useVisitedCountries` (800ms debounce + `beforeunload` keepalive flush) — no changes needed there.

---

## Approach

Add a thin TTL-backed localStorage cache. Check cache before every read fetch. Only hit the network (and therefore the DB) when the cache is expired or missing. Invalidate relevant keys on writes.

---

## Architecture

### `src/utils/cache.js` (new)

A stateless utility module with four functions:

```
get(key, ttlMs)          → cached value | null (if expired or missing)
set(key, value)          → stores { value, ts: Date.now() }
invalidate(key)          → removes one entry
invalidatePrefix(prefix) → removes all entries whose key starts with prefix
```

Keys are scoped by user ID to prevent cross-user data leaks:
- `cache:u<id>:visited-all`
- `cache:u<id>:leaderboard`
- `cache:u<id>:activity`
- `cache:u<id>:friend-visited:<friendId>`
- `cache:u<id>:wishlist:<trackerId>`
- `cache:u<id>:challenges`

### TTLs

| Data | TTL | Rationale |
|---|---|---|
| Visited bulk (regions + world) | 5 min | User actively mapping |
| Leaderboard | 10 min | Changes when friends visit |
| Activity feed | 5 min | Moderate frequency |
| Per-friend visited | 10 min | Low frequency |
| Wishlist | 10 min | Low frequency |
| Challenges | 5 min | Moderate frequency |

---

## Files Modified

### `src/utils/api.js`
- `fetchAllVisited`: check `cache:u<id>:visited-all` before fetch; store on miss
- `invalidateBulkCache`: also remove the localStorage cache entry

### `src/hooks/useFriendsData.js`
- `fetchLeaderboard`: wrapped with `cache:u<id>:leaderboard`
- `fetchActivity`: wrapped with `cache:u<id>:activity`
- `fetchFriendVisited`: wrapped with `cache:u<id>:friend-visited:<friendId>`
- `visibilitychange`/`focus` refetch: only fires when cache is expired

### `src/hooks/useVisitedCantons.js`
- `visibilitychange`/`focus` refetch: only fires when `visited-all` cache is expired

### `src/hooks/useVisitedCountries.js`
- Same as cantons

### `src/hooks/useWishlist.js`
- Fetch wrapped with `cache:u<id>:wishlist:<trackerId>`
- Any write (upsert, update, delete) invalidates the cache key

### `src/hooks/useChallenges.js`
- Fetch wrapped with `cache:u<id>:challenges`
- Join, leave, create, delete each invalidate the cache key

### On logout
- Call `invalidatePrefix('cache:u<id>:')` to wipe all cached data for that user

---

## What Is Not Changing

- Write debouncing (already done in `useVisitedCantons` and `useVisitedCountries`)
- Backend code (zero backend changes)
- Database schema
- Any infrastructure

---

## Expected Impact

- Page refresh: 0 DB reads for all cached data (within TTL window)
- Tab switching: 0 DB reads unless TTL has expired
- Rapid region toggling: already debounced, unchanged
- Friends/leaderboard panels: 0 DB reads on repeated opens within TTL
