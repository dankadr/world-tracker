# Year Summary + Shareable Cards Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Year in Review to match the Navy & Gold theme and add shareable PNG image cards (portrait + square) for both yearly recaps and all-time stats.

**Architecture:** A new `ShareCard` component (React.forwardRef) renders off-screen at fixed pixel dimensions so `html2canvas` can capture it as a PNG. A new `computeAllTimeStats` utility aggregates all-time data from localStorage. Both `YearInReview` and `ProfileScreen` get a two-step share flow: "Share" button → format picker → capture → download.

**Tech Stack:** React 18, Vite, html2canvas (already installed), localStorage for data

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/allTimeStats.js` | Create | Pure utility: computes worldCountries, totalRegions, continentsVisited, achievements |
| `src/components/ShareCard.jsx` | Create | Presentational card rendered off-screen; `React.forwardRef`; yearly + alltime variants; portrait + square formats |
| `src/components/ShareCard.css` | Create | Fixed pixel dimensions (portrait 450×800, square 600×600); off-screen absolute positioning |
| `src/components/YearInReviewCard.jsx` | Modify | Update summary card to use gold-bordered stat boxes matching approved mockup |
| `src/components/YearInReview.css` | Modify | Add format picker + share button styles; update summary stat box styles |
| `src/components/YearInReview.jsx` | Modify | Replace `handleShare` with format-picker flow + off-screen ShareCard capture |
| `src/components/ProfileScreen.jsx` | Modify | Add allTimeStats computation + share button + off-screen ShareCard capture in ProfileTab |
| `src/components/ProfileScreen.css` | Modify | Add `.profile-share-btn` and `.profile-share-picker` styles |

---

## Chunk 1: Data Utility + ShareCard Component

### Task 1: `allTimeStats.js` utility

**Files:**
- Create: `src/utils/allTimeStats.js`

Context: Follow the exact same localStorage patterns as `src/utils/yearStats.js`. `storagePrefix(userId)` returns `'swiss-tracker-u{id}-'` for logged-in users or `'swiss-tracker-'` for anonymous. `countryList` is from `src/data/countries.js`. `continentMap` is imported from `src/config/continents.json` (maps ISO country code → continent name). `getAchievements(userId)` is from `src/data/achievements.js` — it returns objects with a `.check()` function (not an `.unlocked` boolean), so use `.filter(a => a.check()).length`. Also exclude uninhabited continents (Antarctica etc.) using the same `INHABITED_CONTINENTS` set as `yearStats.js`.

- [ ] **Step 1: Create the file**

```js
import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import getAchievements from '../data/achievements';

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

// Only count inhabited continents (same set as yearStats.js)
const INHABITED_CONTINENTS = new Set([
  'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania',
]);

/**
 * Compute all-time aggregate stats across all trackers.
 * @param {string|null} userId
 * @returns {{ worldCountries: number, totalRegions: number, continentsVisited: number, achievements: number }}
 */
export function computeAllTimeStats(userId) {
  // World countries + continents
  let worldCountries = 0;
  const continentsSet = new Set();
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      const ids = Array.isArray(data) ? data : [];
      worldCountries = ids.length;
      ids.forEach(id => {
        const continent = continentMap[id];
        if (continent && INHABITED_CONTINENTS.has(continent)) continentsSet.add(continent);
      });
    }
  } catch { /* ignore */ }

  // Total visited regions across all trackers
  let totalRegions = 0;
  for (const c of countryList) {
    try {
      const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + c.id);
      if (raw) {
        const data = JSON.parse(raw);
        const ids = Array.isArray(data) ? data : Object.keys(data);
        totalRegions += ids.length;
      }
    } catch { /* ignore */ }
  }

  // Achievements unlocked — getAchievements returns objects with .check(), not .unlocked
  let achievements = 0;
  try {
    const all = getAchievements(userId);
    achievements = all.filter(a => a.check()).length;
  } catch { /* ignore */ }

  return {
    worldCountries,
    totalRegions,
    continentsVisited: continentsSet.size,
    achievements,
  };
}
```

- [ ] **Step 2: Verify in browser console**

Open the app in the browser. In the DevTools console, paste:
```js
// Temporary test — paste into console
import('/src/utils/allTimeStats.js').then(m => {
  console.log(m.computeAllTimeStats(null));
});
```
Expected: an object like `{ worldCountries: N, totalRegions: N, continentsVisited: N, achievements: N }` with numbers ≥ 0. No errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/allTimeStats.js
git commit -m "feat(share): add computeAllTimeStats utility"
```

---

### Task 2: `ShareCard` component

**Files:**
- Create: `src/components/ShareCard.jsx`
- Create: `src/components/ShareCard.css`

Context: This component renders off-screen (positioned absolute, left: -9999px, top: -9999px) so it's in the DOM but invisible. `html2canvas` targets the root div via a forwarded ref. Fixed dimensions: portrait = 450×800px, square = 600×600px. `html2canvas` with `scale: 2` produces 900×1600 and 1200×1200 respectively. No cross-origin assets — no need for `useCORS`/`allowTaint`.

The yearly card uses `stats` from `computeYearStats` (has: `year`, `totalRegions`, `trackersUsed`, `totalVisitDays`, `achievementsUnlocked`, `topTracker.flag/name/regionLabel/count`).

The alltime card uses `stats` from `computeAllTimeStats` (has: `worldCountries`, `totalRegions`, `continentsVisited`, `achievements`).

- [ ] **Step 1: Create `ShareCard.css`**

```css
/* Off-screen positioning — in DOM but not visible */
.share-card {
  position: fixed;
  left: -9999px;
  top: -9999px;
  background: linear-gradient(160deg, #0a1628 0%, #0d1f35 50%, #0a1628 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  font-family: 'Inter', system-ui, sans-serif;
  color: #fff;
  overflow: hidden;
}

.share-card-portrait {
  width: 450px;
  height: 800px;
  padding: 48px 36px 32px;
}

.share-card-square {
  width: 600px;
  height: 600px;
  padding: 40px 52px 32px;
}

/* Header: globe + brand */
.share-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0;
}

.share-card-globe {
  font-size: 32px;
  line-height: 1;
}

.share-card-brand {
  color: #c9a84c;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1.8px;
  text-transform: uppercase;
}

/* Yearly: large year number */
.share-card-year {
  font-size: 64px;
  font-weight: 900;
  color: #fff;
  line-height: 1;
  margin-top: 20px;
}

.share-card-square .share-card-year {
  font-size: 52px;
  margin-top: 14px;
}

.share-card-year-sub {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  margin-bottom: 20px;
}

/* All-time: title */
.share-card-title {
  font-size: 30px;
  font-weight: 800;
  color: #fff;
  margin-top: 20px;
  margin-bottom: 20px;
  text-align: center;
  line-height: 1.2;
}

.share-card-square .share-card-title {
  font-size: 26px;
}

/* Gold divider */
.share-card-divider {
  width: 75%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 168, 76, 0.7), transparent);
  margin-bottom: 24px;
  flex-shrink: 0;
}

/* 2×2 grid for portrait yearly, 4-in-a-row for square yearly */
.share-card-grid {
  display: grid;
  gap: 12px;
  width: 100%;
}

.share-card-grid-2x2 {
  grid-template-columns: 1fr 1fr;
}

.share-card-grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

.share-card-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 12px;
  padding: 18px 8px;
}

.share-card-square .share-card-stat {
  padding: 14px 8px;
}

.share-card-num {
  font-size: 36px;
  font-weight: 800;
  color: #c9a84c;
  line-height: 1;
}

.share-card-square .share-card-num {
  font-size: 30px;
}

.share-card-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 6px;
  text-align: center;
  line-height: 1.3;
}

/* Top tracker row (yearly only) */
.share-card-top-tracker {
  margin-top: 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
}

/* Row list for all-time card */
.share-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.share-card-list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 12px;
  padding: 14px 20px;
}

.share-card-square .share-card-list-row {
  padding: 12px 18px;
}

.share-card-list-label {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
}

.share-card-square .share-card-list-label {
  font-size: 14px;
}

.share-card-list-num {
  font-size: 26px;
  font-weight: 800;
  color: #c9a84c;
}

.share-card-square .share-card-list-num {
  font-size: 22px;
}

/* Footer */
.share-card-footer {
  margin-top: auto;
  padding-top: 16px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.5px;
}
```

- [ ] **Step 2: Create `ShareCard.jsx`**

```jsx
import { forwardRef } from 'react';
import './ShareCard.css';

const ShareCard = forwardRef(function ShareCard({ variant, format, stats }, ref) {
  const isPortrait = format === 'portrait';
  const isYearly = variant === 'yearly';

  return (
    <div
      ref={ref}
      className={`share-card share-card-${format}`}
    >
      {/* Header */}
      <div className="share-card-header">
        <span className="share-card-globe">🌍</span>
        <span className="share-card-brand">Right World</span>
      </div>

      {isYearly ? (
        <>
          <div className="share-card-year">{stats.year}</div>
          <div className="share-card-year-sub">Year in Review</div>
          <div className="share-card-divider" />

          {/* Stats grid: 2×2 for portrait, 4-across for square */}
          <div className={`share-card-grid ${isPortrait ? 'share-card-grid-2x2' : 'share-card-grid-4'}`}>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.totalRegions}</span>
              <span className="share-card-label">Regions</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.trackersUsed}</span>
              <span className="share-card-label">Trackers</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.totalVisitDays}</span>
              <span className="share-card-label">Days</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.achievementsUnlocked}</span>
              <span className="share-card-label">Badges{'\n'}(all time)</span>
            </div>
          </div>

          {stats.topTracker && (
            <div className="share-card-top-tracker">
              🏆 {stats.topTracker.flag} {stats.topTracker.name} · {stats.topTracker.count} {stats.topTracker.regionLabel.toLowerCase()}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="share-card-title">My Travel{'\n'}Journey</div>
          <div className="share-card-divider" />

          <div className="share-card-list">
            <div className="share-card-list-row">
              <span className="share-card-list-label">🌍 Countries</span>
              <span className="share-card-list-num">{stats.worldCountries}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">📍 Regions</span>
              <span className="share-card-list-num">{stats.totalRegions}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">🌐 Continents</span>
              <span className="share-card-list-num">{stats.continentsVisited}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">🎖️ Badges</span>
              <span className="share-card-list-num">{stats.achievements}</span>
            </div>
          </div>
        </>
      )}

      <div className="share-card-footer">rightworld.app</div>
    </div>
  );
});

export default ShareCard;
```

- [ ] **Step 3: Verify import works**

Run `npm run dev` (or it should already be running). Check the browser DevTools console for any import errors. No visual output expected yet — the card renders off-screen.

- [ ] **Step 4: Commit**

```bash
git add src/components/ShareCard.jsx src/components/ShareCard.css
git commit -m "feat(share): add ShareCard component (yearly + alltime, portrait + square)"
```

---

## Chunk 2: Year in Review + Profile Screen Integration

### Task 3: Year in Review theme update

**Files:**
- Modify: `src/components/YearInReviewCard.jsx` (lines 168–197, the `summary` case)
- Modify: `src/components/YearInReview.css` (lines 332–378, summary card section)

Context: Only the summary card needs visual changes to match the approved mockup (gold-bordered stat boxes with divider line). The other card types already use gold gradient numbers (`#c9a84c`/`#d4b866`) and navy background via `.yir-container`, so they're fine.

- [ ] **Step 1: Update the summary card in `YearInReviewCard.jsx`**

Replace the `case 'summary':` block (lines 168–197) with:

```jsx
case 'summary':
  return (
    <div className="yir-card yir-card-summary">
      <h2 className="yir-summary-title">{stats.year} Recap</h2>
      <div className="yir-summary-divider" />
      <div className="yir-summary-grid">
        <div className="yir-summary-stat">
          <span className="yir-summary-num">{stats.totalRegions}</span>
          <span className="yir-summary-label">Regions</span>
        </div>
        <div className="yir-summary-stat">
          <span className="yir-summary-num">{stats.trackersUsed}</span>
          <span className="yir-summary-label">Trackers</span>
        </div>
        <div className="yir-summary-stat">
          <span className="yir-summary-num">{stats.totalVisitDays}</span>
          <span className="yir-summary-label">Days</span>
        </div>
        <div className="yir-summary-stat">
          <span className="yir-summary-num">{stats.achievementsUnlocked}</span>
          <span className="yir-summary-label">Badges (all time)</span>
        </div>
      </div>
      {stats.topTracker && (
        <p className="yir-card-detail yir-summary-top-tracker">
          🏆 {stats.topTracker.flag} {stats.topTracker.name} · {stats.topTracker.count} {stats.topTracker.regionLabel.toLowerCase()}
        </p>
      )}
    </div>
  );
```

- [ ] **Step 2: Update summary card CSS in `YearInReview.css`**

Replace the `/* ===== Summary Card ===== */` block (lines 332–378) with:

```css
/* ===== Summary Card ===== */
.yir-summary-title {
  font-size: 28px;
  font-weight: 800;
  margin: 4px 0 16px;
  color: #fff;
}

.yir-summary-divider {
  width: 70%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 168, 76, 0.6), transparent);
  margin-bottom: 20px;
}

.yir-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 auto;
  max-width: 300px;
}

.yir-summary-stat {
  background: rgba(201, 168, 76, 0.08);
  border: 1px solid rgba(201, 168, 76, 0.22);
  border-radius: 14px;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: yir-fade-up 0.5s ease-out both;
}

.yir-summary-stat:nth-child(1) { animation-delay: 0.1s; }
.yir-summary-stat:nth-child(2) { animation-delay: 0.2s; }
.yir-summary-stat:nth-child(3) { animation-delay: 0.3s; }
.yir-summary-stat:nth-child(4) { animation-delay: 0.4s; }

.yir-summary-num {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, #c9a84c, #d4b866);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.yir-summary-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.yir-summary-top-tracker {
  margin-top: 16px;
}
```

- [ ] **Step 3: Fix achievement count bug in `yearStats.js`**

`src/utils/yearStats.js` line 140 has a pre-existing bug: `achievements.filter(a => a.unlocked)` always returns 0 because `getAchievements()` returns objects with a `.check()` method, not an `.unlocked` boolean.

Find line 140 and change:
```js
achievementsUnlocked = achievements.filter(a => a.unlocked).length;
```
to:
```js
achievementsUnlocked = achievements.filter(a => a.check()).length;
```

- [ ] **Step 4: Visual check**

Open the app → Profile tab → View Travel Stats → Year in Review → swipe to last card.
Expected: stat boxes have a visible gold border, a gold divider line between the title and the grid, "Badges (all time)" label with a non-zero number. Top tracker row shows at the bottom.

- [ ] **Step 5: Commit**

```bash
git add src/components/YearInReviewCard.jsx src/components/YearInReview.css src/utils/yearStats.js
git commit -m "feat(share): upgrade YIR summary card + fix achievement count bug"
```

---

### Task 4: Year in Review share flow

**Files:**
- Modify: `src/components/YearInReview.jsx`
- Modify: `src/components/YearInReview.css` (append new styles)

Context: Replace the existing `handleShare` callback (lines 76–92) and the `isLastCard` nav button (lines 160–173) with a two-step flow: "Share" button → format picker row → capture. The off-screen `ShareCard` mounts only during export and is captured via a `useEffect` that runs after the DOM update (safe pattern for async html2canvas).

- [ ] **Step 1: Update imports in `YearInReview.jsx`**

Add these imports to the top of the file (line 1 area):

```jsx
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
// (useRef and useEffect are new additions — others already present)
import ShareCard from './ShareCard';
```

- [ ] **Step 2: Replace state + handleShare in `YearInReview.jsx`**

Remove the existing `handleShare` function (lines 76–92) and add share state after the existing `const touchStartRef = useRef(null);` line:

```jsx
// Share flow state
const [showFormatPicker, setShowFormatPicker] = useState(false);
const [exportFormat, setExportFormat] = useState(null); // null | 'portrait' | 'square'
const [exporting, setExporting] = useState(false);
const shareCardRef = useRef(null);

// Capture share card after it mounts — useEffect fires after DOM + ref are ready
useEffect(() => {
  if (!exportFormat || !shareCardRef.current) return;

  let cancelled = false;
  setExporting(true);

  (async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      if (!cancelled) {
        const link = document.createElement('a');
        link.download = `year-in-review-${year}-${exportFormat}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (err) {
      console.error('Failed to export share card:', err);
    } finally {
      if (!cancelled) {
        setExporting(false);
        setExportFormat(null);
        setShowFormatPicker(false);
      }
    }
  })();

  return () => { cancelled = true; };
}, [exportFormat, year]);
```

- [ ] **Step 3: Replace nav button + add format picker in the JSX, and use a second portal for the off-screen ShareCard**

**IMPORTANT:** The off-screen `ShareCard` must NOT be rendered inside the `yir-overlay` portal — the overlay's `position: fixed; inset: 0` creates a stacking context that can interfere with html2canvas. Instead, render the ShareCard as a **sibling portal** directly to `document.body`. This requires wrapping the two `createPortal` calls in a React fragment.

Find the closing of the `createPortal(...)` call (around line 175 in the current file) and change the entire `return createPortal(...)` block to:

```jsx
  return (
    <>
      {createPortal(
        <div className="yir-overlay" onClick={onClose}>
          <div
            className="yir-container"
            ref={containerRef}
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button className="yir-close" onClick={onClose}>&times;</button>

            {/* Progress dots */}
            <div className="yir-dots">
              {cards.map((_, i) => (
                <div
                  key={i}
                  className={`yir-dot ${i === currentIndex ? 'yir-dot-active' : ''} ${i < currentIndex ? 'yir-dot-done' : ''}`}
                  onClick={() => goTo(i, i > currentIndex ? 'left' : 'right')}
                />
              ))}
            </div>

            {/* Card */}
            <div className={`yir-card-wrapper ${direction ? `yir-slide-${direction}` : 'yir-slide-in'}`}>
              <YearInReviewCard type={cards[currentIndex]} stats={stats} visible={true} />
            </div>

            {/* Navigation */}
            <div className="yir-nav">
              <button className="yir-nav-btn" onClick={goPrev} disabled={currentIndex === 0} aria-label="Previous">
                ←
              </button>
              <span className="yir-nav-counter">{currentIndex + 1} / {cards.length}</span>
              {isLastCard ? (
                <button
                  className="yir-nav-btn yir-nav-share"
                  onClick={() => setShowFormatPicker(p => !p)}
                  disabled={exporting}
                  aria-label="Share"
                >
                  {exporting ? 'Saving…' : 'Share'}
                </button>
              ) : (
                <button className="yir-nav-btn" onClick={goNext} disabled={currentIndex === cards.length - 1} aria-label="Next">
                  →
                </button>
              )}
            </div>

            {/* Format picker — appears below nav on last card */}
            {isLastCard && showFormatPicker && (
              <div className="yir-format-picker">
                <button className="yir-format-btn" onClick={() => setExportFormat('portrait')} disabled={exporting}>
                  {exporting && exportFormat === 'portrait' ? 'Saving…' : '📱 Portrait'}
                </button>
                <button className="yir-format-btn" onClick={() => setExportFormat('square')} disabled={exporting}>
                  {exporting && exportFormat === 'square' ? 'Saving…' : '⬜ Square'}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Off-screen ShareCard — separate portal so it's not inside the overlay stacking context */}
      {exportFormat && createPortal(
        <ShareCard ref={shareCardRef} variant="yearly" format={exportFormat} stats={stats} />,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 4: Append format picker styles to `YearInReview.css`**

Append to the end of the file:

```css
/* ===== Share Format Picker ===== */
.yir-format-picker {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 8px 0 0;
  animation: yir-fade-up 0.2s ease-out;
}

.yir-format-btn {
  padding: 8px 22px;
  border: 1px solid rgba(201, 168, 76, 0.45);
  border-radius: 20px;
  background: rgba(201, 168, 76, 0.1);
  color: #c9a84c;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.yir-format-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.22);
  border-color: #c9a84c;
}

.yir-format-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.yir-nav-share {
  width: auto;
  padding: 0 18px;
  border-radius: 22px;
  font-size: 14px;
  font-weight: 600;
  background: linear-gradient(135deg, #c9a84c, #a08030);
}

.yir-nav-share:hover:not(:disabled) {
  background: linear-gradient(135deg, #a08030, #c9a84c) !important;
}
```

- [ ] **Step 5: Remove the old `.yir-nav-download` rule from `YearInReview.css`**

Find and delete these lines (around line 414–425):
```css
.yir-nav-download {
  width: auto;
  padding: 0 16px;
  border-radius: 22px;
  font-size: 14px;
  gap: 6px;
  background: linear-gradient(135deg, #c9a84c, #a08030);
}

.yir-nav-download:hover {
  background: linear-gradient(135deg, #a08030, #c9a84c) !important;
}
```

- [ ] **Step 6: Visual + export check**

1. Open the app → Profile → View Travel Stats → Year in Review
2. Swipe to the last (summary) card
3. Tap "Share" → format picker appears with Portrait and Square buttons
4. Tap "Portrait" → button shows "Saving…" briefly → PNG downloads as `year-in-review-{year}-portrait.png`
5. Tap "Square" → downloads as `year-in-review-{year}-square.png`
6. Open both PNGs — portrait should be ~900×1600px, square ~1200×1200px (retina @2x)

- [ ] **Step 7: Commit**

```bash
git add src/components/YearInReview.jsx src/components/YearInReview.css
git commit -m "feat(share): replace YIR save button with portrait/square share flow"
```

---

### Task 5: Profile Screen all-time share button

**Files:**
- Modify: `src/components/ProfileScreen.jsx`
- Modify: `src/components/ProfileScreen.css`

Context: `ProfileScreen` already has `userId` from `useAuth`. Import `computeAllTimeStats` from `../utils/allTimeStats` and `ShareCard` from `./ShareCard`. Compute `allTimeStats` at the `ProfileScreen` level using `useMemo` (avoid re-importing hooks into the sub-function). Pass it and share handlers down to `ProfileTab` as props.

Current `ProfileTab` signature (line 85): `function ProfileTab({ config, level, currentXp, nextLevelXp, totalXp, user, onEditAvatar, onOpenStats })`

- [ ] **Step 1: Update imports in `ProfileScreen.jsx`**

Add to the existing imports at the top:

```jsx
import { useState, useMemo, useRef, useEffect } from 'react';
// (useState already there; useMemo, useRef, useEffect are new)
import ShareCard from './ShareCard';
import { computeAllTimeStats } from '../utils/allTimeStats';
```

- [ ] **Step 2: Add share state + effect to `ProfileScreen`**

Inside `ProfileScreen`, after the `const userId = user?.id ?? null;` line, add:

```jsx
// All-time stats (memoized — recomputed only when userId changes)
const allTimeStats = useMemo(() => computeAllTimeStats(userId), [userId]);

// Share flow state
const [showSharePicker, setShowSharePicker] = useState(false);
const [exportFormat, setExportFormat] = useState(null); // null | 'portrait' | 'square'
const [exporting, setExporting] = useState(false);
const shareCardRef = useRef(null);

// Capture all-time share card after it mounts
useEffect(() => {
  if (!exportFormat || !shareCardRef.current) return;

  let cancelled = false;
  setExporting(true);

  (async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      if (!cancelled) {
        const link = document.createElement('a');
        link.download = `my-travel-stats-${exportFormat}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    } catch (err) {
      console.error('Failed to export share card:', err);
    } finally {
      if (!cancelled) {
        setExporting(false);
        setExportFormat(null);
        setShowSharePicker(false);
      }
    }
  })();

  return () => { cancelled = true; };
}, [exportFormat]);
```

- [ ] **Step 3: Pass share props to `ProfileTab` and mount off-screen ShareCard**

Update the `tab === 'profile'` block in the return JSX to pass the new props:

```jsx
{tab === 'profile' && (
  <ProfileTab
    config={config}
    level={level}
    currentXp={currentXp}
    nextLevelXp={nextLevelXp}
    totalXp={totalXp}
    user={user}
    onEditAvatar={() => setShowAvatarEditor(true)}
    onOpenStats={() => setShowStats(true)}
    showSharePicker={showSharePicker}
    onToggleShare={() => setShowSharePicker(p => !p)}
    onExport={setExportFormat}
    exporting={exporting}
    exportFormat={exportFormat}
  />
)}
```

And add the off-screen ShareCard just before the closing `</div>` of the root element (after the `{showStats && <StatsModal .../>}` line):

```jsx
{/* Off-screen ShareCard for all-time export */}
{exportFormat && (
  <ShareCard
    ref={shareCardRef}
    variant="alltime"
    format={exportFormat}
    stats={allTimeStats}
  />
)}
```

- [ ] **Step 4: Update `ProfileTab` to show share button + picker**

Replace the `ProfileTab` function signature and `profile-actions` div:

```jsx
function ProfileTab({
  config, level, currentXp, nextLevelXp, totalXp, user,
  onEditAvatar, onOpenStats,
  showSharePicker, onToggleShare, onExport, exporting, exportFormat,
}) {
  const xpPct = nextLevelXp > 0 ? Math.min(currentXp / nextLevelXp, 1) : 0;

  return (
    <div className="profile-overview">
      <div className="profile-avatar-section">
        <button className="profile-avatar-btn" onClick={onEditAvatar} aria-label="Edit avatar">
          <AvatarCanvas config={config} size={96} />
          <span className="profile-avatar-edit-hint">Edit</span>
        </button>
        <div className="profile-user-info">
          <p className="profile-username">{user?.name || 'Traveller'}</p>
          <div className="profile-level-row">
            <LevelBadge size={36} />
            <span className="profile-level-label">Level {level}</span>
          </div>
          <div className="profile-xp-bar-wrap">
            <div className="profile-xp-bar">
              <div className="profile-xp-fill" style={{ width: `${xpPct * 100}%` }} />
            </div>
            <p className="profile-xp-label">{currentXp} / {nextLevelXp} XP to next level</p>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <p className="profile-total-xp">Total XP earned: {totalXp}</p>
        <button className="profile-stats-btn" onClick={onOpenStats}>
          View Travel Stats
        </button>
        <button
          className="profile-share-btn"
          onClick={onToggleShare}
          disabled={exporting}
        >
          {exporting ? 'Saving…' : 'Share my stats'}
        </button>
      </div>

      {showSharePicker && (
        <div className="profile-share-picker">
          <button
            className="yir-format-btn"
            onClick={() => onExport('portrait')}
            disabled={exporting}
          >
            {exporting && exportFormat === 'portrait' ? 'Saving…' : '📱 Portrait'}
          </button>
          <button
            className="yir-format-btn"
            onClick={() => onExport('square')}
            disabled={exporting}
          >
            {exporting && exportFormat === 'square' ? 'Saving…' : '⬜ Square'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add styles to `ProfileScreen.css`**

Append to the end of `src/components/ProfileScreen.css`:

```css
/* Share my stats button */
.profile-share-btn {
  margin-top: 8px;
  padding: 10px 20px;
  border: 1px solid rgba(201, 168, 76, 0.4);
  border-radius: 20px;
  background: rgba(201, 168, 76, 0.08);
  color: #c9a84c;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.profile-share-btn:hover:not(:disabled) {
  background: rgba(201, 168, 76, 0.18);
  border-color: #c9a84c;
}

.profile-share-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Format picker under share button */
.profile-share-picker {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 6: Visual + export check**

1. Open the app → Profile tab → Profile sub-tab
2. Below "View Travel Stats", a "Share my stats" button should appear
3. Tap it → format picker (Portrait / Square) appears below
4. Tap "Portrait" → button shows "Saving…" → downloads `my-travel-stats-portrait.png`
5. Open the PNG — should be ~900×1600px, showing countries / regions / continents / badges
6. Tap "Square" → downloads `my-travel-stats-square.png` at ~1200×1200px

- [ ] **Step 7: Commit**

```bash
git add src/components/ProfileScreen.jsx src/components/ProfileScreen.css
git commit -m "feat(share): add all-time share card to Profile screen"
```
