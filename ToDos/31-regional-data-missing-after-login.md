# Bug: Regional Tracker Data Missing Until Tracker Is Opened

**Date:** 2026-03-25
**Status:** Needs re-verification — PRs #129 and #134 targeted this issue, but the current repo still does not prove it is fully closed
**Priority:** Critical

---

## Problem
On first login on a new device, the app restores the world map correctly but does not fully hydrate regional trackers from the authenticated account data.

What the user sees:
- Marked countries appear on the world map
- The default tracker (`ch`) can appear correct because it is the active tracker on boot
- Other regional trackers such as `us`, `usparks`, `ca`, `jp`, `au`, or territories stay empty until the user opens that tracker

This matches the current hook behavior:
- `useVisitedCountries()` restores `bulk.world`
- `useVisitedRegions(countryId)` only extracts `bulk.regions[countryId]` for the currently selected tracker
- Only that active tracker is written into per-tracker secure storage

## Reproduction
1. Sign in on device A and mark data in multiple trackers, for example:
   - world countries
   - Swiss cantons
   - US states
   - US national parks
2. Open the app on device B with no existing local tracker cache.
3. Log in.
4. Observe:
   - world map is populated
   - the default regional tracker may be populated
   - other trackers remain empty until opened once

## Expected Behavior
- After login, all tracker data returned by `/api/visited/all` is available immediately.
- Opening `us`, `usparks`, or any other tracker should not be required to hydrate its visited regions, dates, notes, or wishlist.
- Regional progress widgets and tracker switching should work on the first authenticated render.

## Actual Behavior
- `/api/visited/all` is fetched, but only the active tracker is applied to local hook state and persisted locally.
- Non-active trackers are left absent from encrypted local storage.
- When the user later opens a tracker, that tracker finally reads from the already-fetched bulk payload and appears to "load on click".

## Likely Root Cause
The bug is not that the backend omits the data. The problem is that the frontend only fans the bulk response into one tracker at a time.

Relevant code paths:
- `src/utils/api.js`
  - `fetchAllVisited()` returns all tracker data in one payload.
- `src/hooks/useVisitedCountries.js`
  - restores `bulk.world` only.
- `src/hooks/useVisitedCantons.js`
  - reads only `bulk.regions[countryId]`
  - saves only the active `countryId` via `saveLocal/saveDates/saveNotes/saveWishlist`
- `src/context/AuthContext.jsx`
  - warms encrypted storage after login, but that only helps keys that already exist locally
  - on a new device there are no user-scoped tracker keys to warm
- `src/utils/secureStorage.js`
  - `getItemSync()` returns `null` for encrypted user keys until they are present in memory cache

In practice, the first authenticated device render has this gap:
- bulk fetch knows about all trackers
- per-tracker secure storage knows about none of them yet
- only the currently mounted tracker gets persisted and becomes visible

## Fix Plan
- Add a shared hydrator that writes every tracker from `bulk.regions` into user-scoped secure storage after `fetchAllVisited()` succeeds.
- Hydrate all tracker payload fields, not just visited region ids:
  - `regions`
  - `dates`
  - `notes`
  - `wishlist`
- Run that hydrator in the authenticated bulk-fetch path so one successful login fetch populates all trackers.
- Keep the current per-tracker hook update for the active tracker, but make it read from the now-hydrated cache rather than being the only place that persists data.
- Reuse the same hydrator for visibility/focus refetches so tracker caches stay consistent after server-side changes.

## Implementation Notes
1. Extract shared persistence helpers from `useVisitedCantons.js` or add a new utility such as `src/utils/visitedHydration.js`.
2. Add a function like `persistBulkVisitedData(bulk, userId)` that:
   - writes `bulk.world`
   - iterates `countryList`
   - writes empty sets/objects for trackers missing from `bulk.regions`
   - writes visited regions, dates, notes, and wishlist for trackers present
3. Call that function from:
   - `useVisitedCountries()` after `fetchAllVisited()`
   - `useVisitedRegions()` after `fetchAllVisited()`
   or preferably once in a shared auth/bootstrap location to avoid duplicate logic
4. Verify the hydrator does not overwrite anonymous data before account migration has finished.
5. Add regression coverage for first-login-on-new-device behavior.

## Risks
- Writing empty tracker payloads indiscriminately could wipe anonymous local data if done before migration logic finishes.
- Hydrating in multiple hooks could duplicate writes and create ordering bugs.
- Async encrypted writes must update in-memory cache immediately so tracker switches remain synchronous.

## Suggested Tests
- [ ] Login with server data for `ch`, `us`, and `usparks`; verify all three trackers are populated without opening them first.
- [ ] Login on a fresh browser profile and switch directly from world view to `usparks`; verify parks are already present.
- [ ] Confirm dates, notes, and wishlist also appear for non-default trackers.
- [ ] Confirm guest-to-account migration still preserves anonymous local changes.
- [ ] Confirm logout still clears in-memory decrypted cache and does not leak prior user data.

## Related
- Related to bug #29 (XP not loading) — possibly same root cause
- Related to #87 if auth flow changed significantly

## Current Repo Status

- PR #129 re-fetched regional data immediately after login sync via a `visitedchange` listener
- PR #134 loaded regional visited data immediately after login
- The repo has stronger visited-data hooks, cache handling, and auth bootstrapping than when this bug was originally reported
- Keep this as a verification item until login is exercised against multiple regional trackers without a page refresh

## Test Plan
- [ ] Log in and immediately check Swiss cantons data displays
- [ ] Log in and immediately check US states data displays
- [ ] Verify no console errors during login or data load
- [ ] Check network tab for API calls during auth flow
