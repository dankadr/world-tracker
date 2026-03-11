# Achievement Detail — Expand In Place Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tap an achievement badge to expand it inline, revealing a large progress bar and visited/remaining region chip lists.

**Architecture:** A new pure utility `getDetailItems(rule, userId)` resolves region names for each achievement rule type. `AchievementCard` accepts new `isExpanded` / `onToggle` props and renders the expanded section. `AchievementsTab` in `ProfileScreen.jsx` owns the single `expandedId` string state and passes it down.

**Tech Stack:** React 18, Vite, localStorage, GeoJSON region data already in-bundle

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/utils/achievementDetail.js` | Create | Pure utility: `getDetailItems(rule, userId)` → `{ isListable, visited[], remaining[] }` |
| `src/components/AchievementCard.jsx` | Modify | Accept `isExpanded` + `onToggle` props; render expanded detail section; import AchievementCard.css |
| `src/components/AchievementCard.css` | Create | Expanded badge styles, chip styles, section labels, status pill, close button, animations |
| `src/components/ProfileScreen.jsx` | Modify | `AchievementsTab`: add `expandedId` state, pass `isExpanded`/`onToggle` to each card |

---

## Chunk 1: Utility + Component + Styles + Wiring

### Task 1: Create `src/utils/achievementDetail.js`

**Files:**
- Create: `src/utils/achievementDetail.js`

Context: Achievement badges live in `src/config/achievements.json`. Rule types are processed in `src/utils/achievementProgress.js` (already imports all the data sources used here). Region names come from `feature.properties.name` in each tracker's GeoJSON. World continent membership is in `src/config/continents.json` (a flat `{countryCode: continentName}` map) — there is NO `continent` field on `worldData` features. Mirror the data-access patterns used in `achievementProgress.js`.

- [ ] **Step 1: Create the file**

```js
import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import worldData from '../data/world.json';
import countryMeta from '../config/countryMeta.json';

// Rule types that have no named region list — show hint box instead
const NON_LISTABLE = new Set([
  'totalVisited', 'totalPercent', 'achievementsUnlocked', 'categoryComplete',
  'worldAreaVisited', 'worldPopulationVisited', 'hemisphereVisited',
  'gameCompleted', 'easterEggToggled', 'specificCapitalVisited',
]);

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedSet(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return new Set(Array.isArray(data) ? data : Object.keys(data));
    }
  } catch { /* ignore */ }
  return new Set();
}

function getVisitedWorldSet(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch { /* ignore */ }
  return new Set();
}

// Quick id→name lookup for world countries
const worldNameMap = Object.fromEntries(
  worldData.features.map(f => [f.properties.id, f.properties.name])
);

function sorted(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

/**
 * Compute visited and remaining name lists for a given achievement rule.
 * @param {object} rule — achievement rule object from achievements.json
 * @param {string|null} userId
 * @returns {{ isListable: boolean, visited: string[], remaining: string[] }}
 */
export function getDetailItems(rule, userId) {
  if (!rule || NON_LISTABLE.has(rule.type)) {
    return { isListable: false, visited: [], remaining: [] };
  }

  const { type } = rule;

  // countryVisited / countryComplete — all regions of a tracker
  if (type === 'countryVisited' || type === 'countryComplete') {
    const tracker = countryList.find(c => c.id === rule.country);
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const features = tracker.data.features.filter(f => !f.properties?.isBorough);
    const vis = getVisitedSet(rule.country, userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // subregionVisited — only specific regionIds within a tracker
  if (type === 'subregionVisited') {
    const tracker = countryList.find(c => c.id === rule.country);
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const regionSet = new Set(rule.regionIds);
    const features = tracker.data.features.filter(f => regionSet.has(f.properties.id));
    const vis = getVisitedSet(rule.country, userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldVisited / worldPercent — all world countries
  if (type === 'worldVisited' || type === 'worldPercent') {
    const vis = getVisitedWorldSet(userId);
    const visited = [], remaining = [];
    worldData.features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldContinentComplete — countries within a specific continent
  // NOTE: continent membership is in continents.json (flat map), NOT in worldData feature properties
  if (type === 'worldContinentComplete') {
    const vis = getVisitedWorldSet(userId);
    const codes = Object.entries(continentMap)
      .filter(([, cont]) => cont === rule.continent)
      .map(([code]) => code);
    const visited = [], remaining = [];
    codes.forEach(code => {
      const name = worldNameMap[code];
      if (!name) return;
      (vis.has(code) ? visited : remaining).push(name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldTagVisited — countries with a specific tag in countryMeta
  if (type === 'worldTagVisited') {
    const vis = getVisitedWorldSet(userId);
    const codes = Object.entries(countryMeta)
      .filter(([, meta]) => meta?.tags?.includes(rule.tag))
      .map(([code]) => code);
    const visited = [], remaining = [];
    codes.forEach(code => {
      const name = worldNameMap[code];
      if (!name) return;
      (vis.has(code) ? visited : remaining).push(name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // continentsVisited — the 6 inhabited continents
  if (type === 'continentsVisited') {
    const vis = getVisitedWorldSet(userId);
    const visitedConts = new Set();
    vis.forEach(code => {
      const cont = continentMap[code];
      if (cont) visitedConts.add(cont);
    });
    const ALL = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
    return {
      isListable: true,
      visited: ALL.filter(c => visitedConts.has(c)),
      remaining: ALL.filter(c => !visitedConts.has(c)),
    };
  }

  // capitalsVisited / capitalsComplete — all entries in the capitals tracker
  if (type === 'capitalsVisited' || type === 'capitalsComplete') {
    const tracker = countryList.find(c => c.id === 'capitals');
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const features = tracker.data.features.filter(f => !f.properties?.isBorough);
    const vis = getVisitedSet('capitals', userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // allCapitalsVisited — specific capitalIds only
  if (type === 'allCapitalsVisited') {
    const tracker = countryList.find(c => c.id === 'capitals');
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const capSet = new Set(rule.capitalIds);
    const features = tracker.data.features.filter(f => capSet.has(f.properties.id));
    const vis = getVisitedSet('capitals', userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // countriesComplete — which trackers are 100% visited
  if (type === 'countriesComplete') {
    const visited = [], remaining = [];
    countryList.forEach(c => {
      const total = c.data.features.filter(f => !f.properties?.isBorough).length;
      if (total === 0) return;
      const count = getVisitedSet(c.id, userId).size;
      (count >= total ? visited : remaining).push(c.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // allCountriesHaveVisits — which trackers have at least 1 visit
  if (type === 'allCountriesHaveVisits') {
    const visited = [], remaining = [];
    countryList.forEach(c => {
      const count = getVisitedSet(c.id, userId).size;
      (count > 0 ? visited : remaining).push(c.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  return { isListable: false, visited: [], remaining: [] };
}
```

- [ ] **Step 2: Verify no import errors**

Run `npm run dev` (if not already running). Open the browser DevTools console. Paste:
```js
import('/src/utils/achievementDetail.js').then(m => {
  console.log(m.getDetailItems({ type: 'countryComplete', country: 'ch' }, null));
});
```
Expected: an object with `isListable: true`, `visited: [...]`, `remaining: [...]`. No errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/achievementDetail.js
git commit -m "feat(achievements): add getDetailItems utility for region name lists"
```

---

### Task 2: Update `src/components/AchievementCard.jsx`

**Files:**
- Modify: `src/components/AchievementCard.jsx`

Context: The current component renders a collapsed badge. `achievement.id` is available (from achievements.json). `achievement.rule` is available (rule.type, etc.). The `progress` object already has `{ current, target, pct }`. `formatProgressText` is already imported. The `getDetailItems` utility created in Task 1 computes the region lists. `MAX_CHIPS = 8` caps chips per section with a "+N more" overflow chip.

The status pill logic:
- `unlocked` → green "✓ Unlocked"
- `current > 0` → gold "In progress"
- otherwise → muted "Locked"

- [ ] **Step 1: Replace the full file**

```jsx
import { getDetailItems } from '../utils/achievementDetail';
import { formatProgressText } from '../utils/achievementProgress';
import './AchievementCard.css';

const MAX_CHIPS = 8;

function ChipList({ items, variant }) {
  const shown = items.slice(0, MAX_CHIPS);
  const overflow = items.length - MAX_CHIPS;
  return (
    <div className="achievement-chip-list">
      {shown.map(name => (
        <span key={name} className={`achievement-chip achievement-chip-${variant}`}>{name}</span>
      ))}
      {overflow > 0 && (
        <span className="achievement-chip achievement-chip-more">+{overflow} more</span>
      )}
    </div>
  );
}

export default function AchievementCard({ achievement, isExpanded, onToggle }) {
  const { id, icon, title, desc, unlocked, progress, rule } = achievement;
  const { current, target, pct } = progress;
  const ruleType = rule?.type;

  const showProgressBar = target > 1 || (target === 1 && current === 0);

  const statusLabel = unlocked ? '✓ Unlocked' : current > 0 ? 'In progress' : 'Locked';
  const statusClass = unlocked ? 'unlocked' : current > 0 ? 'in-progress' : 'locked';

  // Compute detail items only when expanded (avoids work on every render)
  const detail = isExpanded ? getDetailItems(rule, achievement._userId ?? null) : null;

  const remaining = target - Math.min(current, target);

  return (
    <div
      className={`achievement-badge ${unlocked ? 'unlocked' : current > 0 ? 'in-progress' : 'locked'}${isExpanded ? ' achievement-badge-expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    >
      {/* Collapsed header — always visible */}
      <span className="badge-icon">{icon}</span>
      <span className="badge-title">{title}</span>
      {!isExpanded && <span className="badge-desc">{desc}</span>}

      {/* Collapsed progress — hidden when expanded */}
      {!isExpanded && showProgressBar && (
        <div className="badge-progress">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-text">{formatProgressText(current, target, ruleType)}</span>
        </div>
      )}
      {!isExpanded && !showProgressBar && unlocked && (
        <span className="progress-text progress-done">✓</span>
      )}

      {/* ── Expanded detail panel ── */}
      {isExpanded && (
        <div className="achievement-detail">
          {/* Close button — 44×44px tap target */}
          <button
            className="achievement-detail-close"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label="Close detail"
          >
            ✕
          </button>

          {/* Description + status pill */}
          <p className="achievement-detail-desc">{desc}</p>
          <span className={`achievement-detail-pill achievement-detail-pill-${statusClass}`}>
            {statusLabel}
          </span>

          {/* Progress bar */}
          <div className="achievement-detail-bar-wrap">
            <div className="achievement-detail-bar-track">
              <div className="achievement-detail-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="achievement-detail-bar-label">
              {formatProgressText(current, target, ruleType)}
              {remaining > 0 && ` · ${remaining} to go`}
            </span>
          </div>

          {/* Region lists or hint */}
          {detail?.isListable ? (
            <>
              {detail.visited.length > 0 && (
                <>
                  <div className="achievement-detail-section">
                    <span className="achievement-detail-section-label">Visited</span>
                    <span className="achievement-detail-section-count">{detail.visited.length}</span>
                  </div>
                  <ChipList items={detail.visited} variant="visited" />
                </>
              )}
              {detail.remaining.length > 0 && (
                <>
                  <div className="achievement-detail-section">
                    <span className="achievement-detail-section-label">Still needed</span>
                    <span className="achievement-detail-section-count">{detail.remaining.length}</span>
                  </div>
                  <ChipList items={detail.remaining} variant="remaining" />
                </>
              )}
            </>
          ) : (
            <p className="achievement-detail-hint">
              {ruleType === 'achievementsUnlocked' || ruleType === 'categoryComplete'
                ? 'Unlock more badges to progress.'
                : ruleType === 'gameCompleted'
                ? 'Complete geography mini-games to unlock.'
                : 'Keep exploring any tracker to progress.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: `achievement._userId` is passed from `AchievementsTab` in Task 4 so `getDetailItems` has the userId. Alternatively it can be passed as a separate prop — see Task 4 for the exact wiring.

- [ ] **Step 2: Commit**

```bash
git add src/components/AchievementCard.jsx
git commit -m "feat(achievements): add expand-in-place detail panel to AchievementCard"
```

---

### Task 3: Create `src/components/AchievementCard.css`

**Files:**
- Create: `src/components/AchievementCard.css`
- Note: the import `import './AchievementCard.css';` is already included in the Task 2 component replacement

Context: The project uses per-component CSS files co-located with their JSX (e.g. `ProfileScreen.css`, `YearInReview.css`). All existing badge styles stay in `App.css` — only the new expanded-state styles go here. The `achievements-grid` uses `grid-template-columns: 1fr 1fr 1fr` (desktop) and `1fr 1fr` (mobile) — `grid-column: 1 / -1` spans full width in both grid layouts. Mobile UX: `touch-action: manipulation` removes the 300ms iOS tap delay; `-webkit-tap-highlight-color: transparent` kills the flash. Chip stagger: `.achievement-chip-list:first-of-type` (visited section) animates at 0.1s delay, `.achievement-chip-list:last-of-type` (remaining section) at 0.15s.

- [ ] **Step 1: Create `src/components/AchievementCard.css`**

```css
/* ======== Achievement Detail (Expand In Place) ======== */

/* Touch UX on the badge itself */
.achievement-badge {
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s, background 0.15s;
  min-height: 56px; /* comfortable tap target */
}

/* Expanded badge spans full grid width */
.achievement-badge.achievement-badge-expanded {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, rgba(201, 168, 76, 0.1), rgba(201, 168, 76, 0.04));
  border: 1.5px solid rgba(201, 168, 76, 0.4);
  border-radius: 14px;
  align-items: flex-start;
  padding: 14px 16px;
  position: relative;
  animation: achievement-fade-in 0.2s ease-out;
}

@keyframes achievement-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Close button — 44×44px tap target, top-right corner */
.achievement-detail-close {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  border-radius: 0 14px 0 14px;
}
.achievement-detail-close:hover { color: rgba(255, 255, 255, 0.6); }

/* Description text in expanded state */
.achievement-detail-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 4px 0 8px;
  line-height: 1.4;
  padding-right: 32px; /* don't overlap close button */
}

/* Status pill */
.achievement-detail-pill {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  margin-bottom: 12px;
}
.achievement-detail-pill-unlocked {
  background: rgba(80, 180, 100, 0.12);
  color: #6dc882;
  border: 1px solid rgba(80, 180, 100, 0.25);
}
.achievement-detail-pill-in-progress {
  background: rgba(201, 168, 76, 0.12);
  color: #c9a84c;
  border: 1px solid rgba(201, 168, 76, 0.25);
}
.achievement-detail-pill-locked {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Progress bar */
.achievement-detail-bar-wrap { width: 100%; margin-bottom: 14px; }
.achievement-detail-bar-track {
  background: rgba(255, 255, 255, 0.08);
  height: 7px;
  border-radius: 4px;
  overflow: hidden;
}
.achievement-detail-bar-fill {
  background: linear-gradient(90deg, #c9a84c, #d4b866);
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease-out;
}
.achievement-detail-bar-label {
  display: block;
  font-size: 12px;
  color: #c9a84c;
  font-weight: 600;
  margin-top: 5px;
}

/* Section labels (VISITED / STILL NEEDED) */
.achievement-detail-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 0 7px;
}
.achievement-detail-section-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 700;
}
.achievement-detail-section-count {
  background: rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

/* Chips — informational, not tappable; stagger fade-in between sections */
.achievement-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  animation: achievement-fade-in 0.15s ease-out both;
}
.achievement-chip-list:first-of-type { animation-delay: 0.1s; }
.achievement-chip-list:last-of-type  { animation-delay: 0.15s; }
.achievement-chip {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  padding: 0 10px;
  border-radius: 20px;
  line-height: 1;
}
.achievement-chip-visited {
  background: rgba(80, 180, 100, 0.12);
  color: #7dd89a;
  border: 1px solid rgba(80, 180, 100, 0.22);
}
.achievement-chip-remaining {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.achievement-chip-more {
  background: transparent;
  color: rgba(255, 255, 255, 0.25);
  border: 1px dashed rgba(255, 255, 255, 0.12);
}

/* Hint box for non-listable achievements */
.achievement-detail-hint {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.6;
  margin-top: 4px;
  width: 100%;
  box-sizing: border-box;
}

/* Dark mode — styles already work well on dark bg; ensure light mode is visible */
[data-theme="light"] .achievement-badge.achievement-badge-expanded {
  background: linear-gradient(135deg, rgba(180, 130, 20, 0.08), rgba(180, 130, 20, 0.03));
  border-color: rgba(180, 130, 20, 0.35);
}
[data-theme="light"] .achievement-chip-visited {
  background: rgba(30, 140, 60, 0.1);
  color: #1a7a38;
  border-color: rgba(30, 140, 60, 0.25);
}
[data-theme="light"] .achievement-chip-remaining {
  background: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.45);
  border-color: rgba(0, 0, 0, 0.12);
}
[data-theme="light"] .achievement-detail-section-label { color: rgba(0, 0, 0, 0.4); }
[data-theme="light"] .achievement-detail-section-count {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.45);
}
[data-theme="light"] .achievement-detail-bar-track { background: rgba(0, 0, 0, 0.08); }
[data-theme="light"] .achievement-detail-hint {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.45);
}
[data-theme="light"] .achievement-detail-close { color: rgba(0, 0, 0, 0.25); }
[data-theme="light"] .achievement-detail-desc { color: rgba(0, 0, 0, 0.5); }
[data-theme="light"] .achievement-detail-bar-label { color: #a07820; }
[data-theme="light"] .achievement-detail-pill-unlocked { background: rgba(30,140,60,0.1); color: #1a7a38; border-color: rgba(30,140,60,0.25); }
[data-theme="light"] .achievement-detail-pill-in-progress { background: rgba(180,130,20,0.1); color: #a07820; border-color: rgba(180,130,20,0.25); }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AchievementCard.css
git commit -m "feat(achievements): add AchievementCard.css (expanded detail panel, chips, sections)"
```

---

### Task 4: Wire `expandedId` state in `ProfileScreen.jsx` → `AchievementsTab`

**Files:**
- Modify: `src/components/ProfileScreen.jsx` (lines 205–250, the `AchievementsTab` function)

Context: `AchievementsTab` currently renders `<AchievementCard key={a.id} achievement={a} />`. The `userId` is already available in `AchievementsTab` via its `userId` prop. We need to:
1. Add `expandedId` state (null = none expanded)
2. Pass `isExpanded` and `onToggle` to each `AchievementCard`
3. Pass `userId` into each achievement object so `AchievementCard` can forward it to `getDetailItems`

The `_userId` convention (prefixed underscore) avoids collision with any achievement config field.

- [ ] **Step 1: Update `AchievementsTab` in `ProfileScreen.jsx`**

Find the `AchievementsTab` function (line 205) and replace it with:

```jsx
function AchievementsTab({ userId }) {
  const [expandedId, setExpandedId] = useState(null);

  const achievements = getAchievements(userId);
  const baseResults = achievements.map(a => ({ ...a, unlocked: a.check() }));
  const results = baseResults.map(a => ({
    ...a,
    progress: computeProgress(a.rule, userId, baseResults),
    _userId: userId, // forwarded to getDetailItems inside AchievementCard
  }));

  const groups = {};
  results.forEach(a => {
    const cat = a.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  });

  Object.values(groups).forEach(badges => {
    badges.sort((a, b) => {
      const aScore = a.unlocked ? 1 : a.progress.pct > 0 ? 2 : 0;
      const bScore = b.unlocked ? 1 : b.progress.pct > 0 ? 2 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return b.progress.pct - a.progress.pct;
    });
  });

  const unlockedCount = results.filter(r => r.unlocked).length;

  function handleToggle(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <div className="achievements-tab-content">
      <p className="achievements-tab-summary">{unlockedCount} / {results.length} unlocked</p>
      {Object.entries(groups).map(([cat, badges]) => {
        const catUnlocked = badges.filter(b => b.unlocked).length;
        return (
          <div key={cat} className="achievement-category">
            <h3 className="achievement-cat-heading">
              {cat}
              <span className="achievement-cat-count">{catUnlocked}/{badges.length}</span>
            </h3>
            <div className="achievements-grid">
              {badges.map(a => (
                <AchievementCard
                  key={a.id}
                  achievement={a}
                  isExpanded={expandedId === a.id}
                  onToggle={() => handleToggle(a.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

1. Open the app → Profile tab → Badges sub-tab
2. Tap any badge → it should expand to full width with the detail panel
3. Tap a different badge → the first collapses, the second expands
4. Tap the ✕ button → collapses back
5. For a tracker-specific badge (e.g. Swiss Complete): visited and remaining chip sections appear
6. For an aggregate badge (e.g. Explorer - "Visit 25 regions"): hint box appears instead of chips
7. Status pill shows correctly: "✓ Unlocked" (green) / "In progress" (gold) / "Locked" (muted)
8. On mobile (or DevTools mobile viewport, 375px): badges are 56px+ tall, chips are 12px text, ✕ is easy to tap

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfileScreen.jsx
git commit -m "feat(achievements): wire expandedId state — tap badge to expand detail"
```
