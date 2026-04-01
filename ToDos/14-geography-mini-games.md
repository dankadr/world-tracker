# ToDo: Geography Mini Games

**Date:** 2026-03-06
**Status:** In Progress — stabilization PR #109 open (quiz pool filter, testids, onQuit cleanup)
**Priority:** Medium
**Scope:** Add interactive geography mini games where users test their knowledge on blank maps by guessing countries, states, cantons, and regions

---

## Overview

Add a "Games" section to the app where users can play geography quiz games using the existing map infrastructure (WorldMap, SwissMap). The core mechanic: show a blank/unlabeled map, highlight a random region, and ask the user to type or select its name. Games should integrate with the user's tracker data for personalized challenges (e.g., "Guess the countries you haven't visited yet").

## Current State

- `src/components/GamesPanel.jsx` is integrated into the app
- Implemented modes today: Map Quiz, Flag Quiz, Capital Quiz, and Shape Quiz
- Shared game engine exists in `src/hooks/useGeographyGame.js`
- Game achievements already exist in `src/config/achievements.json`
- Unit tests exist for the engine and related helpers
- Not yet shipped from this plan: daily challenge, streak mode, place-the-pin, neighbor challenge, custom region quiz, and backend score storage
- Current smoke-test artifacts indicate ongoing crash/regression work is still needed before calling the feature stable

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

### 4. Capital City Quiz
- Show a country name (or highlight a country) — user types its capital city
- Reverse mode: show the capital name — user guesses the country
- Variants: all capitals, only visited countries' capitals, hardest capitals only

### 5. Flag Quiz
- Display a country flag, user types or selects the matching country name
- Reverse mode: show a country name, user picks the correct flag from 4 options
- Difficulty affects flag similarity (easy = very distinct flags, hard = similar-looking flags)

### 6. Place the Pin
- A country or city name is shown as text (no map highlight)
- User clicks anywhere on the map to place a pin where they think it is
- Score based on distance from correct location: closer = more points
- Fun for cities too (e.g., "Where is Ulaanbaatar?")
- Shows the correct location and distance after each guess

### 7. Neighbor Challenge
- A country is highlighted — user must name ALL of its neighboring countries
- Points per correct neighbor; penalty for wrong guesses
- Variants: easy (border count shown as hint), hard (no hints)

### 8. Daily Challenge
- A fixed 10-question quiz that resets every 24 hours (same questions for all users, Wordle-style)
- Leaderboard shows how friends scored on the same daily set
- Streak counter: play every day to build a daily streak
- Questions mix multiple game types (one flag, one capital, one blank map, etc.)

### 9. Streak Mode (Survival)
- Answer correctly to keep going; first wrong answer ends the game
- Increasing difficulty as streak grows (easy countries first, obscure ones later)
- Global leaderboard for longest streaks

### 10. Custom Region Quiz *(stretch goal)*
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
| Globetrotter Quiz | Complete all game modes at least once |
| Capital Expert | 100% on Capital City quiz |
| Flag Master | 100% on Flag quiz |
| Dead On | Place a pin within 50km of the correct location |
| Good Neighbor | Name all neighbors of any country correctly |
| Daily Devotion | Complete the Daily Challenge 7 days in a row |
| Survivor | Reach a streak of 30 in Streak Mode |

---

## New Components

| Component | Purpose |
|-----------|---------|
| `src/components/GamesPanel.jsx` | Game mode selection hub |
| `src/components/GameScreen.jsx` | Active quiz UI (map + input + score bar) |
| `src/components/GameResultScreen.jsx` | End-of-game summary and actions |
| `src/components/GameMapOverlay.jsx` | Blank map rendering with highlight + pin-drop logic |
| `src/components/FlagQuizCard.jsx` | Flag image display + multiple choice or text input |
| `src/components/PlacePinGame.jsx` | Click-to-place-pin mechanic with distance scoring |
| `src/components/DailyChallenge.jsx` | Daily quiz card with streak counter and results |
| `src/hooks/useGeographyGame.js` | Game state, scoring, round management (all modes) |
| `src/hooks/useDailyChallenge.js` | Daily question generation (seeded by date), streak tracking |

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

**Blank Map Quiz (Countries / States / Cantons)**
- [ ] All 3 map types render correctly in game mode (labels hidden, regions clickable)
- [ ] Correct answer triggers green highlight and advances to next region
- [ ] Wrong answer triggers red highlight and shows correct name
- [ ] Timer counts down correctly in Medium and Hard modes
- [ ] Fuzzy name matching accepts common variations (e.g., "USA" → "United States")

**Capital City Quiz**
- [ ] Country → capital and capital → country modes both work
- [ ] Correct capital accepted regardless of diacritic variations (e.g., "Bogota" = "Bogotá")

**Flag Quiz**
- [ ] Flags render clearly at all screen sizes
- [ ] Multiple-choice options are plausible (no obviously wrong choices)
- [ ] Reverse mode (country → flag) works correctly

**Place the Pin**
- [ ] Pin placement registers correctly on click/tap
- [ ] Distance calculation is accurate
- [ ] Score scales correctly with distance (0km = 1000pts, >2000km = 0pts)
- [ ] Correct location marker shown after guess

**Neighbor Challenge**
- [ ] All neighbors of landlocked/island countries handled correctly
- [ ] Disputed territories / edge cases don't crash the game

**Daily Challenge**
- [ ] Same questions generated for all users on the same date
- [ ] Daily streak increments and resets correctly
- [ ] Completing today's challenge disables the play button until tomorrow

**Streak Mode**
- [ ] First wrong answer ends the game immediately
- [ ] Difficulty ramps up as streak grows
- [ ] Streak count persists in localStorage between sessions

**General**
- [ ] Score tallied correctly at end of game
- [ ] Result screen shows missed regions on map
- [ ] "Add to Bucket List" bulk action works from result screen
- [ ] Game achievements unlock correctly
- [ ] High scores persist between sessions (localStorage)
- [ ] Works in guest mode
- [ ] Keyboard navigation (Enter to submit, Tab to skip) works
- [ ] Mobile touch interactions work correctly on map

---

## Estimated Effort
- Game state hook + scoring logic: ~3-4 hours
- Map game mode (blank map, highlight, click): ~4-5 hours
- Games panel + UI: ~3-4 hours
- Game result screen + bucket list integration: ~2-3 hours
- Capital City quiz: ~2-3 hours
- Flag quiz: ~3-4 hours
- Place the Pin (distance scoring + pin UI): ~4-5 hours
- Neighbor Challenge: ~2-3 hours
- Daily Challenge + streak tracking: ~3-4 hours
- Streak / Survival mode: ~2-3 hours
- Achievements integration: ~1-2 hours
- Backend high scores + daily leaderboard (stretch): ~4-5 hours
- **Total: ~33-45 hours (all modes), ~16-22 hours (core map quiz only)**
