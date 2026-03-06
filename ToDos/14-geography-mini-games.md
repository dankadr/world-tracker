# ToDo: Geography Mini Games

**Date:** 2026-03-06
**Status:** Not Started
**Priority:** Medium
**Scope:** Add interactive geography mini games where users test their knowledge on blank maps by guessing countries, states, cantons, and regions

---

## Overview

Add a "Games" section to the app where users can play geography quiz games using the existing map infrastructure (WorldMap, SwissMap). The core mechanic: show a blank/unlabeled map, highlight a random region, and ask the user to type or select its name. Games should integrate with the user's tracker data for personalized challenges (e.g., "Guess the countries you haven't visited yet").

---

## Game Modes

### 1. World Countries Quiz
- Show the world map with all labels hidden
- Highlight a random country in a distinct color
- User types the country name (with fuzzy matching / autocomplete)
- Score: correct guesses within a time limit
- Variants:
  - **Classic:** guess all countries in order, no time pressure
  - **Speed Round:** 60 seconds, as many correct guesses as possible
  - **My Travels:** only quiz countries the user has visited
  - **Unvisited Challenge:** only quiz countries the user hasn't been to yet

### 2. US States Quiz
- Show a blank USA map (states only, no labels)
- Same click-and-guess mechanic
- Variants: all states, only visited states, only unvisited states

### 3. Swiss Cantons Quiz
- Show the blank SwissMap (cantons unlabeled)
- User guesses canton names
- Useful for Swiss-focused power users

### 4. Custom Region Quiz *(stretch goal)*
- User selects a continent or custom region (e.g., "Europe only", "South America only")
- Only regions within that scope appear in the quiz

---

## Core Game Mechanics

### Interaction Flow
1. User opens the Games panel
2. Selects a game mode and difficulty
3. A blank map renders with one region highlighted
4. User types a guess into an input field (with autocomplete suggestions) OR clicks a region on the map to identify it
5. Feedback: green flash for correct, red flash + correct answer shown for wrong
6. Score increments; next region is highlighted automatically
7. End screen shows final score, percentage, time taken, and missed regions

### Scoring
```
{
  correct: 42,
  incorrect: 8,
  skipped: 5,
  total: 55,
  percentage: 76%,
  time_taken: "3m 42s",
  best_streak: 12
}
```

### Difficulty Levels
| Level | Time Limit | Hints | Skip Allowed |
|-------|-----------|-------|--------------|
| Easy | None | Capital + flag shown | Yes |
| Medium | 90s total | Flag only | Yes |
| Hard | 60s total | None | No |

---

## UI / UX Design

### Games Panel (`src/components/GamesPanel.jsx`)
- Entry point accessible from main nav (game controller icon)
- Grid of game mode cards with thumbnail, title, description, best score
- "Play" button on each card launches the game

### Game Screen (`src/components/GameScreen.jsx`)
- Full-screen or large modal overlay
- Map occupies ~70% of the screen
- Bottom bar: current question indicator, score, timer, input field
- "Quit" button in top-right corner
- Keyboard shortcut: `Enter` to submit, `Tab` to skip

### Result Screen (`src/components/GameResultScreen.jsx`)
- Final score summary with emoji feedback
- Map showing all regions color-coded: green (got it), red (missed), yellow (skipped)
- "Play Again", "Try Different Mode", "Share Score" buttons
- Option to add missed regions to bucket list

```
┌─────────────────────────────────────┐
│  🗺️  World Countries Quiz — Results  │
│  Score: 42/55  (76%)   Time: 3:42   │
│─────────────────────────────────────│
│  [Colored world map showing results] │
│─────────────────────────────────────│
│  Missed: Algeria, Myanmar, Uruguay  │
│  Best streak: 12 in a row           │
│─────────────────────────────────────│
│ [Play Again] [New Mode] [Add Missed │
│              to Bucket List]         │
└─────────────────────────────────────┘
```

---

## Integration with Existing Features

- **Tracker integration:** "My Travels" mode pulls from `useVisited` / tracker data
- **Bucket list integration:** End screen can bulk-add missed regions to the bucket list
- **Achievements:** New achievements unlock for completing game milestones (see below)
- **Guest mode:** Games work fully in guest mode (scores saved to localStorage)

---

## New Achievements (via existing achievement system)

| Achievement | Trigger |
|-------------|---------|
| First Quiz | Complete any quiz |
| Perfect Score | 100% on any quiz |
| Speed Demon | Complete Speed Round with 30+ correct |
| Cartographer | Complete full World Countries quiz |
| Swiss Expert | 100% on Swiss Cantons quiz |
| Home Turf | 100% on US States quiz |
| No Peeking | Complete Hard mode with no skips |
| Globetrotter Quiz | Complete all 4 game modes at least once |

---

## New Components

| Component | Purpose |
|-----------|---------|
| `src/components/GamesPanel.jsx` | Game mode selection hub |
| `src/components/GameScreen.jsx` | Active quiz UI (map + input + score bar) |
| `src/components/GameResultScreen.jsx` | End-of-game summary and actions |
| `src/components/GameMapOverlay.jsx` | Blank map rendering with highlight logic |
| `src/hooks/useGeographyGame.js` | Game state, scoring, round management |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/WorldMap.jsx` | Add `gameMode` prop to hide labels and expose click/highlight API |
| `src/components/SwissMap.jsx` | Same `gameMode` prop as WorldMap |
| `src/App.jsx` (or main nav) | Add "Games" navigation item |
| `src/hooks/useAchievements.js` | Add new game-related achievement definitions |
| `backend/main.py` | Add endpoints for saving/fetching high scores (optional, stretch goal) |

---

## Data Model

### Game Session (localStorage / API)
```json
{
  "id": "game-session-uuid",
  "user_id": "user-uuid",
  "mode": "world_countries",
  "difficulty": "medium",
  "score": { "correct": 42, "incorrect": 8, "skipped": 5 },
  "time_taken_seconds": 222,
  "missed_regions": ["dz", "mm", "uy"],
  "played_at": "2026-03-06T14:00:00Z"
}
```

### High Scores (per mode + difficulty)
```json
{
  "world_countries_medium": { "best_score": 42, "best_time": 222 },
  "swiss_cantons_hard": { "best_score": 26, "best_time": 180 }
}
```

---

## Backend API (Optional — Stretch Goal)

```
POST /api/games/scores          # Save a completed game session
GET  /api/games/scores/me       # Get current user's high scores
GET  /api/games/leaderboard/{mode}  # Top scores for a mode (future)
```

---

## Testing Checklist
- [ ] All 3 map types render correctly in game mode (labels hidden, regions clickable)
- [ ] Correct answer triggers green highlight and advances to next region
- [ ] Wrong answer triggers red highlight and shows correct name
- [ ] Timer counts down correctly in Medium and Hard modes
- [ ] Score tallied correctly at end of game
- [ ] Result screen shows missed regions on map
- [ ] "Add to Bucket List" bulk action works from result screen
- [ ] Game achievements unlock correctly
- [ ] High scores persist between sessions (localStorage)
- [ ] Works in guest mode
- [ ] Keyboard navigation (Enter to submit, Tab to skip) works
- [ ] Fuzzy name matching accepts common variations (e.g., "USA" → "United States")
- [ ] Mobile touch interactions work correctly on map

---

## Estimated Effort
- Game state hook + scoring logic: ~3-4 hours
- Map game mode (blank map, highlight, click): ~4-5 hours
- Games panel + UI: ~3-4 hours
- Game result screen + bucket list integration: ~2-3 hours
- Achievements integration: ~1-2 hours
- Backend high scores (stretch): ~3-4 hours
- **Total: ~16-22 hours (core), +3-4 hours for backend**
