# ToDo: Bug Fixes & Quality Improvements

**Date:** 2026-03-14
**Status:** In Progress — resolved items removed after repo triage
**Priority:** High (ongoing)
**Scope:** Fix known bugs, improve stability, establish bug tracking process

---

## Overview

Document known issues, establish a bug triage process, and systematically fix existing bugs. The repo now has a real test setup, but coverage is still selective and several regressions are slipping through. This plan covers both immediate fixes and the process for tracking future bugs.

## Reality Check (2026-03-14)

- The repo now has a real test setup: Vitest, Playwright, frontend unit tests, and backend pytest suites
- Geography mini-game feedback work has already landed in `src/hooks/useGeographyGame.js` and `src/components/games/MapQuiz.jsx`
- Root test runs were also carrying false failures: Vitest was discovering `.worktrees/` and stale E2E files until `vitest.config.js` was tightened
- The map quiz had a real regression: `MapQuiz` was not passing `targetId` into `WorldMap`, so the active target country was not actually highlighted for click flow
- The repo now has current smoke coverage for desktop and mobile critical flows in `e2e/smoke.spec.js` and `e2e/mobile.spec.js`
- Current verified status:
  - `npm run test` passes
  - `npx playwright test` passes
- Older `test-results/` artifacts are no longer a reliable source of truth by themselves; some reflect the pre-fix setup
- `src/App.jsx` and `backend/main.py` are still large coordination points, so regression risk remains high
## Known Issues to Investigate
### Critical / High Priority

#### 1. App.jsx State Management Complexity
- **File:** `src/App.jsx` (823 lines)
- **Issue:** All application state lives in a single component — visited data for 10 trackers, modals, views, user preferences, friend overlays, XP/leveling. This creates:
  - Excessive re-renders on any state change
  - Difficult to debug which state update caused a re-render
  - Race conditions possible when multiple state updates happen simultaneously
- **Impact:** Performance degradation, especially on mobile devices
- **Fix approach:** Extract state into domain-specific hooks/contexts (see `12-architecture-refactor.md`)
- **Status:** Open

#### 3. Mobile Bottom Sheet Edge Cases
- **File:** `src/components/MobileBottomSheet.jsx`
- **Issue:** Several edge cases:
  - Rapid swipe up/down can cause the sheet to get stuck between snap points
  - Sheet content scrolling conflicts with sheet dragging (scroll vs. drag ambiguity)
  - Landscape mode on phones breaks the snap point percentages
  - Bottom sheet overlaps the Leaflet map tile credit attribution
- **Impact:** UI broken state on mobile
- **Current repo status:** Partially fixed on this branch. `MobileBottomSheet` now snaps using viewport-pixel heights, handles `touchcancel`, recalculates its current snap on resize/orientation changes, and the mobile Leaflet attribution is shifted above the sheet.
- **Remaining gap:** Body-vs-drag scroll arbitration is still conservative because dragging is limited to the handle area rather than the full sheet body.
- **Fix approach:** Keep drag gestures constrained to the handle area; if future UX wants drag-from-body, add scroll-position aware arbitration first
- **Status:** Partially fixed

#### 4. Challenge Region Names Not Resolving
- **File:** `src/components/ChallengeDetailModal.jsx`
- **Issue:** Challenge target regions sometimes show raw IDs (e.g., "us-ca") instead of friendly names (e.g., "California") if the GeoJSON data hasn't loaded yet
- **Impact:** Poor UX in challenge detail view
- **Fix approach:** Preload region name dictionary, add fallback display for loading state
- **Status:** Open

### Medium Priority

#### 5. Friend Overlay Performance
- **Files:** `src/hooks/useFriendsData.js`, `src/components/SwissMap.jsx`
- **Issue:** When a user has many friends (10+), the map renders overlay polygons for each friend. With large GeoJSON datasets (NYC with 188 neighborhoods × 10 friends = 1,880 polygon renders), this causes visible lag
- **Impact:** Map becomes sluggish with many friends
- **Fix approach:** Limit simultaneous overlays, use canvas rendering instead of SVG for overlays, debounce overlay updates
- **Status:** Open

#### 6. Export Button Captures Incorrect Area
- **File:** `src/components/ExportButton.jsx`
- **Issue:** `html2canvas` sometimes captures the wrong viewport area or misses map tiles that haven't loaded yet
- **Impact:** Exported images may be blank or cropped incorrectly
- **Fix approach:** Wait for all map tiles to load before capture, add a brief delay, or use Leaflet's built-in `toDataURL` for the map layer
- **Status:** Open

#### 8. Country Tabs Not Horizontally Scrollable on Desktop
- **Severity:** Medium
- **Component:** Country/tracker tab bar (desktop)
- **Issue:** The horizontal tab bar (e.g., Switzerland, United States, US Nat. Parks, NYC…) cannot be scrolled sideways on desktop, so tabs that overflow off-screen are inaccessible.
- **Screenshot:** User-reported — tabs cut off on right side, no scroll affordance visible.
- **Required behavior:** The tab row should be horizontally scrollable on desktop (mouse wheel or drag), or show prev/next arrow controls when tabs overflow.
- **Status:** Open

#### 9. Dark Mode Inconsistencies
- **File:** `src/App.css`, various component CSS files
- **Issue:** Some components have hardcoded colors that don't respond to the dark mode CSS variables. Particularly:
  - `src/components/ChallengesPanel.css`
  - `src/components/ConfirmDialog.css`
  - `src/components/EasterEggPrompt.css`
- **Impact:** Visual inconsistency in dark mode
- **Fix approach:** Audit all CSS files for hardcoded colors, replace with CSS custom properties
- **Status:** Open

### Low Priority

#### 9. Keyboard Shortcut Conflicts
- **Issue:** Some keyboard shortcuts may conflict with browser defaults or accessibility tools
- **Fix approach:** Audit shortcut list, add modifier keys where needed
- **Status:** Open

## Bug Triage Template

For future bugs, use this template:

```markdown
### Bug: [Short descriptive title]
- **Severity:** Critical / High / Medium / Low
- **Component:** [File path]
- **Reproduction steps:**
  1. Step one
  2. Step two
  3. Expected vs. actual behavior
- **Browser/Device:** [e.g., iOS Safari 17, Chrome Android 120]
- **Screenshot/Recording:** [if applicable]
- **Root cause:** [after investigation]
- **Fix approach:** [proposed solution]
- **Status:** Open / In Progress / Fixed / Won't Fix
```

## Process Improvements

### Testing Infrastructure
- Maintain the current Vitest config boundaries so root runs stay scoped to this workspace
- Keep Playwright coverage for both desktop and mobile critical flows
- Add pre-commit lint checks
- See `12-architecture-refactor.md` for full testing plan

### Error Monitoring
- Sentry is already integrated (`@sentry/react`) — verify it's capturing errors properly
- Add breadcrumbs for key user actions (tracker switch, visit toggle, friend operations)
- Set up Sentry alerts for new error types

### Performance Monitoring
- Vercel Analytics & Speed Insights are integrated — review dashboard regularly
- Add React Profiler wrapping for heavy components (maps, avatar editor)
- Track Core Web Vitals (LCP, FID, CLS) on mobile

## Files to Modify (for immediate fixes)
| File | Fix |
|------|-----|
| `src/components/MobileBottomSheet.jsx` | Scroll-lock detection, landscape snap points |
| `src/components/ChallengeDetailModal.jsx` | Region name fallback |
| `src/components/ExportButton.jsx` | Wait for tile load before capture |
| `src/hooks/useFriendsData.js` | Reduce overlay loading/render pressure |
| `src/components/SwissMap.jsx` | Reduce overlay rendering cost |
| `src/App.css` | Dark mode variable audit |
| Various `.css` files | Replace hardcoded colors with CSS variables |
| `src/hooks/useKeyboardShortcuts.js` | Reduce shortcut conflicts with browser and accessibility tools |

## Estimated Effort
- Critical/High fixes: ~6-8 hours
- Medium fixes: ~4-6 hours
- Low fixes: ~1-2 hours
- Testing infrastructure setup: ~4-5 hours (see `12-architecture-refactor.md`)
- **Total immediate fixes: ~11-16 hours**
