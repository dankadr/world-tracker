# ToDo: Fix Map Quiz + Shape Quiz Blank Screen on Mobile

**Date:** 2026-03-17
**Status:** Open
**Priority:** Critical
**Scope:** Geography mini-games mobile rendering and interaction stability

---

## Bug Report

### Issue
On mobile devices, both **Map Quiz** and **Shape Quiz** can open to a blank state where no playable content is visible.

### Affected Areas
- Map Quiz mini-game
- Shape Quiz mini-game
- Primarily mobile viewport sizes (phones)

### User Impact
- Users cannot start or continue quizzes on mobile.
- Mini-game experience appears broken, leading to likely drop-off.

### Initial Hypotheses
1. **Viewport/container sizing bug**
   - Quiz container height may collapse to `0` or be clipped by parent wrappers (`vh` + fixed headers/bottom sheets on mobile).
2. **Conditional render guard failing on mobile**
   - Data/loading flags may never reach “ready” state due to lifecycle timing differences on smaller devices.
3. **Layer/z-index overlap**
   - Overlay components (sheet/modal/toast) may cover the quiz canvas/map, making content appear missing.
4. **Map/canvas initialization timing**
   - Map or shape renderer may initialize before container dimensions are measurable on mobile.

---

## Fix Plan

### Phase 1 — Reproduce + Instrument
1. Reproduce on mobile emulation and at least one real phone.
2. Add temporary logs for:
   - quiz component mount/unmount,
   - container width/height at init,
   - data ready flags,
   - map/canvas initialization status.
3. Capture screenshots/video of blank state with console logs.

### Phase 2 — Root Cause Isolation
1. Verify computed layout of wrappers (height, overflow, position, z-index).
2. Confirm map/shape components re-render after container becomes visible.
3. Validate loading state transitions for quiz data pipeline.
4. Check for mobile-only CSS media query side effects.

### Phase 3 — Implementation
1. Ensure quiz root has stable mobile-safe height (prefer `100dvh` fallback strategy).
2. Trigger map/canvas resize/invalidate once container dimensions are non-zero.
3. Harden conditional rendering with explicit fallback/loading/error UI.
4. Resolve overlap issues by adjusting stacking context and pointer events.

### Phase 4 — Verification
1. Test both quizzes on:
   - iOS Safari (portrait + landscape)
   - Android Chrome (portrait + landscape)
   - desktop responsive emulator.
2. Confirm no blank state across route transitions and app resume.
3. Confirm no regressions in desktop quiz behavior.

### Phase 5 — Guardrails
1. Add a small Playwright mobile smoke test:
   - open each quiz,
   - assert main quiz container is visible and non-zero size.
2. Add runtime warning (development only) if quiz container initializes at zero height.

---

## Acceptance Criteria
- Map Quiz displays playable UI on supported mobile devices.
- Shape Quiz displays playable UI on supported mobile devices.
- No blank state after entering/leaving quiz repeatedly.
- Mobile smoke test added and passing in CI.

## Owner
- Unassigned
