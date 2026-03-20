# iOS Native Feel — Design Spec
**Date:** 2026-03-20
**Status:** Approved (owner decision)

## Overview

Make the World Tracker PWA feel indistinguishable from a native iOS app. The foundation is already strong (bottom tab bar, safe-area insets, spring animations, swipe-back, glass nav bars) — this spec covers the 7 remaining gaps, each shipped as an independent PR.

---

## PR 1 — Pill Toasts (`feat/ios-pill-toasts`)

**Problem:** Current XP toasts slide in from the right at bottom. iOS system alerts come from the top as blurred pills (Dynamic Island style).

**Design:**
- Position: top-center, below status bar (`top: env(safe-area-inset-top) + 12px`)
- Shape: full pill (`border-radius: 999px`), max-width 320px
- Style: heavy backdrop-filter blur (24px), glass bg matching app theme, subtle border
- Animation: slide down from top + slight scale (spring easing), auto-dismiss after 3.5s
- Stack multiple: newest on top, older ones push down with spring
- Dark mode: darker glass, same structure
- No change to XpNotification logic — only the visual layer and positioning

**Files:** `src/xp-styles.css`, `src/components/XpNotification.jsx`

---

## PR 2 — iOS Action Sheet (`feat/ios-action-sheet`)

**Problem:** `ConfirmDialog` and several inline confirm() calls use web-native patterns that feel alien on iOS.

**Design:**
- New `ActionSheet` component: slides up from bottom, above tab bar
- Structure: optional title, optional message, list of action buttons (each with label + optional destructive/cancel style), always a Cancel button at bottom
- Cancel: separate pill button below main list (matches iOS HIG exactly)
- Background: semi-transparent scrim (`rgba(0,0,0,0.4)`), tap to dismiss = cancel
- Animation: spring slide-up from bottom (same easing as MobileBottomSheet)
- Context: `ActionSheetContext` + `useActionSheet()` hook for imperative use from anywhere
- Replace `ConfirmDialog` usages in: `ChallengesPanel.jsx`, `FriendsPanel.jsx`, `Sidebar.jsx`

**Files:** `src/components/ActionSheet.jsx`, `src/components/ActionSheet.css`, `src/context/ActionSheetContext.jsx`

---

## PR 3 — Haptics Everywhere (`feat/ios-haptics-audit`)

**Problem:** Haptics exist only for country visits, XP events, and achievements. Tab switches, sheet snaps, modal opens/closes, and list selections are silent.

**Design — additions:**
- Tab bar: `haptics.selection()` on every tab switch
- Bottom sheet snap: `haptics.selection()` when snapping between peek/half/full
- Pull-to-refresh: `haptics.selection()` when threshold crossed (ready state), `haptics.confirmation()` on release
- Modal open: `haptics.action()` on SwipeableModal and ActionSheet open
- Modal dismiss (swipe): `haptics.selection()`
- Screen push: `haptics.selection()` (in NavigationStack)
- Screen pop (swipe-back): `haptics.selection()`
- No change to vibration patterns — just placement

**Files:** `src/components/BottomTabBar.jsx`, `src/components/MobileBottomSheet.jsx`, `src/hooks/usePullToRefresh.js`, `src/components/SwipeableModal.jsx`, `src/components/NavigationStack.jsx`, `src/components/Screen.jsx`

---

## PR 4 — Scroll Feel (`feat/ios-scroll-feel`)

**Problem:** Scrollable lists feel flat — no snap, no scroll-to-top on tab re-tap, overscroll isn't tuned.

**Design:**
1. **Scroll-to-top on tab re-tap:** In `BottomTabBar`, when the already-active tab is tapped, dispatch a `scroll-to-top` custom event. Each scrollable screen listens and scrolls its container to top (smooth, with spring). Also works when tapping the active tab while a push screen is open (pops to root first).
2. **Scroll-snap on horizontal card rows:** Add `scroll-snap-type: x mandatory` + `scroll-snap-align: start` to horizontal carousels in ExploreScreen and GamesPanel. Add `-webkit-overflow-scrolling: touch` where missing.
3. **Overscroll bounce indicator:** `.screen-content` and `.sidebar-scroll` get `overscroll-behavior-y: contain` (already some have it; audit and standardize).
4. **Momentum scroll audit:** Ensure every scrollable div has `-webkit-overflow-scrolling: touch` on iOS.

**Files:** `src/components/BottomTabBar.jsx`, `src/components/ExploreScreen.jsx`, `src/components/GamesPanel.jsx`, `src/App.css`

---

## PR 5 — Large Collapsing Titles (`feat/ios-large-title`)

**Problem:** Screen headers are compact-only (17px). iOS uses 34px "large title" that collapses on scroll — a signature native feel marker.

**Design:**
- Add `largeTitle` prop to `Screen` component (opt-in, default false)
- When enabled: render a large title block (`34px`, bold) between the header and content
- As `.screen-content` scrolls past the large title area, the compact nav bar title fades in (opacity 0→1, crossfade)
- Use `IntersectionObserver` on the large title block — when it leaves viewport, add `.header-compact` class to header → title fades in
- No JS scroll listeners (use IO for performance)
- Apply to: `ChallengeScreen`, `GamesScreen`, `StatsScreen`, `ProfileScreen`

**Files:** `src/components/Screen.jsx`, `src/components/Screen.css`

---

## PR 6 — Keyboard Avoidance (`feat/ios-keyboard-avoidance`)

**Problem:** When the iOS virtual keyboard opens, focused inputs inside scrollable containers get buried under it. The `visualViewport` API exposes the actual visible area.

**Design:**
- New hook: `useKeyboardAvoidance(containerRef)`
- Listens to `visualViewport` `resize` event
- When keyboard appears (`window.innerHeight - visualViewport.height > 100`): sets `paddingBottom` on container to `window.innerHeight - visualViewport.height`
- When keyboard hides: removes padding with spring animation
- Apply to: `MobileBottomSheet` (search input), `CitySearch.jsx`, any screen with `<input>` / `<textarea>`
- SSR-safe: no-ops if `visualViewport` undefined

**Files:** `src/hooks/useKeyboardAvoidance.js`, `src/components/MobileBottomSheet.jsx`, `src/components/CitySearch.jsx`

---

## PR 7 — Tab Swipe Gesture (`feat/ios-tab-swipe`)

**Problem:** iOS users expect to swipe horizontally between tabs. Currently there's no gesture — only tap.

**Design:**
- Tab order: Map → Explore → Games → Social → Profile
- Horizontal swipe on the main content area (not the bottom sheet)
- Detect: `touchstart`/`touchend` with `deltaX > 60px` and `deltaX > deltaY * 1.5` (horizontal bias)
- Animate: current tab slides out (translateX), next tab slides in from the correct direction
- Velocity-aware: fast flick triggers tab change; slow drag that doesn't reach threshold snaps back
- Spring easing: `cubic-bezier(0.32, 0.72, 0, 1)` matching existing transitions
- Must NOT conflict with: bottom sheet drag, map pan, horizontal card scroll
- Guard: if bottom sheet is not at peek, ignore swipe (sheet interaction takes priority)
- Implementation: `useTabSwipe(activeTab, onTabChange, sheetSnap)` hook

**Files:** `src/hooks/useTabSwipe.js`, `src/App.jsx`

---

## Constraints

- All branches off `main`
- No merges — PRs only
- All tests must pass (`npm test`)
- E2E must pass (`npm run test:e2e`)
- No breaking changes to existing behavior
- All new hooks SSR-safe and `prefers-reduced-motion`-aware
