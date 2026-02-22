# Plan: Leveling System

## Overview
XP-based leveling system where users earn experience points for visiting new regions. Level is displayed on the user's avatar and profile. Levels unlock cosmetic rewards (avatar items).

## XP Rules

| Action | XP |
|--------|----|
| Visit a new region (any tracker) | +10 XP |
| Visit a new country (world tracker) | +25 XP |
| Complete a sub-tracker (100%) | +200 XP |
| Unlock an achievement | +50 XP |
| Complete a challenge | +100 XP |
| First visit on a new tracker | +15 XP |

## Level Curve
Use a simple quadratic curve:
```
XP needed for level N = 50 * N^1.5 (rounded)
```

| Level | Total XP | Cumulative |
|-------|----------|------------|
| 1     | 0        | 0          |
| 2     | 50       | 50         |
| 3     | 130      | 180        |
| 4     | 230      | 410        |
| 5     | 350      | 760        |
| 10    | 1,580    | ~6,000     |
| 20    | 4,470    | ~30,000    |
| 50    | 17,680   | ~200,000   |

## Level Rewards (Avatar Unlocks)
- Level 5: Unlock sunglasses category
- Level 10: Unlock capes category
- Level 15: Unlock badges category
- Level 20: Unlock pets category
- Level 25+: Unlock rare/special items per level

Ties directly into the `comingSoon: true` categories in `avatarParts.js`.

## Files to Create

### `src/utils/xpSystem.js`
```js
export const XP_RULES = {
  VISIT_REGION: 10,
  VISIT_COUNTRY: 25,
  COMPLETE_TRACKER: 200,
  UNLOCK_ACHIEVEMENT: 50,
  COMPLETE_CHALLENGE: 100,
  FIRST_TRACKER_VISIT: 15,
};

export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level, 1.5));
}

export function levelFromXp(totalXp) {
  let level = 1;
  let cumulative = 0;
  while (true) {
    const next = xpForLevel(level + 1);
    if (cumulative + next > totalXp) break;
    cumulative += next;
    level++;
  }
  return { level, currentXp: totalXp - cumulative, nextLevelXp: xpForLevel(level + 1) };
}

export function getUnlockedRewards(level) {
  // returns array of unlocked avatar category IDs
}
```

### `src/components/LevelBadge.jsx`
- Circular badge showing level number
- Rendered on avatar (in `AvatarEditor.jsx` and `FriendsPanel.jsx`)
- Color changes by tier: 1-9 bronze, 10-19 silver, 20-29 gold, 30+ diamond
- XP progress ring around the badge

### `src/components/XpNotification.jsx`
- Toast/popup that appears when XP is earned
- "+10 XP" with a subtle animation
- Auto-dismiss after 2 seconds
- Level-up gets a bigger celebration (confetti reuse)

### `src/hooks/useXp.js`
- Manages XP state
- `addXp(amount, reason)` — update local + POST to backend
- `getLevel()` — derived from total XP
- On level-up → trigger notification + check for new unlocks

## Backend Changes

### Database
```sql
ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;
```

Or a separate XP ledger for history:
```sql
CREATE TABLE xp_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,        -- 'visit_region', 'achievement', etc.
    tracker_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/user/xp` | Get total XP, level, progress |
| `POST` | `/api/user/xp` | Add XP (called by client on actions) |

### XP Grant Logic
- **Option A**: Client calculates and sends XP (simpler, less secure)
- **Option B**: Backend grants XP on visit/achievement events (more secure, preferred)
  - Hook into existing `PATCH /api/visited` — if a new region is added, grant XP server-side
  - Return `xp_gained` in the response

## Files to Modify

### `src/components/AvatarEditor.jsx`
- Show level badge on the avatar preview
- Gate `comingSoon` categories behind level requirements
- Show "Unlocks at Level X" instead of "Coming Soon"

### `src/config/avatarParts.js`
- Add `unlockLevel` field to categories:
  ```js
  { id: 'glasses', label: 'Glasses', unlockLevel: 5, comingSoon: false, ... }
  ```

### `src/components/Sidebar.jsx` or header
- Show level badge next to username

### `src/hooks/useVisitedCantons.js`
- After marking a region visited, call `addXp()` if authenticated

### `src/components/Achievements.jsx`
- After unlocking achievement, grant XP

## Guest Mode
- XP tracked in localStorage
- On account creation, migrate accumulated XP to backend

## Testing Checklist
- [ ] XP increments on visiting regions
- [ ] Level calculates correctly
- [ ] Level badge renders on avatar
- [ ] Level-up triggers celebration
- [ ] Avatar categories unlock at correct levels
- [ ] XP notification appears and auto-dismisses
- [ ] Backend XP is consistent with actions
- [ ] Guest mode XP persists and migrates
- [ ] Friend profiles show their level

## Estimated Effort
~10-14 hours
