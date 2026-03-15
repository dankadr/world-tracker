# ToDo: Fix Mobile Blank Screen in Map Quiz + Shape Quiz

**Date:** 2026-03-15
**Status:** Open
**Priority:** Critical
**Owner:** Unassigned

---

## Bug Summary

On mobile devices, both **Map Quiz** and **Shape Quiz** show the game chrome (header/top bar/prompt) but the playable area is blank. Users cannot interact with the quiz, making both game modes unusable on mobile.

## Reproduction

1. Open the app on a mobile device (reported on iPhone).
2. Navigate to Geography Games.
3. Start **Map Quiz** or **Shape Quiz**.
4. Observe that the question/top controls render, but no map/shape content appears in the game area.

## Expected vs Actual

- **Expected:** The map/shape target renders and is tappable so users can answer.
- **Actual:** Blank game canvas/area with no interactive content.

## Initial Hypotheses

1. **Container sizing issue on mobile viewport**
   - Quiz content may depend on a parent height that collapses on iOS (e.g., `100vh`, flex child without `min-height: 0`, or fixed-position stacking).
2. **Layering/z-index overlap**
   - A background/overlay layer may be covering the quiz canvas or SVG on mobile breakpoints.
3. **Map/SVG initialization timing**
   - Quiz drawing logic may initialize before container dimensions are available on mobile and never rerender.
4. **Pointer/touch-only rendering path mismatch**
   - Code path may rely on desktop pointer assumptions and skip interactive render on touch devices.

## Fix Plan

### Phase 1 — Investigate and confirm root cause

- Add temporary console instrumentation in:
  - `src/components/games/MapQuiz.jsx`
  - `src/components/games/ShapeQuiz.jsx`
  - `src/components/games/games.css`
- Verify on mobile viewport:
  - container computed width/height
  - whether SVG/map nodes mount
  - whether data for current question exists
  - whether an overlay element blocks visibility/interactions

### Phase 2 — Implement robust mobile-safe layout/rendering

- Ensure game viewport has reliable height on mobile:
  - replace fragile `100vh` assumptions with safe viewport units where needed (`100dvh` fallback strategy)
  - ensure flex children that host map/SVG use `min-height: 0` and explicit growth
- Guard render initialization:
  - if container size is `0`, defer render until dimensions are valid
  - trigger rerender on resize/orientation change
- Validate stacking context:
  - ensure map/SVG layer sits above background and below controls as intended

### Phase 3 — Regression tests + QA

- Add/update tests for both quizzes:
  - component-level test to assert playable layer exists after mount
  - test for mobile-sized container dimensions
- Manual QA matrix:
  - iOS Safari (portrait + landscape)
  - Android Chrome
  - desktop sanity check

## Definition of Done

- Map Quiz and Shape Quiz both show visible, interactive quiz content on mobile.
- No regressions in desktop behavior.
- Tests covering the blank-render regression are added and passing.
- Bug entry in `ToDos/04-bug-fixes.md` is linked and status can be updated to **Fixed** once merged.
