# ToDo: Bug Fixes & Quality Improvements

**Date:** 2026-03-14
**Status:** In Progress — bug list is triaged against the current repo, but several items need a fresh pass after the latest PR churn
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


## PR Review Snapshot (2026-03-19)

Recent merged PRs materially changed the bug backlog, so this ToDo now reflects the current branch instead of the older reports:

- **PR #77** — fixed the mini-game quit blank-screen flow, share URL compression, dark-mode cleanup, and added regression tests around Map Quiz / Flag Quiz behavior.
- **PR #100** — fixed the mobile zero-height quiz rendering bug and restored Shape Quiz target reveal behavior.
- **PR #102** — fixed horizontal tracker-tab scrolling and dark-mode styling in `EasterEggPrompt`.
- **PR #104** — moved `SettingsPanel` inside the scrollable region list so desktop region views no longer hide the achievements / progress area.
- **PR #111** — added a proper loading state for fresh login and tracker switches so stale or empty region data does not flash before authenticated fetches resolve.

These changes mean several previously-open bugs are now closed or downgraded to monitoring-only.

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
- **Current repo status:** Could not reproduce in current desktop smoke. Shape Quiz keeps wrong-answer feedback visible before advancing, matching the 2.5s review delay in `useGeographyGame`.
- **Status:** Verified not currently reproducing

#### B. XP/Achievement popups on mobile cover the full screen
- **Severity:** High
- **Component:** XP + achievement popup UI (mobile)
- **Issue:** Popups take over the entire mobile viewport, blocking usability.
- **Required behavior:** Use compact, non-blocking popup/toast sizing on small screens.
- **Current repo status:** Could not reproduce in current mobile smoke. XP toast stays compact above the tab bar, and achievement toast CSS is also already constrained for small screens.
- **Status:** Verified not currently reproducing

#### C. Mini-game map does not fully cover the screen
- **Severity:** Medium
- **Component:** Mini-game map layout
- **Issue:** The mini-game map leaves visible space showing the background map behind it.
- **Required behavior:** Mini-game map container should fully cover intended viewport area.
- **Current repo status:** Fixed by PR #100 after a mobile-specific flex/height bug collapsed the quiz container to 0 height. Current desktop and mobile behavior should be treated as fixed unless a new repro appears.
- **Status:** Fixed

#### D. Quit button in mini-game leads to blank screen
- **Severity:** Critical
- **Component:** Mini-game quit/exit navigation
- **Issue:** Pressing quit exits to a blank screen instead of returning to the expected app view.
- **Required behavior:** Route/state should return users to the previous screen (e.g., main map/dashboard) reliably.
- **Current repo status:** Fixed by PR #77 and kept covered by smoke tests. `Quit` now routes back correctly on desktop and mobile instead of leaving a blank shell.
- **Status:** Fixed

#### E. Flag mini-game missing nearby flag display
- **Severity:** Medium
- **Component:** Flag mini-game UI
- **Issue:** The flag is not shown near the country name as expected.
- **Required behavior:** Display flag in close visual proximity to country label/prompt.
- **Current repo status:** Could not reproduce in current desktop smoke. Flag Quiz renders the main flag prompt and keeps flag + country feedback visible on wrong answers.
- **Status:** Verified not currently reproducing

#### F. Desktop settings menu is missing
- **Severity:** High
- **Component:** Desktop navigation / settings entry point
- **Issue:** On desktop, there is no visible settings menu or settings entry point.
- **Required behavior:** Desktop users should have a clear, accessible way to open settings without relying on the mobile-only UI.
- **Current repo status:** Newly reported; not yet triaged against the current desktop layout.
- **Status:** Open

#### G. Achievement popups replay on every app reopen
- **Severity:** Critical
- **Component:** Achievement unlock persistence / popup queue
- **Issue:** When reopening the site/app, all previously earned achievement popups appear again at once every time.
- **Required behavior:** Achievement popups should only appear when an achievement is newly unlocked, and previously shown unlocks should stay dismissed across app restarts.
- **Current repo status:** Newly reported; persistence and popup replay behavior not yet triaged.
- **Status:** Open

### Confirmed and Recently Fixed

#### H. Root Vitest run picks up unrelated tests and worktrees
- **Severity:** High
- **Component:** `vitest.config.js`
- **Issue:** Root `npm run test` was discovering tests from `.worktrees/`, stale E2E files, and non-unit test paths, producing false failures and noisy triage.
- **Fix:** Scope Vitest to frontend unit/spec files under `src/` and explicitly exclude `.worktrees/`, `e2e/`, `dist/`, `test-results/`, and `node_modules/`.
- **Status:** Fixed

#### I. Map Quiz target country / reveal-state regressions in click mode
- **Severity:** High
- **Component:** `src/components/games/MapQuiz.jsx`
- **Issue:** The click flow had two back-to-back regressions: first the target was not wired through at all, then later fixes risked revealing or zooming the answer too early.
- **Fix:** Keep `targetId` available for testability and map data attributes, but gate visual reveal / zoom behind `revealTarget` so the answer is only shown during review state.
- **Status:** Fixed

#### J. Smoke coverage was desktop-only
- **Severity:** Medium
- **Component:** `playwright.config.js`, `e2e/mobile.spec.js`
- **Issue:** Bug reports around mobile behavior were not backed by automated verification.
- **Fix:** Split Playwright into desktop and mobile Chromium projects and add mobile smoke coverage for Explore tab -> Games -> Map Quiz -> Quit and compact XP toast behavior.
- **Status:** Fixed

#### K. Text-answer game feedback lacked regression coverage
- **Severity:** Medium
- **Component:** `e2e/smoke.spec.js`
- **Issue:** Reported regressions around Shape Quiz and Flag Quiz feedback were not covered by any automated test, so stale bug reports were hard to distinguish from current failures.
- **Fix:** Add desktop smoke assertions for Shape Quiz wrong-answer review visibility and Flag Quiz prompt/feedback visibility.
- **Status:** Fixed

#### L. Mobile bottom sheet snap behavior was brittle across interruptions and rotation
- **Severity:** High
- **Component:** `src/components/MobileBottomSheet.jsx`, `src/App.css`
- **Issue:** The sheet used raw `vh` heights, had no `touchcancel` recovery path, and did not adapt its current snap cleanly across orientation changes. The mobile Leaflet attribution also stayed underneath the sheet.
- **Fix:** Switch runtime sheet sizing to viewport-pixel heights, add orientation-aware snap points, restore the prior snap on cancelled drags, recalculate the active snap on resize, and shift attribution above the sheet on mobile.
- **Verification:** `src/components/__tests__/MobileBottomSheet.test.jsx` plus full Playwright smoke.
- **Status:** Fixed

#### M. Login-time local data migration could race authenticated fetches
- **Severity:** High
- **Component:** `src/context/AuthContext.jsx`, `src/hooks/useVisitedCountries.js`, `src/hooks/useVisitedCantons.js`, `src/App.jsx`
- **Issue:** Login previously kicked off `syncLocalDataToServer()` without awaiting it, while the rest of the app immediately switched into authenticated mode. That allowed visited hooks to fetch server state before migration finished and left a window for user interaction during the merge.
- **Fix:** Add an `isSyncingLocalData` lock in auth, await local-data migration before exposing authenticated state on fresh login, block visited hooks from authenticated fetches while sync is active, and include the sync lock in app loading state.
- **Verification:** `src/context/__tests__/AuthContext.test.jsx`, `src/hooks/__tests__/useVisitedCountries.test.jsx`, full Vitest, and full Playwright smoke.
- **Status:** Fixed

#### F. Map Quiz reveals correct country before user selects
- **Severity:** High
- **Component:** Map Quiz mini-game
- **Issue:** The correct country is highlighted/marked on the map before the user clicks, spoiling the answer.
- **Required behavior:** No country should be visually indicated as correct until after the user makes their selection.
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
- **Current repo status:** Fixed for the visited-data migration path. Auth now exposes a sync-in-progress lock, the app treats that window as loading, and visited hooks wait until migration completes before fetching authenticated state.
- **Remaining gap:** This does not add retries for every future server-side sync error; it specifically closes the login/migration race.
- **Fix approach:** Keep the current lock; add retry/backoff only if server-side migration failures become a real observed issue

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

#### 4. Challenge Region Names Not Resolving
- **File:** `src/components/ChallengeDetailModal.jsx`
- **Issue:** Challenge target regions sometimes show raw IDs (e.g., "us-ca") instead of friendly names (e.g., "California") if the GeoJSON data hasn't loaded yet
- **Impact:** Poor UX in challenge detail view
- **Fix approach:** Preload region name dictionary, add fallback display for loading state
- **Status:** Fix open in PR #133

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
- **Current repo status:** Fixed by PR #77 using `lz-string` encoded URI compression with backward-compatible legacy decode support.
- **Remaining gap:** If share payloads grow substantially again, a server-generated short-link flow may still be worth adding later.

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
- **Current repo status:** Partially fixed by PR #77 and PR #102 (`ConfirmDialog.css` and `EasterEggPrompt.css` were cleaned up).
- **Remaining gap:** Continue auditing other component styles for hardcoded light-theme colors.

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
- **Status:** Fix open in PR #132

#### 12. Confetti Firing Multiple Times
- **File:** `src/components/Confetti.jsx`
- **Issue:** Reaching a milestone (25/50/75/100%) and then toggling a region off and back on can re-trigger confetti
- **Fix approach:** Track shown milestones in localStorage, only fire once per milestone per tracker
- **Status:** Fix open in PR #130

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
