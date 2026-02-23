# Mobile UI/UX Approach B Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add swipe-to-dismiss to all mobile modals, fix challenge target region display, and replace the cold blue-grey palette with warm sand/cream glassmorphism.

**Architecture:** `useSwipeToDismiss` (already exists at `src/hooks/useSwipeToDismiss.js`) is added to a new reusable `SwipeableModal` wrapper component plus wired directly into the two challenge modals. Color changes are pure CSS variable swaps in `App.css`. No routing, no layout restructure.

**Tech Stack:** React 18, Vite, plain CSS (no CSS-in-JS). No test runner — verification is visual in `npm run dev` on mobile viewport in browser devtools.

---

## Quick Reference

- Dev server: `npm run dev` (port 5173)
- To simulate mobile: browser devtools → toggle device toolbar → iPhone 14 Pro (390×844)
- `useSwipeToDismiss` API: returns `{ handleRef, dragHandlers }`. Put `ref={handleRef}` on the modal content div. Spread `{...dragHandlers}` on the element the user drags (the header or drag strip). Swiping down >30% of modal height calls `onDismiss`.

---

## Task 1: SwipeableModal wrapper component

A reusable component that replaces the boilerplate `modal-overlay → modal-content` pattern in App.jsx and adds swipe-to-dismiss automatically.

**Files:**
- Create: `src/components/SwipeableModal.jsx`

**Step 1: Create the file**

```jsx
// src/components/SwipeableModal.jsx
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';

/**
 * SwipeableModal — drop-in replacement for the modal-overlay + modal-content
 * pattern used in App.jsx. Adds swipe-down-to-dismiss on mobile automatically.
 *
 * Usage:
 *   <SwipeableModal onClose={handleClose} height="80vh" maxWidth={420}>
 *     <MyPanel onClose={handleClose} />
 *   </SwipeableModal>
 */
export default function SwipeableModal({ onClose, children, maxWidth = 420, height = '80vh', className = '' }) {
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${className}`}
        ref={handleRef}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth, height }}
      >
        <div className="swipeable-drag-strip" {...dragHandlers}>
          <div className="drag-handle" />
        </div>
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Add the `.swipeable-drag-strip` CSS**

Open `src/App.css`. Find the `.drag-handle` block (around line 1694). Add the strip rule directly above it:

```css
/* Swipeable modal drag strip — appears above panel content on mobile */
.swipeable-drag-strip {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0 2px;
  cursor: grab;
  touch-action: none;
}
```

**Step 3: Verify the file exists and has no syntax errors**

```bash
node --input-type=module < src/components/SwipeableModal.jsx 2>&1 || echo "check vite instead"
npm run build -- --mode development 2>&1 | head -20
```

Expected: no errors (Vite can parse the file).

**Step 4: Commit**

```bash
git add src/components/SwipeableModal.jsx src/App.css
git commit -m "feat: add SwipeableModal wrapper with swipe-to-dismiss"
```

---

## Task 2: Replace modal blocks in App.jsx

Replace the three inline `modal-overlay` blocks in `App.jsx` (Friends, BucketList, ComparisonStats) with `<SwipeableModal>`.

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add the import**

At the top of `src/App.jsx`, after the existing imports (around line 20), add:

```jsx
import SwipeableModal from './components/SwipeableModal';
```

**Step 2: Replace the Friends modal block**

Find this block (around line 777–791):

```jsx
{showFriends && (
  isMobile ? (
    <div className="modal-overlay" onClick={handleCloseFriends}>
      <div className="modal-content friends-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, height: '80vh' }}>
        <FriendsPanel onClose={handleCloseFriends} onCompare={handleCompare} comparisonFriendId={comparisonFriend?.id} />
      </div>
    </div>
  ) : (
    <div className="modal-overlay" onClick={handleCloseFriends}>
      <div className="modal-content friends-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, height: '70vh' }}>
        <FriendsPanel onClose={handleCloseFriends} onCompare={handleCompare} comparisonFriendId={comparisonFriend?.id} />
      </div>
    </div>
  )
)}
```

Replace with:

```jsx
{showFriends && (
  <SwipeableModal
    onClose={handleCloseFriends}
    className="friends-modal"
    height={isMobile ? '80vh' : '70vh'}
  >
    <FriendsPanel onClose={handleCloseFriends} onCompare={handleCompare} comparisonFriendId={comparisonFriend?.id} />
  </SwipeableModal>
)}
```

**Step 3: Replace the BucketList modal block**

Find (around line 792–800):

```jsx
{showBucketList && (
  <div className="modal-overlay" onClick={() => setShowBucketList(false)}>
    <div className="modal-content bucket-panel-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, height: '80vh' }}>
      <BucketListPanel
        items={bucketListItems}
        onUpdate={updateBucketItem}
        onDelete={handleDeleteBucketItem}
        onMarkVisited={handleMarkVisitedBucketList}
        onClose={() => setShowBucketList(false)}
      />
    </div>
  </div>
)}
```

Replace with:

```jsx
{showBucketList && (
  <SwipeableModal
    onClose={() => setShowBucketList(false)}
    className="bucket-panel-modal"
    maxWidth={620}
    height="80vh"
  >
    <BucketListPanel
      items={bucketListItems}
      onUpdate={updateBucketItem}
      onDelete={handleDeleteBucketItem}
      onMarkVisited={handleMarkVisitedBucketList}
      onClose={() => setShowBucketList(false)}
    />
  </SwipeableModal>
)}
```

**Step 4: Replace the ComparisonStats modal block**

Find (around line 805–815):

```jsx
{showComparisonStats && comparisonFriend && (
  <ComparisonStats
    ...
  />
)}
```

`ComparisonStats` renders its own `modal-overlay` internally — check if it does. If it does, leave it alone. If it doesn't (i.e., it just renders a plain div), wrap it the same way. To check:

```bash
grep -n "modal-overlay\|modal-content" src/components/ComparisonStats.jsx | head -5
```

If it has its own overlay: skip this step. If not, wrap it:

```jsx
{showComparisonStats && comparisonFriend && (
  <SwipeableModal onClose={() => setShowComparisonStats(false)} height="90vh">
    <ComparisonStats
      myVisited={isWorldView ? worldVisited : visited}
      friendVisited={isWorldView ? comparisonFriend.visited : new Set(comparisonFriend.visitedRegions || [])}
      total={isWorldView ? worldData.features.length : country.data.features.filter((f) => !f.properties.isBorough).length}
      friendName={comparisonFriend.name}
      friendPicture={comparisonFriend.picture}
      regionLabel={isWorldView ? 'Countries' : country.regionLabel}
      onClose={() => setShowComparisonStats(false)}
    />
  </SwipeableModal>
)}
```

**Step 5: Verify in browser**

```bash
npm run dev
```

Open http://localhost:5173 in browser devtools with iPhone 14 Pro viewport. Open Friends panel. Try swiping down on the drag handle pill at the top — should dismiss. Try tapping the overlay background — should dismiss.

**Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: use SwipeableModal for Friends, BucketList, ComparisonStats panels"
```

---

## Task 3: Swipe-to-dismiss in ChallengeDetailModal

**Files:**
- Modify: `src/components/ChallengeDetailModal.jsx`

**Step 1: Add the import**

At the top of `src/components/ChallengeDetailModal.jsx` (currently line 1 is just a CSS import):

```jsx
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
```

**Step 2: Wire the hook inside the component**

The component signature is on line 39: `export default function ChallengeDetailModal({ challenge, loading, userId, onClose, ... })`.

Add this line right at the top of the function body (before any other logic):

```jsx
const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);
```

**Step 3: Attach handleRef to the modal content div**

Find (line 57):
```jsx
<div className="modal-content ch-detail-modal" onClick={(e) => e.stopPropagation()}>
```

Change to:
```jsx
<div className="modal-content ch-detail-modal" ref={handleRef} onClick={(e) => e.stopPropagation()}>
```

**Step 4: Spread dragHandlers on the header**

Find (line 58):
```jsx
<div className="ch-detail-header">
```

Change to:
```jsx
<div className="ch-detail-header" {...dragHandlers}>
```

**Step 5: Verify in browser**

Open a challenge on mobile viewport. Try swiping down on the challenge detail header — panel should dismiss. The `×` button should still work too.

**Step 6: Commit**

```bash
git add src/components/ChallengeDetailModal.jsx
git commit -m "feat: add swipe-to-dismiss to ChallengeDetailModal"
```

---

## Task 4: Swipe-to-dismiss in ChallengeCreateModal

Same pattern as Task 3.

**Files:**
- Modify: `src/components/ChallengeCreateModal.jsx`

**Step 1: Add the import**

After the existing imports at the top of `src/components/ChallengeCreateModal.jsx`:

```jsx
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
```

**Step 2: Add hook call inside component**

Inside `export default function ChallengeCreateModal({ onClose, onCreate })`, add as first line of function body:

```jsx
const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);
```

**Step 3: Attach to modal divs**

Find (around line 79–81):
```jsx
<div className="modal-overlay" onClick={onClose}>
  <div className="modal-content ch-create-modal" onClick={(e) => e.stopPropagation()}>
    <div className="ch-create-header">
```

Change the inner two divs:
```jsx
<div className="modal-overlay" onClick={onClose}>
  <div className="modal-content ch-create-modal" ref={handleRef} onClick={(e) => e.stopPropagation()}>
    <div className="ch-create-header" {...dragHandlers}>
```

**Step 4: Verify in browser**

Open "Create Challenge" on mobile viewport. Swipe down on the header — should dismiss.

**Step 5: Commit**

```bash
git add src/components/ChallengeCreateModal.jsx
git commit -m "feat: add swipe-to-dismiss to ChallengeCreateModal"
```

---

## Task 5: Fix challenge target region names

**Files:**
- Modify: `src/components/ChallengeDetailModal.jsx`

**Context:** `ChallengeDetailModal` already receives `challenge.tracker_id` (e.g., `"ch"`, `"us"`) and `challenge.target_regions` (array of region IDs like `["ZH", "BE"]` or `["*"]`). The `countries` object from `src/data/countries.js` has GeoJSON features for each tracker; each feature has `properties.id` and `properties.name`.

**Step 1: Import countries data**

`ChallengeCreateModal` already imports from `../data/countries` — use the same import. At the top of `src/components/ChallengeDetailModal.jsx`, add after the CSS import:

```jsx
import countries from '../data/countries';
```

**Step 2: Build the regionMap inside the component**

Inside `export default function ChallengeDetailModal(...)`, after the existing variable declarations (after line 52 `const collabPct = ...`), add:

```jsx
// Build a lookup from region ID → display name for this tracker
const regionMap = {};
if (challenge.tracker_id && challenge.tracker_id !== 'world') {
  const features = countries[challenge.tracker_id]?.data?.features || [];
  features.forEach((f) => {
    if (f.properties?.id && f.properties?.name) {
      regionMap[f.properties.id] = f.properties.name;
    }
  });
}
```

**Step 3: Update the target regions render block**

Find the existing target regions section (around line 113–128):

```jsx
{challenge.target_regions && challenge.target_regions[0] !== '*' && (
  <div className="ch-targets-section">
    <h4 className="ch-section-label">Target Regions ({challenge.target_regions.length})</h4>
    <div className="ch-targets-list">
      {challenge.target_regions.map((r) => {
        const visitedByAnyone = participants.some((p) => p.visited_regions?.includes(r));
        return (
          <span key={r} className={`ch-target-tag ${visitedByAnyone ? 'visited' : ''}`}>
            {r}
          </span>
        );
      })}
    </div>
  </div>
)}
```

Replace with:

```jsx
{challenge.target_regions && (
  <div className="ch-targets-section">
    {challenge.target_regions[0] === '*' ? (
      <>
        <h4 className="ch-section-label">Target Regions</h4>
        <div className="ch-targets-list">
          <span className="ch-target-tag ch-target-all">All regions</span>
        </div>
      </>
    ) : (
      <>
        <h4 className="ch-section-label">Target Regions ({challenge.target_regions.length})</h4>
        <div className="ch-targets-list">
          {challenge.target_regions.map((r) => {
            const visitedByAnyone = participants.some((p) => p.visited_regions?.includes(r));
            return (
              <span key={r} className={`ch-target-tag ${visitedByAnyone ? 'visited' : ''}`}>
                {regionMap[r] || r}
              </span>
            );
          })}
        </div>
      </>
    )}
  </div>
)}
```

**Step 4: Add CSS for the "All regions" tag variant**

In `src/components/ChallengesPanel.css`, find the `.ch-target-tag` rule and add below it:

```css
.ch-target-tag.ch-target-all {
  background: rgba(52, 152, 219, 0.15);
  border-color: rgba(52, 152, 219, 0.3);
  color: #2980b9;
  font-style: italic;
}
```

**Step 5: Verify in browser**

Open a challenge that has specific target regions. Region codes like "ZH" should now show "Zurich". Challenges with `*` should show "All regions" badge. For world tracker challenges (no tracker_id match), IDs fall back gracefully with `regionMap[r] || r`.

**Step 6: Commit**

```bash
git add src/components/ChallengeDetailModal.jsx src/components/ChallengesPanel.css
git commit -m "feat: show friendly region names in challenge target regions"
```

---

## Task 6: Warm palette — light mode

**Files:**
- Modify: `src/App.css` (lines 1–29, the `:root` block)

**Step 1: Open App.css and locate the `:root` block**

It starts at line 1 with `/* ======== Liquid Glass Design System ======== */` and the `:root {` block ends around line 29.

**Step 2: Replace the variable values**

The entire new `:root` block (replace lines 1–29):

```css
/* ======== Liquid Glass Design System ======== */
:root {
  --glass-bg: rgba(255, 248, 240, 0.22);
  --glass-bg-heavy: rgba(255, 248, 240, 0.42);
  --glass-bg-subtle: rgba(255, 248, 240, 0.12);
  --glass-border: rgba(255, 235, 210, 0.40);
  --glass-border-subtle: rgba(255, 235, 210, 0.22);
  --glass-highlight: rgba(255, 248, 240, 0.65);
  --glass-blur: 16px;
  --glass-blur-heavy: 24px;
  --glass-blur-light: 10px;
  --glass-shadow: 0 8px 32px rgba(80, 40, 10, 0.08);
  --glass-shadow-elevated: 0 12px 40px rgba(80, 40, 10, 0.12);
  --glass-specular: inset 1px 1px 0 rgba(255, 248, 240, 0.55),
                     inset 0 0 8px rgba(255, 248, 240, 0.18);
  --glass-specular-strong: inset 1px 1px 0 rgba(255, 248, 240, 0.75),
                            inset 0 0 12px rgba(255, 248, 240, 0.22);
  --glass-hover-glow: 0 0 20px rgba(255, 220, 180, 0.30);
  --body-bg: linear-gradient(135deg, #f5ede0 0%, #eddfd0 40%, #e2d2c0 100%);
  --text-primary: #2c1f14;
  --text-secondary: #5a4030;
  --text-tertiary: #8a6a50;
  --text-muted: #b09070;
  --text-on-glass: #3a2c20;
  --bar-track: rgba(100, 60, 20, 0.08);
  --divider: rgba(200, 170, 140, 0.30);
  --input-bg: rgba(255, 248, 240, 0.35);
  --hover-bg: rgba(255, 248, 240, 0.22);
}
```

**Step 3: Verify visually**

```bash
npm run dev
```

Open http://localhost:5173. The background should be warm sand (cream/beige) instead of blue-grey. Glass panels should have a warm tint. Text should be warm dark brown.

Check: the map still looks fine, region colors (green/blue/red) still visible and pop nicely.

**Step 4: Commit**

```bash
git add src/App.css
git commit -m "feat: update light mode to warm sand glassmorphism palette"
```

---

## Task 7: Warm palette — dark mode

**Files:**
- Modify: `src/App.css` (the `[data-theme="dark"]` block, around lines 1231–1256)

**Step 1: Replace the dark mode variable block**

Find the block starting with `/* ======== Dark Mode ======== */` and `[data-theme="dark"] {` (around line 1231). Replace only the variable block (keep all the rules that follow it unchanged):

```css
/* ======== Dark Mode ======== */
[data-theme="dark"] {
  --glass-bg: rgba(60, 38, 18, 0.42);
  --glass-bg-heavy: rgba(70, 46, 22, 0.62);
  --glass-bg-subtle: rgba(55, 34, 15, 0.28);
  --glass-border: rgba(180, 130, 80, 0.18);
  --glass-border-subtle: rgba(160, 110, 60, 0.12);
  --glass-highlight: rgba(255, 220, 170, 0.10);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.40);
  --glass-shadow-elevated: 0 12px 40px rgba(0, 0, 0, 0.50);
  --glass-specular: inset 1px 1px 0 rgba(255, 220, 170, 0.12),
                     inset 0 0 8px rgba(255, 200, 140, 0.05);
  --glass-specular-strong: inset 1px 1px 0 rgba(255, 220, 170, 0.16),
                            inset 0 0 12px rgba(255, 200, 140, 0.07);
  --glass-hover-glow: 0 0 20px rgba(200, 140, 60, 0.15);
  --body-bg: linear-gradient(135deg, #1c1510 0%, #251a12 40%, #2a1f15 100%);
  --text-primary: #f0e6d8;
  --text-secondary: #c8b09a;
  --text-tertiary: #a08060;
  --text-muted: #7a6048;
  --text-on-glass: #e8dcc8;
  --bar-track: rgba(255, 200, 140, 0.10);
  --divider: rgba(180, 130, 80, 0.18);
  --input-bg: rgba(60, 38, 18, 0.45);
  --hover-bg: rgba(80, 50, 22, 0.35);
}
```

**Step 2: Verify visually**

Toggle dark mode (🌙 button in the header). Background should be warm dark charcoal/brown, not cold navy. Text should read warm cream, not cold white.

Check: achievement cards, leaderboard rows, friends panel all still readable in dark mode.

**Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat: update dark mode to warm charcoal glassmorphism palette"
```

---

## Task 8: Final verification pass

**Step 1: Run dev server and do a full mobile walkthrough**

```bash
npm run dev
```

Checklist in iPhone 14 Pro devtools viewport:

- [ ] Open Friends panel → swipe down on drag handle → dismisses
- [ ] Open BucketList panel → swipe down → dismisses
- [ ] Open Friends → tap Challenges tab → tap a challenge → ChallengeDetailModal opens
- [ ] Swipe down on challenge detail header → dismisses (no more refresh needed!)
- [ ] Open "Create Challenge" → swipe down → dismisses
- [ ] Challenge with specific target regions → shows region names, not IDs
- [ ] Challenge with all regions (`*`) → shows "All regions" badge
- [ ] Light mode background is warm sand, not blue-grey
- [ ] Toggle dark mode → warm charcoal, not cold navy
- [ ] Map and region colors (green/blue/red) still pop on both themes

**Step 2: Build check**

```bash
npm run build
```

Expected: no errors, build succeeds.

**Step 3: Commit if anything was missed**

```bash
git add -A
git status  # review what's staged before committing
git commit -m "fix: final cleanup for mobile UX and warm palette"
```
