# Achievement Popup Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix achievement popups firing repeatedly on mark/unmark cycles, add a per-country 1.5s toggle cooldown, and remove XP toasts.

**Architecture:** Three targeted changes — (1) delete `XpNotification.jsx` and its two references in `App.jsx`, (2) add a `checkToggleCooldown` pure function called from `handleToggleWorldCountry`, (3) add an append-only `shownAchievementIds` layer in `AchievementToasts` backed by a new localStorage key. New pure functions go in `progressCelebrations.js` so they can be unit-tested without importing the full App.

**Tech Stack:** React (`useRef`), localStorage, Vitest + `@testing-library/react`, jsdom

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Delete | `src/components/XpNotification.jsx` | XP toast UI — being removed |
| Modify | `src/App.jsx` | Remove XP import/render; add cooldown ref + guard; add `shownIds` ref + logic in `AchievementToasts` |
| Modify | `src/utils/progressCelebrations.js` | Add `checkToggleCooldown`, `getAchShownKey`, `readAchShown`, `writeAchShown` |
| Modify | `src/utils/__tests__/progressCelebrations.test.js` | Tests for the four new helpers |

---

## Task 1: Remove XP toast component

**Files:**
- Delete: `src/components/XpNotification.jsx`
- Modify: `src/App.jsx` (line 21 — import; line 630 — render)

No new test needed: removing the component is verified by the existing suite passing after deletion.

- [ ] **Step 1: Delete the component file**

```bash
rm src/components/XpNotification.jsx
```

- [ ] **Step 2: Remove the import from App.jsx**

Find line 21 in `src/App.jsx`:
```js
import XpNotification from './components/XpNotification';
```
Delete that line entirely.

- [ ] **Step 3: Remove the render call from App.jsx**

Find line 630 in `src/App.jsx` (search for `XpNotification` — only one render site):
```jsx
{!isShareMode && <XpNotification />}
```
Delete that line entirely.

- [ ] **Step 4: Run the test suite to confirm nothing broke**

```bash
npm test
```
Expected: all existing tests pass. If any test imports `XpNotification` directly, delete those test files too (there are none currently).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git rm src/components/XpNotification.jsx
git commit -m "feat: remove XP toast notifications"
```

---

## Task 2: Per-country toggle cooldown

**Files:**
- Modify: `src/utils/progressCelebrations.js` (add `checkToggleCooldown`)
- Modify: `src/utils/__tests__/progressCelebrations.test.js` (add tests)
- Modify: `src/App.jsx` (import + use in `handleToggleWorldCountry`)

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/progressCelebrations.test.js`:

```js
import {
  checkToggleCooldown,
  // ...existing imports
} from '../progressCelebrations';

describe('checkToggleCooldown', () => {
  it('allows the first toggle for a country', () => {
    const map = new Map();
    expect(checkToggleCooldown(map, 'jp', 1000)).toBe(true);
  });

  it('blocks a second toggle within 1500ms', () => {
    const map = new Map();
    checkToggleCooldown(map, 'jp', 1000);
    expect(checkToggleCooldown(map, 'jp', 2499)).toBe(false);
  });

  it('allows a toggle after 1500ms have elapsed', () => {
    const map = new Map();
    checkToggleCooldown(map, 'jp', 1000);
    expect(checkToggleCooldown(map, 'jp', 2500)).toBe(true);
  });

  it('does not block a different country during the cooldown', () => {
    const map = new Map();
    checkToggleCooldown(map, 'jp', 1000);
    expect(checkToggleCooldown(map, 'fr', 1001)).toBe(true);
  });

  it('updates the timestamp on an allowed toggle', () => {
    const map = new Map();
    checkToggleCooldown(map, 'jp', 1000);
    checkToggleCooldown(map, 'jp', 2500); // allowed, resets clock
    expect(checkToggleCooldown(map, 'jp', 3999)).toBe(false); // blocked: 3999 - 2500 = 1499
    expect(checkToggleCooldown(map, 'jp', 4000)).toBe(true);  // allowed: 4000 - 2500 = 1500
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- progressCelebrations
```
Expected: FAIL with `checkToggleCooldown is not a function`

- [ ] **Step 3: Add `checkToggleCooldown` to progressCelebrations.js**

Append to the bottom of `src/utils/progressCelebrations.js`:

```js
const TOGGLE_COOLDOWN_MS = 1500;

/**
 * Returns true and records the timestamp if the country can be toggled.
 * Returns false (blocking the toggle) if the same country was toggled
 * within TOGGLE_COOLDOWN_MS milliseconds.
 *
 * @param {Map<string, number>} cooldownMap - shared mutable Map (from useRef)
 * @param {string} countryCode
 * @param {number} [now=Date.now()]
 */
export function checkToggleCooldown(cooldownMap, countryCode, now = Date.now()) {
  if (now - (cooldownMap.get(countryCode) ?? 0) < TOGGLE_COOLDOWN_MS) return false;
  cooldownMap.set(countryCode, now);
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- progressCelebrations
```
Expected: all `checkToggleCooldown` tests PASS

- [ ] **Step 5: Import and use in App.jsx**

At the top of `src/App.jsx`, add `checkToggleCooldown` to the existing import from `./utils/progressCelebrations`:

```js
import {
  checkToggleCooldown,
  createAchievementBaseline,
  getCrossedMilestone,
  getNewlyUnlockedIds,
  markMilestoneShown,
  parseStoredIdList,
} from './utils/progressCelebrations';
```

In `src/App.jsx`, find the `handleToggleWorldCountry` callback (around line 352). Just above it (as the last `useRef` declaration before it), add:

```js
const toggleCooldowns = useRef(new Map());
```

Then replace the body of `handleToggleWorldCountry`:

```js
const handleToggleWorldCountry = useCallback((countryCode) => {
  if (!checkToggleCooldown(toggleCooldowns.current, countryCode)) return;
  const wasVisited = worldVisited.has(countryCode);
  haptics.visitToggle(wasVisited);
  toggleWorldCountry(countryCode);
  if (!wasVisited) {
    grantXpOnce(`world:${countryCode}`, xpRules.VISIT_COUNTRY, 'visit_country', 'world');
  } else {
    revokeXpIfGranted(`world:${countryCode}`, xpRules.VISIT_COUNTRY, 'unvisit_country', 'world');
  }
  emitVisitedChange();
}, [toggleWorldCountry, worldVisited, grantXpOnce, revokeXpIfGranted, xpRules]);
```

Note: `toggleCooldowns` is a ref and does not belong in the dependency array.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/utils/progressCelebrations.js src/utils/__tests__/progressCelebrations.test.js
git commit -m "feat: add per-country 1.5s toggle cooldown"
```

---

## Task 3: Achievement popup shown only once (lifetime)

**Files:**
- Modify: `src/utils/progressCelebrations.js` (add `getAchShownKey`, `readAchShown`, `writeAchShown`)
- Modify: `src/utils/__tests__/progressCelebrations.test.js` (add tests)
- Modify: `src/App.jsx` — `AchievementToasts` component (add `shownIds` ref, update `checkAchievements`)

**Background on the bug:** `AchievementToasts` currently calls `writeAchSeen(userId, currentUnlocked)` after every evaluation (App.jsx line 156). This means the stored "seen" set shrinks whenever a country is unmarked and an achievement drops below threshold. The next time the achievement is re-earned, it appears "new" to `getNewlyUnlockedIds` and fires the toast again.

The fix: add a separate `shownIds` Set (backed by a new localStorage key) that is append-only. Toasts are gated on `shownIds`, not `prevUnlocked`. The `prevUnlocked` tracking continues unchanged — it still drives the XP grant/revoke logic.

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/progressCelebrations.test.js`:

```js
import {
  getAchShownKey,
  readAchShown,
  writeAchShown,
  // ...existing imports
} from '../progressCelebrations';

describe('achievement shown helpers', () => {
  it('getAchShownKey returns a user-scoped key when userId is provided', () => {
    expect(getAchShownKey('u42')).toBe('swiss-tracker-shown-ach-u42');
  });

  it('getAchShownKey returns a guest key when userId is null', () => {
    expect(getAchShownKey(null)).toBe('swiss-tracker-shown-ach');
  });

  it('readAchShown returns empty array when nothing is stored', () => {
    expect(readAchShown('u1')).toEqual([]);
  });

  it('writeAchShown persists and readAchShown retrieves a Set of ids', () => {
    const ids = new Set(['first-country', 'globe-trotter']);
    writeAchShown('u1', ids);
    expect(readAchShown('u1')).toEqual(expect.arrayContaining(['first-country', 'globe-trotter']));
    expect(readAchShown('u1')).toHaveLength(2);
  });

  it('readAchShown is isolated per userId', () => {
    writeAchShown('u1', new Set(['ach-a']));
    writeAchShown('u2', new Set(['ach-b']));
    expect(readAchShown('u1')).toEqual(['ach-a']);
    expect(readAchShown('u2')).toEqual(['ach-b']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- progressCelebrations
```
Expected: FAIL with `getAchShownKey is not a function`

- [ ] **Step 3: Add the three helpers to progressCelebrations.js**

Append to `src/utils/progressCelebrations.js`:

```js
export function getAchShownKey(userId) {
  return userId ? `swiss-tracker-shown-ach-${userId}` : 'swiss-tracker-shown-ach';
}

export function readAchShown(userId) {
  const plain = localStorage.getItem(getAchShownKey(userId));
  return plain ? parseStoredIdList(plain) : [];
}

export function writeAchShown(userId, ids) {
  localStorage.setItem(getAchShownKey(userId), JSON.stringify([...ids]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- progressCelebrations
```
Expected: all new tests PASS

- [ ] **Step 5: Import the new helpers in App.jsx**

Add `getAchShownKey`, `readAchShown`, `writeAchShown` to the existing `progressCelebrations` import in `src/App.jsx`:

```js
import {
  checkToggleCooldown,
  createAchievementBaseline,
  getCrossedMilestone,
  getAchShownKey,
  getNewlyUnlockedIds,
  markMilestoneShown,
  parseStoredIdList,
  readAchShown,
  writeAchShown,
} from './utils/progressCelebrations';
```

- [ ] **Step 6: Add shownIds ref to AchievementToasts**

Inside `function AchievementToasts()` (App.jsx ~line 110), add the ref right after the existing `prevUnlocked` ref:

```js
const prevUnlocked = useRef(null);
const shownIds = useRef(new Set(readAchShown(userId)));
```

- [ ] **Step 7: Update the seenKey effect to reset shownIds on user change**

The existing effect at ~line 159 resets `prevUnlocked` when the user changes. Add the `shownIds` reset to it:

```js
useEffect(() => {
  prevUnlocked.current = null;
  shownIds.current = new Set(readAchShown(userId));
  setToasts([]);
}, [seenKey]);
```

- [ ] **Step 8: Update checkAchievements to gate toasts on shownIds**

Replace the `newlyUnlocked` block inside `checkAchievements` (App.jsx ~lines 134–144). The current code:

```js
const newlyUnlocked = getNewlyUnlockedIds(prevUnlocked.current, currentUnlocked);
if (newlyUnlocked.length > 0) {
  haptics.achievementUnlock();
  const newToasts = newlyUnlocked.map((id) => {
    const a = achievements.find((x) => x.id === id);
    grantXpOnce(`achievement:${id}`, xpRules.UNLOCK_ACHIEVEMENT, 'unlock_achievement');
    return { id, icon: a?.icon || '', title: a?.title || '', desc: a?.desc || '', ts: Date.now() + Math.random() };
  });
  setToasts((prev) => [...prev, ...newToasts]);
}
```

Replace with:

```js
const newlyUnlocked = getNewlyUnlockedIds(prevUnlocked.current, currentUnlocked);
if (newlyUnlocked.length > 0) {
  // Grant XP for every newly-unlocked achievement regardless of toast visibility.
  newlyUnlocked.forEach((id) => {
    grantXpOnce(`achievement:${id}`, xpRules.UNLOCK_ACHIEVEMENT, 'unlock_achievement');
  });

  // Only show a toast for achievements the user has never seen before (lifetime gate).
  const toShowIds = newlyUnlocked.filter((id) => !shownIds.current.has(id));
  if (toShowIds.length > 0) {
    haptics.achievementUnlock();
    const newToasts = toShowIds.map((id) => {
      const a = achievements.find((x) => x.id === id);
      return { id, icon: a?.icon || '', title: a?.title || '', desc: a?.desc || '', ts: Date.now() + Math.random() };
    });
    setToasts((prev) => [...prev, ...newToasts]);
    toShowIds.forEach((id) => shownIds.current.add(id));
    writeAchShown(userId, shownIds.current);
  }
}
```

- [ ] **Step 9: Run the full test suite**

```bash
npm test
```
Expected: all tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx src/utils/progressCelebrations.js src/utils/__tests__/progressCelebrations.test.js
git commit -m "fix: show achievement popup only once per lifetime"
```
