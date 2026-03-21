# ToDo: Code Quality & Incremental Refactor

**Date:** 2026-03-16
**Status:** In Progress — several quick wins and tests have landed, but the core refactor work is still open
**Priority:** Medium (ongoing)
**Scope:** Fix identified code quality issues: App.jsx god component, duplicate hook files, hardcoded backend config, missing error boundaries, and test coverage gaps

---


## PR Review Snapshot (2026-03-19)

Recent PRs already moved part of this plan forward:

- **PR #76** introduced `ErrorBoundary.jsx` and wrapped the app root with it, partially closing the error-boundary gap.
- **PR #78** expanded runtime wiring for mobile screens, haptics, and component polish, which reduced some UI debt but also confirms `App.jsx` is still the main coordination hub.
- **PR #70** and **PR #77** materially improved frontend regression coverage around `WorldMap`, `GamesPanel`, share URLs, and mini-game flows.
- **PR #92** exposed the long-term weakness of hardcoded backend tracker allowlists by requiring another manual `VALID_COUNTRIES` update.

So this ToDo should now focus on the remaining structural cleanup rather than pretending nothing has shipped.

## Overview

The codebase is in good shape overall but has accumulated several quality issues that will compound as new features are added. This is a collection of small, targeted improvements that don't require a big-bang rewrite — each can be done independently.

## Identified Issues

### 1. `App.jsx` God Component (994 lines)

`App.jsx` manages: routing state, comparison state, friends state, bucket list handlers, XP granting, milestone confetti, easter eggs, share mode, all modal open/close state, keyboard shortcuts, and long-press detection. This makes it hard to read, test, and modify.

**Proposed extractions:**

```
src/
  hooks/
    useComparisonMode.js       — comparisonFriend, comparisonData, handlers
    useShareMode.js            — parseShareHash, shareData, exitShareMode
    useMilestoneConfetti.js    — confetti trigger on pct milestones
    useBucketListActions.js    — handleAddToBucketList, handleDeleteBucketItem, handleMarkVisitedBucketList
  components/
    MapActionButtons.jsx       — the floating 🎮 button cluster
    WorldStatsCard.jsx         — floating stats card (world view)
    RegionStatsCard.jsx        — floating stats card (detail view)
    ShareBanner.jsx            — the "Viewing shared progress" top banner
```

After extraction `App.jsx` should be ~300–400 lines of composition only, no business logic.

**Migration approach:** Extract one hook at a time. Start with `useShareMode` (simplest, no external deps), then `useComparisonMode`, etc. Each extraction is an independent commit.

### 2. Duplicate `useXp` files

Both `src/hooks/useXp.js` and `src/hooks/useXp.jsx` exist. This creates ambiguity about which is the canonical version.

**Fix:** Check both files for differences, merge any unique logic into `useXp.jsx` (the file imported by `App.jsx` via `import useXp, { XpProvider } from './hooks/useXp'`), then delete `useXp.js`.

**Check imports:** `grep -r "useXp" src/` to confirm all imports point to the same file.

### 3. Hardcoded `VALID_COUNTRIES` in backend

`backend/main.py`:
```python
VALID_COUNTRIES = {"ch", "us", "usparks", "nyc", "no", "ca", "capitals", "jp", "au", "unesco"}
```

Every time a new country tracker is added, this set must be manually updated in the backend AND the frontend. If they get out of sync, new trackers return 400 errors.

**Fix:** Source the list of valid tracker IDs from a shared config:
- Add a `TRACKERS` list to `src/data/countries.js` (already imported by frontend)
- Backend reads from `src/config/trackers.json` (committed to repo, imported at startup)
- Or: remove the validation entirely — the `VALID_COUNTRIES` check prevents SSRF/injection but there's no actual dynamic query; just validate the format: `r'^[a-z0-9_-]{1,20}$'`

### 4. Missing error boundaries around map components

`WorldMap` and `SwissMap` (Leaflet) can throw if GeoJSON data is malformed or if Leaflet's internal state gets corrupted (known issue with React strict mode). Currently there's a top-level `ErrorBoundary` but no map-specific one.

**Fix:** Wrap both map components in a `MapErrorBoundary` that shows a "Failed to load map — refresh" fallback instead of a blank screen:

```jsx
// components/MapErrorBoundary.jsx
class MapErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { Sentry.captureException(error, { extra: info }); }
  render() {
    if (this.state.hasError) {
      return <MapErrorFallback onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 5. No lazy loading for heavy route components

`GamesPanel`, `AdminPanel`, `YearInReview`, `AvatarEditor` are all eagerly imported in `App.jsx`. These components include heavy dependencies (html2canvas, Leaflet game logic) that inflate the initial bundle.

**Fix:** Lazy-load tab screens and panel components:
```jsx
const GamesPanel = lazy(() => import('./components/GamesPanel'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const YearInReviewScreen = lazy(() => import('./components/YearInReviewScreen'));

// Wrap in Suspense with skeleton fallback
<Suspense fallback={<ScreenSkeleton />}>
  <GamesPanel ... />
</Suspense>
```

Expected bundle size improvement: ~30–50 KB from initial load.

### 6. Test coverage gaps

Components with no test coverage (based on `src/components/__tests__/` contents):
- `BucketListPanel`
- `ChallengesPanel`
- `Leaderboard`
- `YearInReview`
- `ProfileScreen`
- `SettingsPanel`
- `FriendsPanel`
- `Onboarding`

Hooks with no tests:
- `useFriendsData`
- `useWishlist`
- `useVisitedCountries`
- `useAvatar`

**Target:** 70%+ branch coverage on all hooks and critical components.

### 7. Inconsistent CSS organization

CSS files are colocated with components (good) but naming is inconsistent:
- Some use `iosPrimitives.css` imported by many components (shared but not extracted to a design system file)
- Duplicate CSS variables defined in multiple files
- `App.css` contains global styles mixed with component-specific styles

**Fix (incremental):**
- Extract all CSS custom property declarations to `:root` in `App.css`
- Move `iosPrimitives.css` to `src/styles/ios-primitives.css`
- Create `src/styles/variables.css` as the single source of truth for design tokens

### 8. Backend: No database connection pooling tuning

`backend/database.py` likely uses default SQLAlchemy pool settings. On Vercel (serverless), each invocation creates a new connection. With Neon's connection pooler (PgBouncer) this should be fine but worth verifying.

**Fix:** Add explicit pool configuration:
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=1,           # serverless: minimal pool
    max_overflow=0,
    pool_pre_ping=True,    # detect stale connections
    connect_args={"connect_timeout": 10},
)
```

### 9. `generate_challenge_id` and `generate_friend_code` use `random` module

(Also called out in ToDo #24 — security hardening. Keep it here as a cross-reference.)
Fix in this refactor: replace with `secrets` module. Small fix, big security win.

## Implementation Phases

### Phase 1 — Quick wins (< 1 hour each)
- [ ] Delete `useXp.js` after confirming `useXp.jsx` is canonical
- [ ] Fix `VALID_COUNTRIES` — use regex validation instead of hardcoded set
- [ ] Add `MapErrorBoundary` around WorldMap and SwissMap (app-level `ErrorBoundary` already exists; this is now about map-local recovery)
- [ ] Replace `random` with `secrets` in `models.py`

### Phase 2 — Lazy loading
- [ ] Add `React.lazy` + `Suspense` for GamesPanel, AdminPanel, YearInReviewScreen, AvatarEditor
- [ ] Add `ScreenSkeleton` component for Suspense fallback
- [ ] Verify bundle analyzer output shows improvement

### Phase 3 — App.jsx extraction (one hook per PR)
- [ ] Extract `useShareMode` hook
- [ ] Extract `useComparisonMode` hook
- [ ] Extract `useMilestoneConfetti` hook
- [ ] Extract `useBucketListActions` hook
- [ ] Extract `MapActionButtons`, `WorldStatsCard`, `RegionStatsCard`, `ShareBanner` components

### Phase 4 — CSS organization
- [ ] Move `iosPrimitives.css` to `src/styles/`
- [ ] Extract CSS variables to `src/styles/variables.css`
- [ ] Clean up `App.css` — keep only truly global styles

### Phase 5 — Test coverage
- [ ] Add tests for `useWishlist`, `useVisitedCountries`, `useFriendsData` (coverage improved recently, but these hooks are still thinly tested)
- [ ] Add component tests for `BucketListPanel`, `Leaderboard`, `Onboarding`
- [ ] Set up vitest coverage thresholds in `vitest.config.js`
- [ ] CI step: fail build if coverage drops below threshold

### Phase 6 — Backend tuning
- [ ] Add SQLAlchemy pool configuration for serverless
- [ ] Verify with Neon connection pooler logs

## Notes

- Each phase is independently shippable — don't batch them
- The App.jsx extraction is the most valuable long-term investment but also the most risky — do it in small, well-tested steps
- Lazy loading is high ROI with low risk — do this early
- `useXp.js` vs `useXp.jsx` is a footgun — fix it in the first PR
