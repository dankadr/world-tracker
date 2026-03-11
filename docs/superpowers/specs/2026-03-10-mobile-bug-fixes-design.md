# Mobile Bug Fixes & Settings Panel — Design Spec

**Date:** 2026-03-10
**Status:** Approved

---

## Goal

Fix 5 known mobile UI bugs and add a Settings panel to the app.

---

## Bug 1 — Bottom Sheet Cut Off at Top

**Problem:** When the bottom sheet snaps to full height (92vh), content at the top is hidden under the iOS status bar / safe area.

**Fix:** Add `padding-top: env(safe-area-inset-top, 44px)` to `.mobile-bottom-sheet` when at full snap. Use `100dvh` instead of `100vh` as the reference to correctly account for browser chrome.

**Files:** `src/App.css` (safe-area block), `src/components/MobileBottomSheet.jsx` (SNAP_FULL constant)

---

## Bug 2 — Settings Panel (new)

**Problem:** Dark/light toggle buried in header. No central place for app preferences.

**Design:** New `SettingsPanel` component rendered at the bottom of `ProfileScreen` (mobile) and at the bottom of the desktop `Sidebar`. iOS-style grouped sections:

- **Appearance** — Dark Mode toggle (moves here from header)
- **Data** — Show Onboarding again, Reset Progress (current tracker), Reset Everything
- **About** — Website link, Rate the App, Version + app name

The dark mode toggle button is removed from `Sidebar.jsx` and `WorldSidebar.jsx` headers.

**Files:**
- Create: `src/components/SettingsPanel.jsx`
- Create: `src/components/SettingsPanel.css`
- Modify: `src/components/ProfileScreen.jsx` — add Settings tab segment
- Modify: `src/components/Sidebar.jsx` — replace footer reset buttons + theme toggle with `<SettingsPanel>`
- Modify: `src/components/WorldSidebar.jsx` — add `<SettingsPanel>` at bottom, remove theme toggle

---

## Bug 3+4 — Redundant Stats & Friends Buttons on Mobile

**Problem:** The stats 📊 and friends 👥 icon buttons appear in the sidebar header on mobile, but those features are already accessible via the Profile tab (stats) and Social tab (friends).

**Fix:** Pass `isMobile` prop from `App.jsx` to `Sidebar` and `WorldSidebar`. Wrap the stats button, friends button, and theme toggle with `{!isMobile && ...}`. The theme toggle moves to Settings.

**Files:** `src/components/Sidebar.jsx`, `src/components/WorldSidebar.jsx`, `src/App.jsx`

---

## Bug 5 — Floating Map Action Buttons Mispositioned

**Problem:** The 🎮 games button (`position: absolute; top: 12px; right: 56px`) and the map layer control (`position: absolute; top: 56px; right: 12px`) are independently positioned and appear misaligned/floating randomly on the map.

**Fix:** Wrap both in a `.map-action-buttons` container: `position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 1000`. Remove individual absolute positioning from each button.

**Files:** `src/App.jsx`, `src/App.css`

---

## Architecture Notes

- `SettingsPanel` takes props: `onReset`, `onResetAll`, `onShowOnboarding`, `isMobile` (optional, for layout hints)
- On mobile (ProfileScreen), Settings is a third tab segment after Profile + Badges
- On desktop (Sidebar), Settings replaces the existing footer reset buttons and theme toggle
- The `isMobile` prop is already available in `App.jsx` via `useDeviceType()`
