# Plan: Achievement Progress Bars

## Overview
Show partial progress on achievements instead of just locked/unlocked. E.g., "Alpine Explorer: 15/26 cantons" with a visual progress bar.

## Current State
- Achievements are defined in JSON config files (e.g., `swiss-achievements.json`)
- `Achievements.jsx` renders them as locked/unlocked badges
- Unlock logic checks if visited count meets a threshold

## Changes Needed

### `src/config/*-achievements.json` (all tracker achievement files)
Add progress metadata to each achievement:

```json
{
  "id": "all-cantons",
  "title": "Swiss Master",
  "description": "Visit all 26 cantons",
  "icon": "🏔️",
  "type": "count",
  "tracker": "ch",
  "target": 26,
  "subset": null,
  "category": "exploration"
}
```

New fields:
- `type`: `"count"` (visit N regions), `"subset"` (visit specific list), `"special"`
- `target`: number needed to unlock
- `subset`: optional array of specific region IDs (e.g., `["ZH", "BE", "LU"]` for a "Big 3" achievement)
- `category`: for grouping in UI (`"exploration"`, `"mastery"`, `"social"`)

### `src/components/Achievements.jsx`
- Compute `current` count for each achievement based on `type`:
  - `count` → `visited.size` (or filtered by tracker)
  - `subset` → `subset.filter(r => visited.has(r)).length`
- Render progress bar inside each achievement card
- Show `"15 / 26"` text
- Animate bar fill with CSS transition
- Sort: in-progress first, then completed, then locked (0 progress)

### `src/components/AchievementCard.jsx` (new)
Extract individual achievement rendering:

```jsx
<div className={`achievement-card ${unlocked ? 'unlocked' : ''}`}>
  <div className="achievement-icon">{icon}</div>
  <div className="achievement-info">
    <h4>{title}</h4>
    <p>{description}</p>
    <div className="progress-bar-track">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
    <span className="progress-text">{current} / {target}</span>
  </div>
</div>
```

### `src/styles/*.css`
```css
.progress-bar-track {
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}
.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.6s ease;
}
.achievement-card.unlocked .progress-bar-fill {
  background: var(--success);
}
.progress-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
```

## Files to Modify
- `src/components/Achievements.jsx` — Add progress computation + rendering
- `src/config/swiss-achievements.json` — Add `target`, `type`, `subset` fields
- `src/config/us-achievements.json` — Same
- All other `*-achievements.json` files — Same
- `src/styles/` — Add progress bar CSS

## Files to Create
- `src/components/AchievementCard.jsx` — Extracted card component
- `src/utils/achievementProgress.js` — Pure function: `computeProgress(achievement, visited) → { current, target, pct, unlocked }`

## Edge Cases
- Achievements with no meaningful progress (e.g., "first visit") → show as 0/1 or 1/1, no bar
- `target: 0` or missing → fallback to boolean
- Subset achievements where subset regions don't exist in current GeoJSON → filter gracefully

## Testing Checklist
- [ ] Progress bars render for all achievements
- [ ] Progress updates in real-time when visiting/unvisiting
- [ ] Completed achievements show full green bar
- [ ] 0-progress achievements show empty bar
- [ ] Animation is smooth
- [ ] Dark mode contrast is good
- [ ] Mobile layout doesn't break

## Estimated Effort
~3-4 hours
