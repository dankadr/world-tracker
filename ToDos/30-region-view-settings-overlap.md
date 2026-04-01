# Bug: Settings Section Covers Achievements in Region View (Desktop)

**Date:** 2026-03-25
**Status:** Needs re-verification — PR #143 targeted this layout bug, but the current repo still lacks explicit evidence it stays fixed across desktop breakpoints
**Priority:** High

---

## Problem
On desktop, when viewing a specific region (e.g., Swiss cantons), the settings panel/section overlaps and covers:
- Achievements display
- Country scroll list/progress section

This makes it impossible to see achievements or other regional data without closing/resizing the settings.

## Expected Behavior
- Settings panel is positioned/sized so it doesn't cover achievements or scroll lists
- All three sections (settings, achievements, country progress) are visible and accessible on desktop
- Layout responds properly to different screen sizes

## Actual Behavior
- Settings section overlaps achievements area
- Country progress scroll area is hidden under settings
- User must close settings to see achievements

## Investigation Areas
1. Check region view layout (likely `RegionView.jsx` or similar)
2. Check CSS grid/flex layout for desktop breakpoint
3. Check settings panel positioning (fixed/absolute/relative)
4. Check z-index values and stacking context

## Related
- Possibly related to #102 (tab scroll + dark mode) if layout changed

## Current Repo Status

- PR #143 moved Settings out of the scrollable region list and aimed to keep it accessible
- Desktop settings still live inside the region sidebar layout rather than in a separate route/shell
- Keep this open until desktop region views are manually verified at standard breakpoints

## Test Plan
- [ ] Desktop view of Swiss region → settings, achievements, country list all visible
- [ ] Resize window → layout reflows correctly
- [ ] No overlap at standard desktop sizes (1024px, 1440px, 2560px)
