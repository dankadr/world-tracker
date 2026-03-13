# ToDo: Bug Fixes & Quality Improvements

**Date:** 2026-02-24
**Status:** Not Started
**Priority:** High (ongoing)
**Scope:** Fix known bugs, improve stability, establish bug tracking process

---

## Overview

Document known issues, establish a bug triage process, and systematically fix existing bugs. The app currently has no test suite (no Vitest, Jest, or Playwright), making bugs harder to catch proactively. This plan covers both immediate fixes and the process for tracking future bugs.

## Known Issues to Investigate

### Newly Reported Mini-Game Bugs

#### A. Guess the Country: Wrong answer feedback is missing
- **Severity:** High
- **Component:** Geography mini-game (guess country name flow)
- **Issue:** When users submit a wrong answer, the game immediately moves on without showing enough feedback.
- **Required behavior:**
  - Show the correct answer for at least 2-3 seconds
  - Tell users how far their guess was from the correct location
  - Optionally pan/zoom the map to the correct country for clearer feedback
- **Status:** Open

#### B. XP/Achievement popups on mobile cover the full screen
- **Severity:** High
- **Component:** XP + achievement popup UI (mobile)
- **Issue:** Popups take over the entire mobile viewport, blocking usability.
- **Required behavior:** Use compact, non-blocking popup/toast sizing on small screens.
- **Status:** Open

#### C. Mini-game map does not fully cover the screen
- **Severity:** Medium
- **Component:** Mini-game map layout
- **Issue:** The mini-game map leaves visible space showing the background map behind it.
- **Required behavior:** Mini-game map container should fully cover intended viewport area.
- **Status:** Open

#### D. Quit button in mini-game leads to blank screen
- **Severity:** Critical
- **Component:** Mini-game quit/exit navigation
- **Issue:** Pressing quit exits to a blank screen instead of returning to the expected app view.
- **Required behavior:** Route/state should return users to the previous screen (e.g., main map/dashboard) reliably.
- **Status:** Open

#### E. Flag mini-game missing nearby flag display
- **Severity:** Medium
- **Component:** Flag mini-game UI
- **Issue:** The flag is not shown near the country name as expected.
- **Required behavior:** Display flag in close visual proximity to country label/prompt.
- **Status:** Open

### Critical / High Priority

#### 1. App.jsx State Management Complexity
- **File:** `src/App.jsx` (823 lines)
- **Issue:** All application state lives in a single component — visited data for 10 trackers, modals, views, user preferences, friend overlays, XP/leveling. This creates:
  - Excessive re-renders on any state change
  - Difficult to debug which state update caused a re-render
  - Race conditions possible when multiple state updates happen simultaneously
- **Impact:** Performance degradation, especially on mobile devices
- **Fix approach:** Extract state into domain-specific hooks/contexts (see `12-architecture-refactor.md`)

#### 2. Async Data Sync Race Conditions
- **File:** `src/context/AuthContext.jsx`, `src/App.jsx`
- **Issue:** On login, `syncLocalDataToServer()` migrates localStorage data to the server. If the user interacts with the app during sync, local and server state can diverge
- **Impact:** Data loss or duplication on login
- **Fix approach:** Add a sync-in-progress lock, disable interactions during sync, retry on failure

#### 3. Mobile Bottom Sheet Edge Cases
- **File:** `src/components/MobileBottomSheet.jsx`
- **Issue:** Several edge cases:
  - Rapid swipe up/down can cause the sheet to get stuck between snap points
  - Sheet content scrolling conflicts with sheet dragging (scroll vs. drag ambiguity)
  - Landscape mode on phones breaks the snap point percentages
  - Bottom sheet overlaps the Leaflet map tile credit attribution
- **Impact:** UI broken state on mobile
- **Fix approach:** Add scroll-lock detection (if content scrolled > 0, disable drag), fix landscape snap points, add z-index for attribution

#### 4. Challenge Region Names Not Resolving
- **File:** `src/components/ChallengeDetailModal.jsx`
- **Issue:** Challenge target regions sometimes show raw IDs (e.g., "us-ca") instead of friendly names (e.g., "California") if the GeoJSON data hasn't loaded yet
- **Impact:** Poor UX in challenge detail view
- **Fix approach:** Preload region name dictionary, add fallback display for loading state

### Medium Priority

#### 5. Friend Overlay Performance
- **Files:** `src/hooks/useFriendsData.js`, `src/components/SwissMap.jsx`
- **Issue:** When a user has many friends (10+), the map renders overlay polygons for each friend. With large GeoJSON datasets (NYC with 188 neighborhoods × 10 friends = 1,880 polygon renders), this causes visible lag
- **Impact:** Map becomes sluggish with many friends
- **Fix approach:** Limit simultaneous overlays, use canvas rendering instead of SVG for overlays, debounce overlay updates

#### 6. Export Button Captures Incorrect Area
- **File:** `src/components/ExportButton.jsx`
- **Issue:** `html2canvas` sometimes captures the wrong viewport area or misses map tiles that haven't loaded yet
- **Impact:** Exported images may be blank or cropped incorrectly
- **Fix approach:** Wait for all map tiles to load before capture, add a brief delay, or use Leaflet's built-in `toDataURL` for the map layer

#### 7. Share URL Length Limits
- **File:** `src/components/ShareButton.jsx`
- **Issue:** Share mode encodes visited data as base64 in the URL hash. With many visited regions across all trackers, the URL can exceed browser limits (~2,000 chars for some browsers)
- **Impact:** Share links break or get truncated
- **Fix approach:** Compress data before base64 encoding (LZ-string), or switch to a server-generated short link

#### 8. Dark Mode Inconsistencies
- **File:** `src/App.css`, various component CSS files
- **Issue:** Some components have hardcoded colors that don't respond to the dark mode CSS variables. Particularly:
  - `src/components/ChallengesPanel.css`
  - `src/components/ConfirmDialog.css`
  - `src/components/EasterEggPrompt.css`
- **Impact:** Visual inconsistency in dark mode
- **Fix approach:** Audit all CSS files for hardcoded colors, replace with CSS custom properties

### Low Priority

#### 9. Keyboard Shortcut Conflicts
- **Issue:** Some keyboard shortcuts may conflict with browser defaults or accessibility tools
- **Fix approach:** Audit shortcut list, add modifier keys where needed

#### 10. Onboarding Doesn't Re-trigger
- **File:** `src/components/Onboarding.jsx`
- **Issue:** Once dismissed, there's no way to re-view the onboarding guide
- **Fix approach:** Add "Show Onboarding" option in settings/profile

#### 11. Year in Review — Missing Data Edge Cases
- **File:** `src/components/YearInReview.jsx`
- **Issue:** If a user has no visits in a year, the Year in Review may show empty cards or crash
- **Fix approach:** Add guard for empty data, show a "No travels this year" message

#### 12. Confetti Firing Multiple Times
- **File:** `src/components/Confetti.jsx`
- **Issue:** Reaching a milestone (25/50/75/100%) and then toggling a region off and back on can re-trigger confetti
- **Fix approach:** Track shown milestones in localStorage, only fire once per milestone per tracker

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
- Add Vitest for unit tests (hooks, utils, data processing)
- Add Playwright for E2E tests (critical user flows)
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
| `src/components/ShareButton.jsx` | Compress share data |
| `src/components/Confetti.jsx` | Track shown milestones |
| `src/components/YearInReview.jsx` | Empty year guard |
| `src/App.css` | Dark mode variable audit |
| Various `.css` files | Replace hardcoded colors with CSS variables |

## Estimated Effort
- Critical/High fixes: ~6-8 hours
- Medium fixes: ~4-6 hours
- Low fixes: ~2-3 hours
- Testing infrastructure setup: ~4-5 hours (see `12-architecture-refactor.md`)
- **Total immediate fixes: ~12-17 hours**
