# Mobile Navigation Overhaul — Approach C (Future)

**Date:** 2026-02-23
**Status:** Parked — implement after Approach B is stable
**Scope:** Full mobile-native navigation restructure

## Vision

Replace the current "desktop layout adapted for mobile" with a ground-up mobile-first experience. The app should feel indistinguishable from a native iOS travel app.

## Core Idea

Move from the current architecture (everything lives in a sidebar or stacks modals) to a proper **bottom tab bar + push navigation** model.

```
┌────────────────────────┐
│                        │
│       Map View         │  ← always full screen on mobile
│                        │
│                        │
├────────────────────────┤
│  🗺 Map │ 📋 List │ 👥 Social │ 👤 Profile │
└────────────────────────┘
```

---

## Navigation Architecture

### Bottom Tab Bar (persistent)

Four tabs replace all the header icon buttons and bottom sheet content:

| Tab | Content |
|-----|---------|
| 🗺 **Map** | Full-screen map (world or detail), tap to switch |
| 📋 **Explore** | Region/country list, search, progress bars |
| 👥 **Social** | Friends + Challenges (two sub-tabs) |
| 👤 **Profile** | Avatar, achievements, stats, XP/level, settings |

### Push Navigation (iOS-style)

Replace modal overlays with slide-in screens from the right:

- Tap a country on World Map → pushes "Country Detail" screen
- Tap a challenge → pushes "Challenge Detail" screen (instead of modal overlay)
- Tap a friend → pushes "Friend Profile" screen
- All screens have a `←` back button + left-edge swipe to go back

Implement using a lightweight `NavigationStack` context (no React Router needed) that maintains a stack of screen names and transition animations.

### Bottom Sheet

Keep the bottom sheet for the Map tab only, as a quick-peek layer:
- Shows current progress summary (countries/regions count, %)
- Quick action pills (Search, Stats)
- Drag to expand for full list view

Remove from other tabs — they get their own full-screen layouts.

---

## Screen Designs

### Map Tab

```
┌─────────────────────────┐
│  [full-screen map]      │
│                         │
│  ┌───────────────────┐  │
│  │ 🇨🇭 24/26 · 92%  │  │  ← floating pill
│  └───────────────────┘  │
│                         │
├─────────────────────────┤  ← bottom sheet (peek state)
│  ══ (drag handle)       │
│  🌍 45 / 195 countries  │
│  [████░░░░░░░░] 23%     │
│  [🔍 Search] [📊 Stats] │
└─────────────────────────┘
```

### Explore Tab

Full-screen scrollable list:
- Header: current tracker name + flag + progress
- Tracker switcher tabs (ch / us / no / ...)
- Searchable region list
- Each row: checkbox, region name, visited date, bucket list star

### Social Tab

Two sub-tabs: Friends | Challenges
- Friends list with compare/remove actions
- Challenges list → tap → pushes Challenge Detail screen
  - Challenge Detail shows target regions as a visual mini-map (highlight target regions on a small thumbnail of the tracker map)

### Profile Tab

- Avatar (large, centered)
- Level badge + XP progress bar
- Achievements grid
- Stats summary
- Settings (theme, reset, export)

---

## Key Technical Changes

### New Components

| Component | Purpose |
|-----------|---------|
| `BottomTabBar.jsx` | Persistent 4-tab navigation |
| `NavigationStack.jsx` + context | Push/pop screen stack with slide transitions |
| `Screen.jsx` | Wrapper with back button + slide-in animation |
| `ExploreScreen.jsx` | Full-screen region/country list |
| `SocialScreen.jsx` | Friends + Challenges tabs |
| `ProfileScreen.jsx` | Avatar, achievements, stats, settings |
| `ChallengeScreen.jsx` | Challenge detail as a full screen (not modal) |

### Modified Components

| Component | Change |
|-----------|--------|
| `App.jsx` | Major restructure: render BottomTabBar + NavigationStack instead of sidebar + modals |
| `MobileBottomSheet.jsx` | Scope limited to Map tab only |
| `ChallengesPanel.jsx` | Becomes content inside SocialScreen, no longer inside FriendsPanel |
| `FriendsPanel.jsx` | Split into FriendsTab + ChallengesTab |
| `WorldSidebar.jsx` | Replaced by ExploreScreen on mobile; kept for desktop |
| `Sidebar.jsx` | Replaced by ExploreScreen on mobile; kept for desktop |

### Removed (mobile only)

- All `modal-overlay` / `modal-content` patterns on mobile
- The header icon buttons (Friends 👥, Stats 📊, BucketList 📌) — replaced by tab bar
- `SwipeableModal` from Approach B — no longer needed (everything is a screen or sheet)

---

## Animation Spec

All transitions use `cubic-bezier(0.32, 0.72, 0, 1)` (same spring already in the codebase).

| Transition | Animation |
|-----------|-----------|
| Push screen | Slide in from right (300ms) |
| Pop screen | Slide out to right (280ms) |
| Tab switch | Fade (200ms) |
| Bottom sheet | Existing spring (450ms) |
| Left-edge swipe back | Follows finger, releases with spring |

---

## Color System

Build on the warm palette from Approach B. Add:

- `--tab-bar-bg`: warm glass, slightly more opaque than panels
- `--tab-active`: per-tracker accent color (or amber `#e67e22` as default)
- `--screen-bg`: same as `--body-bg` (no separate background)

---

## Desktop

No changes. Desktop continues to use the sidebar layout. The `useDeviceType` hook already handles this split cleanly.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing share-mode behavior | NavigationStack only activates on mobile; share mode still works via URL hash |
| Losing keyboard shortcuts | Shortcuts only apply on desktop; no change |
| State management complexity | NavigationStack only manages screen names; all app state stays in App.jsx |
| Regression in bottom sheet UX | Bottom sheet is preserved for Map tab; tested separately |

---

## Prerequisites

- Approach B must be shipped and stable
- Test on iOS Safari and Android Chrome before starting
- Consider adding Vitest unit tests for NavigationStack context before refactoring App.jsx

---

## Estimated Scope

Large — touches App.jsx, all panel components, adds 6+ new components. Recommend doing in a feature branch with incremental PRs per tab.
