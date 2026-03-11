# ToDo: Mobile UI/UX — iOS-Native Experience

**Date:** 2026-02-24
**Status:** Phase 1 ✅ Complete · Phase 2 ✅ Complete · Phase 3 🔄 In Progress
**Priority:** High
**Scope:** Full mobile experience overhaul — make the app feel indistinguishable from a native iOS app

---

## Overview

Transform the current mobile web experience from "responsive desktop adapted for mobile" into a ground-up, fluid, gesture-driven native-feeling app. The goal is that a user on Safari/Chrome mobile cannot tell this is a web app.

## Current State

- **Bottom Sheet:** `src/components/MobileBottomSheet.jsx` — 3 snap points (peek 20vh, half 50vh, full 92vh), spring animation
- **Swipe-to-dismiss:** `src/hooks/useSwipeToDismiss.js` + `src/components/SwipeableModal.jsx`
- **Device detection:** `src/hooks/useDeviceType.js` — returns `{ isMobile, isTablet, isTouch, isPortrait }`
- **Layout:** Desktop sidebar content renders inside MobileBottomSheet on mobile
- **Modals:** Friends, BucketList, Challenges etc. use SwipeableModal
- **Palette:** Warm sand/cream glassmorphism (light), warm charcoal (dark) — via CSS custom properties in `src/App.css`
- **Approach B (shipped):** Swipe-to-dismiss everywhere, warm palette harmonization
- **Approach C (parked):** Full bottom tab bar + push navigation — detailed plan at `docs/plans/2026-02-23-mobile-native-overhaul-plan-C.md`

## Goals

### 1.1 — Fluid & Smooth UX
- Every interaction must have animation — no instant snaps, no janky transitions
- Use spring physics (`cubic-bezier(0.32, 0.72, 0, 1)`) for all transitions
- 60fps on all animations — no dropped frames
- Rubber-band overscroll on all scrollable lists
- Velocity-based dismissal on all swipeable elements
- Touch feedback: slight scale-down on tap (0.97), with spring bounce-back
- Loading states: skeleton screens instead of spinners
- Pull-to-refresh gesture on list views

### 1.2 — iOS-Native Feel
- Implement Approach C navigation architecture:
  - Bottom tab bar (Map / Explore / Social / Profile) — replaces all header icon buttons
  - Push navigation with slide-in from right (300ms) and left-edge swipe-back
  - `NavigationStack` context for screen management
- Large title headers that shrink on scroll (iOS dynamic type style)
- Haptic feedback via Vibration API on key interactions (toggle visit, unlock achievement)
- Safe area respect (`env(safe-area-inset-*)`) for notch/home indicator
- Status bar integration (transparent, content extends behind it)
- System font stack (`-apple-system, SF Pro`) matching iOS
- Selection highlight: `tap-highlight-color: transparent` with custom feedback
- Prevent rubber-banding on the page itself (only on scroll containers)
- Disable text selection on UI elements, allow on content
- Momentum scrolling via `-webkit-overflow-scrolling: touch`

## Sub-tasks

### Phase 1: Foundation (Priority)
- [ ] Implement `BottomTabBar.jsx` — 4 persistent tabs with active indicator animation
- [ ] Implement `NavigationStack.jsx` + context — push/pop screen stack with slide transitions
- [ ] Implement `Screen.jsx` — wrapper with back button + left-edge swipe gesture
- [ ] Refactor `App.jsx` to render tab bar + navigation stack on mobile (keep desktop sidebar)
- [ ] Add safe-area-inset CSS variables throughout

### Phase 2: Screen Conversions
- [ ] Create `ExploreScreen.jsx` — full-screen region/country list with search, replaces sidebar content
- [ ] Create `SocialScreen.jsx` — Friends + Challenges tabs, replaces FriendsPanel modal
- [ ] Create `ProfileScreen.jsx` — avatar, achievements, stats, XP/level, settings
- [ ] Convert `ChallengeDetailModal` → `ChallengeScreen.jsx` (push screen, not modal)
- [ ] Convert Stats, BucketList, YearInReview to push screens on mobile

### Phase 3: Polish
- [ ] Add spring physics to all remaining transitions
- [ ] Add haptic feedback (Vibration API) on visit toggles, achievement unlocks, level ups
- [ ] Implement skeleton loading screens for async data
- [ ] Add pull-to-refresh on Social & Explore screens
- [ ] Large title headers with scroll-to-shrink animation
- [ ] Touch feedback (scale 0.97 on press, spring bounce-back on release) for all tappable elements
- [ ] Rubber-band overscroll on all list containers
- [ ] Test & fix all edge cases on iOS Safari and Android Chrome

## Technical Approach

### Navigation Stack Context
```jsx
// src/context/NavigationContext.jsx
const NavigationContext = createContext();

function NavigationProvider({ children }) {
  const [stack, setStack] = useState([{ screen: 'root', props: {} }]);

  const push = (screen, props = {}) =>
    setStack(prev => [...prev, { screen, props }]);

  const pop = () =>
    setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const current = stack[stack.length - 1];
  return (
    <NavigationContext.Provider value={{ stack, push, pop, current }}>
      {children}
    </NavigationContext.Provider>
  );
}
```

### Tab Bar Component
```jsx
// Bottom tab bar with animated active indicator
const tabs = [
  { id: 'map', icon: MapIcon, label: 'Map' },
  { id: 'explore', icon: CompassIcon, label: 'Explore' },
  { id: 'social', icon: UsersIcon, label: 'Social' },
  { id: 'profile', icon: UserIcon, label: 'Profile' },
];
```

### Animation Spec
| Transition | Duration | Easing |
|-----------|----------|--------|
| Push screen | 300ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Pop screen | 280ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Tab switch | 200ms | fade cross-dissolve |
| Bottom sheet | 450ms | spring (existing) |
| Touch press | 100ms | scale to 0.97 |
| Touch release | 300ms | spring bounce-back |
| Left-edge swipe | follows finger velocity |

## Files to Create
| File | Purpose |
|------|---------|
| `src/components/BottomTabBar.jsx` | 4-tab persistent navigation |
| `src/context/NavigationContext.jsx` | Push/pop screen stack |
| `src/components/Screen.jsx` | Screen wrapper with back button + slide animation |
| `src/components/ExploreScreen.jsx` | Region/country list view |
| `src/components/SocialScreen.jsx` | Friends + Challenges layout |
| `src/components/ProfileScreen.jsx` | Avatar, achievements, stats, settings |
| `src/components/BottomTabBar.css` | Tab bar styles |
| `src/components/Screen.css` | Screen transition styles |

## Files to Modify
| File | Change |
|------|--------|
| `src/App.jsx` | Major restructure: conditionally render TabBar + NavigationStack on mobile |
| `src/App.css` | Add safe area, tab bar spacing, remove mobile sidebar styles |
| `src/components/MobileBottomSheet.jsx` | Scope to Map tab only |
| `src/components/FriendsPanel.jsx` | Becomes content inside SocialScreen |
| `src/components/ChallengesPanel.jsx` | Content inside SocialScreen |
| `src/components/Sidebar.jsx` | Content feeds into ExploreScreen on mobile |
| `src/components/Achievements.jsx` | Renders inside ProfileScreen on mobile |
| `src/components/AvatarEditor.jsx` | Renders inside ProfileScreen on mobile |

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Breaking share-mode URL behavior | NavigationStack only on mobile; share mode still uses URL hash |
| App.jsx complexity increase | Extract mobile layout into separate `MobileApp.jsx` wrapper |
| Regression in bottom sheet | Keep bottom sheet for Map tab only; test separately |
| Leaflet map performance with tab transitions | Preserve map instance across tab switches (don't unmount) |

## Estimated Effort
~20-25 hours across 3 phases

## References
- `docs/plans/2026-02-23-mobile-native-overhaul-plan-C.md` — full Approach C architecture
- `docs/plans/2026-02-23-mobile-uiux-approach-b.md` — implemented Approach B (prerequisite)
- `docs/plans/2026-02-23-mobile-uiux-design.md` — design decisions for Approach B
