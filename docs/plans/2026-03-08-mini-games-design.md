# Geography Mini Games — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Add three geography quiz games (Map Quiz, Flag Quiz, Capital Quiz) accessible from the Explore tab.

**Architecture:** Shared `useGeographyGame` engine hook + per-mode components plugged into it. `GamesPanel` is the selection screen, `GameResultScreen` is the shared end screen.

**Tech Stack:** React, Leaflet (map quiz), localStorage (high scores), existing fuzzy match + diacritic stripping utils.

---

## Scope

Three game modes:
1. **Map Quiz** — world map, one country highlighted, user clicks the correct country
2. **Flag Quiz** — flag emoji shown, user types/selects the country name
3. **Capital Quiz** — two sub-modes: country→capital and capital→country, user types the answer

---

## Component Structure

```
Explore tab
└── GamesPanel                  — mode selection grid with best scores
    ├── MapQuiz                 — world map game
    ├── FlagQuiz                — flag card game
    ├── CapitalQuiz             — capital card game
    └── GameResultScreen        — shared end screen
```

**New files:**
- `src/components/GamesPanel.jsx` + `GamesPanel.css`
- `src/components/games/MapQuiz.jsx`
- `src/components/games/FlagQuiz.jsx`
- `src/components/games/CapitalQuiz.jsx`
- `src/components/games/GameResultScreen.jsx`
- `src/components/games/GameTopBar.jsx` — shared top bar (score, timer, quit)
- `src/components/games/AnswerInput.jsx` — shared fuzzy input with autocomplete
- `src/hooks/useGeographyGame.js`

**Modified files:**
- `src/components/WorldMap.jsx` — add `gameMode` prop
- `src/App.jsx` — wire Explore tab to GamesPanel
- `src/config/achievements.json` — 4 new achievements

---

## Game Engine (`useGeographyGame`)

```js
const {
  question,       // current item { id, name, flag?, capital? }
  questionIndex,  // 0-based
  total,          // pool size
  score,          // { correct, incorrect, skipped }
  timeLeft,       // seconds remaining | null (no timer)
  status,         // 'playing' | 'reviewing' | 'finished'
  isCorrect,      // null | true | false (during 'reviewing')
  lastCorrectAnswer, // shown during reviewing when wrong
  submit(answer), // check answer, sets isCorrect, advances after 1.2s
  skip(),         // mark skipped, advance
  finish(),       // force end (quit)
} = useGeographyGame(pool, { timeLimit, onFinish })
```

- Pool is shuffled once at mount
- Timer is global (not per-question); null = no timer (Easy mode)
- `submit()` accepts either an ID (map quiz) or text (flag/capital)
- Text answers: lowercased, diacritics stripped, aliases resolved before comparison
- After each answer: 1.2s `reviewing` pause showing green/red feedback, then auto-advance
- When pool exhausted or timer hits 0: status → `'finished'`, `onFinish(score)` called

---

## Map Quiz

**WorldMap changes:** add `gameMode` prop:
```js
// When gameMode is set:
// - Force "clean" (no-labels) tile layer
// - Override click handler to call gameMode.onCountryClick(id)
// - Apply highlight style to gameMode.targetId country
// - Apply correct/incorrect flash styles during reviewing
```

**Pre-game filter (shown in GamesPanel before starting):**
- All countries (195)
- Only visited
- Only unvisited
- By continent (Africa, Asia, Europe, North America, South America, Oceania)

**In-game UI:**
- Map takes full screen
- `GameTopBar` pinned at top: `Q 12/54 · ✓ 10 · ✗ 2 · ⏱ 1:23` + Quit button
- Small floating prompt card centered over highlighted country: `"Click this country"`
- Highlighted country: distinct blue (`#3b82f6`) fill
- Correct guess: green flash on clicked country
- Wrong guess: red flash on clicked country + green on correct country (both shown 1.2s)

---

## Flag Quiz

**Pool:** all world countries from `world.json` features (195 countries), using emoji flags from `countries.json`.

**In-game UI:**
- `GameTopBar` at top
- Large flag emoji (6rem) centered
- `AnswerInput` below: text input with autocomplete dropdown (top 5 fuzzy matches)
- Submit + Skip buttons

**Answer matching:** lowercase + strip diacritics + alias map:
```js
const ALIASES = { 'usa': 'us', 'uk': 'gb', 'czech republic': 'cz', ... }
```

---

## Capital Quiz

**Pool:** built from `capitals.json` — countries that have a capital entry (~180 countries).

**Sub-modes (picked before starting):**
- **Country → Capital:** show country name + flag emoji, user types capital city name
- **Capital → Country:** show capital city name, user types country name

**Answer matching:** same fuzzy + diacritic stripping as Flag Quiz.

---

## GamesPanel

Mode selection screen — shown on Explore tab:

```
┌──────────────────────────────────────┐
│  🎮 Geography Games                   │
│──────────────────────────────────────│
│  ┌───────────┐   ┌───────────┐       │
│  │ 🗺️ Map Quiz│   │🏳️ Flag Quiz│      │
│  │ Best: 22% │   │ Best: —   │       │
│  │  [Play]   │   │  [Play]   │       │
│  └───────────┘   └───────────┘       │
│  ┌───────────┐                       │
│  │🏛️ Capital  │                       │
│  │ Best: —   │                       │
│  │  [Play]   │                       │
│  └───────────┘                       │
└──────────────────────────────────────┘
```

Tapping Play → pre-game config screen (filter for map quiz, sub-mode for capital quiz) → Start.

---

## GameResultScreen (shared)

Shown after any game ends:

```
🗺️ Map Quiz — Results
Score: 42 / 195   (22%)   Time: 3:42
✓ 42   ✗ 38   ⤼ 115

Missed: Algeria, Myanmar, Uruguay...
Best streak: 12 in a row

[Play Again]  [Back to Games]
```

- If new high score: shows "🏆 New best!" banner
- Checks and unlocks achievements inline

---

## High Scores

Stored in localStorage under key `swiss-tracker-game-scores` (not user-prefixed — scores are local):

```json
{
  "map_all":        { "correct": 42, "total": 195, "pct": 22 },
  "map_visited":    { "correct": 18, "total": 20,  "pct": 90 },
  "flag":           { "correct": 80, "total": 195, "pct": 41 },
  "capital_country":{ "correct": 55, "total": 150, "pct": 37 },
  "capital_city":   { "correct": 30, "total": 150, "pct": 20 }
}
```

Score key for map quiz includes filter: `map_all`, `map_visited`, `map_unvisited`, `map_africa`, etc.

---

## Achievements (4 new)

Added to `src/config/achievements.json`:

| ID | Icon | Title | Rule |
|---|---|---|---|
| `game-first` | 🎮 | First Quiz | Complete any game |
| `game-perfect` | ⭐ | Perfect Score | 100% on any quiz |
| `game-cartographer` | 🗺️ | Cartographer | Complete full world map quiz (all 195) |
| `game-flag-master` | 🏳️ | Flag Master | 100% on Flag quiz |

New rule type: `gameCompleted: { mode?, minPct? }` — evaluated in `GameResultScreen` after each game, stored in localStorage under `swiss-tracker-game-completed`.

---

## App.jsx Integration

Replace the Explore tab placeholder in `App.jsx`:

```jsx
// Before:
{isMobile && !isShareMode && activeTab === 'explore' && (
  <div className="tab-screen tab-screen-placeholder">...</div>
)}

// After:
{isMobile && !isShareMode && activeTab === 'explore' && (
  <div className="tab-screen">
    <GamesPanel worldVisited={worldVisited} />
  </div>
)}
```

`GamesPanel` receives `worldVisited` so the map quiz filter can build the "visited" / "unvisited" pools.
