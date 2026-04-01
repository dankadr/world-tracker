# ToDo: Performance & Architecture Refactor

**Date:** 2026-02-24
**Status:** Partially complete — Goal 1 App.jsx extraction started (PR #138: useShareMode + useComparisonMode)
**Priority:** High
**Scope:** Refactor frontend and backend for maintainability, performance, and testability

---

## Overview

The app's architecture has grown organically — `src/App.jsx` and `backend/main.py` are still large coordination points, routing is still local-state driven, and code splitting is still minimal. Some testing and infrastructure work has landed, but the core separation of concerns has not. This plan covers the remaining refactor to split concerns, add routing, improve bundle structure, and keep strengthening the test setup.

## Current State

- **Frontend:**
  - `src/App.jsx` is still the main shell and is now 948 lines
  - No routing library yet; navigation is still mostly local state plus `NavigationContext`
  - No meaningful code splitting yet
  - Test suite now exists: Vitest, Playwright, and multiple frontend unit tests
  - Supporting infra now exists: `NavigationContext`, cache helpers, batch queue, offline queue, and several domain hooks
- **Backend:**
  - `backend/main.py` is still the main API entry point and is now 1,804 lines
  - Backend tests now exist under `backend/tests/`
  - Routers/modules have not been split out yet

## Refactor Goals

### 1. Split App.jsx into Domain Modules
- Extract state management into custom hooks/context providers:
  - `useVisitedData.js` — visited regions
  - `useAchievements.js` — achievement progress
  - `useAvatar.js` — avatar config
  - `useFriends.js` — friends list, overlays
  - `useChallenges.js` — challenge state
  - `useBucketList.js` — wishlist/trip planning
  - `useTrips.js` — trip planner
- Each domain module manages its own state, API calls, and localStorage sync
- App.jsx becomes a shell that renders the main layout and routes

### 2. Add Routing Library
- Use React Router (v6+) for view navigation
- Replace current view state with URL-based routing
- Support deep links (e.g., `/tracker/world`, `/achievements`, `/profile`)
- Share mode: `/share/:hash` route
- Mobile navigation: integrate with Approach C tab bar + push navigation

### 3. Code Splitting & Lazy Loading
- Use `React.lazy()` and `Suspense` to load heavy components (maps, modals, panels) only when needed
- Split tracker map components (WorldMap, SwissMap, etc.) into separate bundles
- Lazy load modals (Achievements, Friends, BucketList, Challenges)
- Reduce initial bundle size for faster mobile load

### 4. Test Suite
- Add Vitest for unit tests (hooks, utils, data processing)
- Add Playwright for E2E tests (critical user flows)
- Add pre-commit lint checks (ESLint, Prettier)
- Write tests for all new hooks/context modules
- Add backend tests (pytest)

### 5. Backend Modularization
- Split `backend/main.py` into routers:
  - `auth.py` — authentication
  - `users.py` — user profile, preferences
  - `visited.py` — region tracking
  - `achievements.py` — achievement logic
  - `friends.py` — social features
  - `challenges.py` — challenge endpoints
  - `bucket_list.py` — wishlist/trip planning
  - `trips.py` — trip planner
  - `export.py` — data export/import
- Each router has its own models, endpoints, and tests

### 6. Performance Improvements
- Memoize expensive GeoJSON operations (use `useMemo` in map components)
- Virtualize long lists (e.g., region lists, achievements, friends)
- Debounce overlay updates (friend overlays, challenge progress)
- Optimize map rendering (canvas overlays for friend regions)
- Reduce re-renders by splitting state

## Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/useVisitedData.js` | Visited regions state |
| `src/hooks/useAchievements.js` | Achievement progress |
| `src/hooks/useAvatar.js` | Avatar config |
| `src/hooks/useFriends.js` | Friends state |
| `src/hooks/useChallenges.js` | Challenge state |
| `src/hooks/useBucketList.js` | Wishlist/trip planning |
| `src/hooks/useTrips.js` | Trip planner |
| `src/AppRouter.jsx` | React Router setup |
| `src/components/RouteShell.jsx` | Main layout shell |
| `src/components/VirtualizedList.jsx` | Virtualized list component |
| `src/components/LazyModal.jsx` | Lazy-loaded modal wrapper |
| `backend/auth.py` | Auth endpoints |
| `backend/users.py` | User profile endpoints |
| `backend/visited.py` | Region tracking endpoints |
| `backend/achievements.py` | Achievement endpoints |
| `backend/friends.py` | Social endpoints |
| `backend/challenges.py` | Challenge endpoints |
| `backend/bucket_list.py` | Wishlist/trip planning endpoints |
| `backend/trips.py` | Trip planner endpoints |
| `backend/export.py` | Data export/import endpoints |
| `tests/` (frontend & backend) | Test suites |

## Files to Modify
| File | Change |
|------|--------|
| `src/App.jsx` | Split into shell + domain modules |
| `src/App.css` | Remove unused styles, add utility classes |
| `backend/main.py` | Split into routers |
| `backend/requirements.txt` | Add pytest, FastAPI routers |
| `package.json` | Add Vitest, Playwright, ESLint, Prettier |

## Testing Checklist
- [ ] All domain hooks/context modules have unit tests
- [ ] All routers have backend tests
- [ ] E2E tests cover critical flows (login, mark region, unlock achievement, add friend, create challenge, plan trip)
- [ ] App loads faster (bundle size < 1MB initial)
- [ ] No regression in existing features
- [ ] Mobile navigation works with new router
- [ ] Share mode works with new route
- [ ] Guest mode works with new state modules

## Estimated Effort
- Frontend refactor: ~12-16 hours
- Backend modularization: ~8-12 hours
- Test suite setup: ~6-8 hours
- Performance improvements: ~4-6 hours
- **Total: ~30-42 hours**
