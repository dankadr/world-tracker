# Mobile UI/UX Improvement — Approach B Design

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Gesture fixes + color system rework

## Problem Statement

On mobile the app has several friction points that make it feel like a web page rather than a native app:

1. **No-exit trap in challenges** — opening a challenge detail stacks a modal with no swipe-to-dismiss; the only exit is the small `×` button, and if it's out of reach users are stuck until they refresh.
2. **Same problem in Friends, BucketList, ComparisonStats modals** — `useSwipeToDismiss` exists and works in Achievements but was never applied to these panels.
3. **Challenge target regions show raw IDs** — region codes like `"ZH"` or `"NY"` are shown instead of friendly names like "Zurich" or "New York".
4. **Color palette feels cold** — the blue-grey glassmorphism is fine but doesn't match a warm travel app aesthetic. Dark mode also uses cold greys.

## Approach

iOS-style polish: swipe-down-to-dismiss everywhere, warm sand/cream glassmorphism for both light and dark modes, and proper region name display in challenges.

---

## Section 1 — Gesture Fixes

### SwipeableModal wrapper

Create `src/components/SwipeableModal.jsx` — a thin wrapper that encapsulates the `modal-overlay → modal-content + swipe-to-dismiss` pattern. Accepts `onClose`, `children`, `maxWidth`, `height`.

Replace the three inline modal blocks in `App.jsx`:
- Friends panel modal
- BucketList panel modal
- ComparisonStats modal

### ChallengeDetailModal

Add `useSwipeToDismiss(onClose)` directly inside the component:
- `handleRef` → attached to `.ch-detail-modal`
- `dragHandlers` → spread onto `.ch-detail-header`

### ChallengeCreateModal

Same treatment as ChallengeDetailModal.

### Files changed

| File | Change |
|------|--------|
| `src/components/SwipeableModal.jsx` | New component |
| `src/App.jsx` | Replace Friends/BucketList/ComparisonStats modal divs with `<SwipeableModal>` |
| `src/components/ChallengeDetailModal.jsx` | Add swipe-to-dismiss hook |
| `src/components/ChallengeCreateModal.jsx` | Add swipe-to-dismiss hook |

---

## Section 2 — Challenge Target Regions

### Problem

`ChallengeDetailModal` renders `challenge.target_regions` as raw IDs (`"ZH"`, `"NY"`) not human names. When `target_regions[0] === '*'` (all regions), nothing is shown at all.

### Fix

- Import `countries` from `../data/countries` in `ChallengeDetailModal.jsx`
- Build a `regionMap`: `{ [regionId]: regionName }` from `countries[challenge.tracker_id]?.data.features`
- Render `regionMap[r] || r` in target tag chips
- For `*`: render a single "All regions" badge instead of nothing

### Files changed

| File | Change |
|------|--------|
| `src/components/ChallengeDetailModal.jsx` | Import countries, build regionMap, fix display |

---

## Section 3 — Warm Color Palette

### Light mode

All changes are CSS variable swaps in `App.css` `:root`:

| Variable | Current | New |
|----------|---------|-----|
| `--body-bg` | `linear-gradient(135deg, #dfe9f3, #c4d7e6, #b8c9db)` | `linear-gradient(135deg, #f5ede0, #eddfd0, #e2d2c0)` |
| `--glass-bg` | `rgba(255,255,255, 0.22)` | `rgba(255,248,240, 0.22)` |
| `--glass-bg-heavy` | `rgba(255,255,255, 0.38)` | `rgba(255,248,240, 0.42)` |
| `--glass-bg-subtle` | `rgba(255,255,255, 0.12)` | `rgba(255,248,240, 0.12)` |
| `--glass-border` | `rgba(255,255,255, 0.35)` | `rgba(255,235,210, 0.40)` |
| `--glass-border-subtle` | `rgba(255,255,255, 0.18)` | `rgba(255,235,210, 0.22)` |
| `--glass-highlight` | `rgba(255,255,255, 0.6)` | `rgba(255,248,240, 0.65)` |
| `--text-primary` | `#1a1a2e` | `#2c1f14` |
| `--text-secondary` | `#4a5568` | `#5a4030` |
| `--text-tertiary` | `#718096` | `#8a6a50` |
| `--text-muted` | `#a0aec0` | `#b09070` |
| `--text-on-glass` | `#2d3748` | `#3a2c20` |
| `--bar-track` | `rgba(0,0,0, 0.08)` | `rgba(100,60,20, 0.08)` |
| `--divider` | `rgba(255,255,255, 0.25)` | `rgba(200,170,140, 0.30)` |
| `--input-bg` | `rgba(255,255,255, 0.30)` | `rgba(255,248,240, 0.35)` |
| `--hover-bg` | `rgba(255,255,255, 0.18)` | `rgba(255,248,240, 0.22)` |

### Dark mode

Update the `[data-theme="dark"]` block in `App.css`:

| Variable | Current | New |
|----------|---------|-----|
| `--body-bg` | cold dark grey gradient | `linear-gradient(135deg, #1c1510, #251a12, #2a1f15)` |
| `--glass-bg` | cold dark glass | `rgba(60,40,20, 0.35)` |
| `--glass-bg-heavy` | cold dark glass heavy | `rgba(70,48,25, 0.50)` |
| `--glass-bg-subtle` | cold dark glass subtle | `rgba(60,40,20, 0.20)` |
| Text colors | cold greys | warm cream tones |

### What doesn't change

- Per-tracker accent colors (`#2ecc71`, `#3498db`, `#e74c3c`, etc.) — they pop even better on warm backgrounds
- Glass blur values, shadow values, specular highlights
- Font stack, sizing, spacing

### Files changed

| File | Change |
|------|--------|
| `src/App.css` | Update `:root` and `[data-theme="dark"]` CSS variables |

---

## Non-goals

- No layout changes to desktop
- No restructuring of the bottom sheet snap points
- No changes to the map components
- No new navigation patterns (saved for Approach C)
