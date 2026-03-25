# ToDo: Accessibility (a11y) Audit & Improvements

**Date:** 2026-03-16
**Status:** Partially complete — some accessibility groundwork landed, but there has been no full audit/remediation pass
**Priority:** Medium
**Scope:** Full accessibility audit and remediation — ARIA roles, keyboard navigation, color contrast, screen reader support, and focus management

---

## PR Review Snapshot (2026-03-19)

- **PR #78** removed some emoji-only controls, improved mobile screen wiring, and added more touch-feedback polish in profile/social flows.
- Those changes help, but they do **not** replace the full keyboard, contrast, focus-management, and screen-reader audit outlined below.

## Overview

The app has been built mobile-first with heavy touch interactions but has not undergone a systematic accessibility review. Many interactive elements lack proper ARIA labels, focus management is broken in modals, and color contrast in the warm gold palette may not meet WCAG AA requirements. This is both a legal risk (WCAG compliance is increasingly mandated) and a user reach issue — ~15% of users have some form of disability.

## Reality Check (2026-03-25)

- `useReducedMotion` exists and `BottomTabBar.jsx` already uses proper `tablist` / `tab` roles
- Many icon buttons already have `aria-label`, but coverage is inconsistent across the app
- There is still no formal axe/Lighthouse workflow, no focus-trap utility, and no systematic contrast pass

## Current State

- Some ARIA labels exist (`data-testid` attributes present for testing, some `aria-label`)
- `useReducedMotion` hook exists — animations respect `prefers-reduced-motion`
- `ConfirmDialog.jsx` exists (modal — check for focus trap)
- Map interactions are entirely mouse/touch — no keyboard alternative for toggling countries
- Bottom tab bar has no ARIA role="tablist"
- Achievement toasts have no `aria-live` region
- Game screens have no screen reader announcements for results
- Color contrast: gold `#c9a84c` on white background is ~2.8:1 — fails WCAG AA (requires 4.5:1 for normal text)

## WCAG 2.1 AA Target

Key criteria to address:
- **1.4.3** Contrast (Minimum) — 4.5:1 for normal text, 3:1 for large text
- **2.1.1** Keyboard — all functionality available via keyboard
- **2.4.3** Focus Order — logical tab order
- **2.4.7** Focus Visible — visible focus indicator
- **3.2.2** On Input — no unexpected context changes on input
- **4.1.2** Name, Role, Value — all UI components have accessible names
- **4.1.3** Status Messages — screen reader-accessible announcements

## Specific Issues & Fixes

### 1. Color Contrast

Run automated contrast audit:
```js
// In browser devtools: Lighthouse > Accessibility audit
// Or: axe-core in tests
```

Issues to fix:
- Gold text `#c9a84c` on `#fff` → change to darker `#9a7d30` for body text, keep gold for decorative elements only
- Stats percentage text uses gold — meets 3:1 for large text (>18px) but verify
- Dark mode: verify all text/background combos

### 2. Keyboard Navigation

**World Map** — clicking a country requires a pointing device. Add keyboard support:
- Map container focusable (`tabIndex={0}`)
- Arrow keys pan the map
- Enter on a focused country toggles it
- Tab cycles through visible countries (within viewport)

**Bottom Tab Bar** — add proper roles:
```jsx
<nav role="tablist" aria-label="Main navigation">
  <button role="tab" aria-selected={activeTab === 'map'} aria-controls="map-panel">
```

**Modals (SwipeableModal, MobileBottomSheet)** — implement focus trap:
```js
// utils/focusTrap.js
// Intercept Tab/Shift+Tab and cycle within modal
// Return focus to trigger element on close
```

**Games** — keyboard shortcut hints for quiz options (1/2/3/4 keys to select)

### 3. ARIA Labels

Audit all icon-only buttons — many use emojis as content:
```jsx
// BAD:
<button onClick={handleShare}>📤</button>

// GOOD:
<button onClick={handleShare} aria-label="Share your travel stats">
  <span aria-hidden="true">📤</span>
</button>
```

Key buttons to fix:
- Map layer control toggles (wishlist, friends, UNESCO)
- Sidebar collapse button (`◀` / `▶`)
- Close buttons on all modals
- Achievement toast close button (`×`)
- Color picker in stats card
- Tab bar icons

### 4. Live Regions for Dynamic Content

```jsx
// Achievement toast container:
<div aria-live="polite" aria-atomic="false" className="toast-container">

// XP notifications:
<div aria-live="polite" aria-label="XP earned notification">

// Game feedback (correct/incorrect):
<div aria-live="assertive" aria-atomic="true">
  {feedback}  {/* "Correct! +10 XP" or "Incorrect. The answer was France" */}
</div>
```

### 5. Focus Management in Modals

```jsx
// SwipeableModal: trap focus + restore on close
useEffect(() => {
  if (!isOpen) return;
  const trap = createFocusTrap(modalRef.current, {
    returnFocusOnDeactivate: true,
    escapeDeactivates: true,
  });
  trap.activate();
  return () => trap.deactivate();
}, [isOpen]);
```

Use `focus-trap` library (~2 KB gzipped) or implement manually.

### 6. Form Labels

Settings inputs, note fields, date pickers — ensure all have associated `<label>` elements or `aria-labelledby`:
```jsx
// BAD:
<input type="text" placeholder="Add a note..." />

// GOOD:
<label htmlFor="region-note">Note for this region</label>
<input id="region-note" type="text" placeholder="Add a note..." />
```

### 7. Leaflet Map Accessibility

Leaflet has limited built-in accessibility. Add:
- `role="application"` on the map container with `aria-label="Interactive world map — use keyboard shortcuts to navigate"`
- A hidden `<table>` or `<ul>` with country list as a screen-reader alternative (`visually-hidden` class)
- Tooltip content announced via `aria-live` on hover/focus

### 8. Skip Links

Add a "Skip to main content" link as the first focusable element in the page:
```jsx
<a href="#main-content" className="skip-link">Skip to main content</a>
```

## Testing Tools

- `axe-core` + `@axe-core/react` in development — logs violations to console
- Lighthouse accessibility audit in CI
- Manual testing with VoiceOver (macOS/iOS) and NVDA (Windows)
- Keyboard-only navigation test (unplug mouse)

Add to `vitest` tests:
```js
import { axe } from 'jest-axe';
// test: render component, run axe, expect no violations
```

## Implementation Phases

### Phase 1 — Automated audit + quick wins
- [ ] Add `axe-core` to dev dependencies, run against all major screens
- [ ] Fix all icon-only button `aria-label` attributes
- [ ] Add skip link
- [ ] Fix `role="tablist"` on BottomTabBar
- [ ] Add `aria-live` regions for toasts and game feedback

### Phase 2 — Color contrast
- [ ] Run Lighthouse contrast audit
- [ ] Fix text-on-background contrast for gold palette (darken text uses of gold)
- [ ] Verify dark mode contrast
- [ ] Update CSS custom properties in `App.css`

### Phase 3 — Focus management
- [ ] `utils/focusTrap.js` or install `focus-trap`
- [ ] Apply to `SwipeableModal`, `MobileBottomSheet`, `ConfirmDialog`
- [ ] Verify focus restoration on modal close

### Phase 4 — Keyboard navigation
- [ ] Map keyboard controls (pan + toggle)
- [ ] Game keyboard shortcuts (1–4 to select answer)
- [ ] Tab order audit across all screens

### Phase 5 — Forms + labels
- [ ] Audit all inputs without explicit labels
- [ ] Fix note fields, date pickers, color picker, settings toggles
- [ ] Add `axe` assertions to component tests

## Notes

- Screen readers on mobile (VoiceOver, TalkBack) are increasingly used — test both
- The map is inherently mouse/touch-centric. The screen-reader alternative (hidden country list) is the pragmatic approach — a fully keyboard-navigable SVG map is a much larger project
- `prefers-reduced-motion` is already handled — that's the hardest animation a11y issue solved
