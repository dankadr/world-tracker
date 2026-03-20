# ToDo: More Geography Game Types

**Date:** 2026-03-15
**Status:** Planned
**Priority:** Medium
**Scope:** Add new quiz game types to the existing Geography Games section: Population Quiz, Currency Quiz, Language Quiz, and a Daily Challenge mode

---

## Overview

The games section currently has 4 games: Map Quiz, Flag Quiz, Capital Quiz, Shape Quiz. These are all well-built and fun, but they cover the same dimension (visual/capital recognition). Adding games around population, currency, and language deepens the geography education angle and gives users more reasons to return daily.

## Current State

- `src/components/games/` contains: `MapQuiz`, `FlagQuiz`, `CapitalQuiz`, `ShapeQuiz`
- `src/components/GamesPanel.jsx` — entry point, renders game cards
- `src/hooks/useGeographyGame.js` — core quiz state machine (shared by all games)
- `src/utils/gameScores.js` — high score tracking in localStorage
- `src/utils/gameAnswers.js` — answer validation helpers
- `src/data/capitals.json` — capital city data

## New Game Designs

### 1. Population Quiz

"Which country has a larger population? A or B?"

- 2-choice comparison (easier to implement, more fun to play)
- 10 rounds per game
- Countries shown with flag + name
- After answering: reveal both populations with animated count-up
- "Streak mode" — keep going until you get one wrong
- High score: streak length

### 2. Currency Quiz

"What currency does [Country] use?"

- Multiple choice, 4 options
- Questions: country → currency name OR currency symbol → country
- Show currency symbol + ISO code after reveal
- Data needed: `src/data/currencies.json` (generate from RestCountries static snapshot)
- Difficulty levels: common currencies (easy) vs obscure currencies (hard)

### 3. Language Quiz

"What is the official language of [Country]?"

- Multiple choice, 4 options
- Filter mode: single-language countries only (avoids tricky multi-lingual edge cases for easy mode)
- Hard mode includes multi-lingual countries (e.g. "Which language is NOT official in Switzerland?")
- Data needed: `src/data/languages.json`

### 4. Daily Challenge Mode

- One fixed quiz per day (same seed for all users — seeded RNG based on date)
- Mix of question types: 3x map, 3x flag, 2x capital, 2x population
- Score posted to friends leaderboard for that day
- Shared result snippet ("I scored 8/10 on today's Daily Challenge! 🌍")
- Streak counter: how many consecutive days played
- Stores completion in localStorage: `daily-challenge-{YYYY-MM-DD}`

## Technical Design

### Shared Infrastructure

All new games reuse `useGeographyGame.js`. New games only need a question generator:

```js
// Pattern each game follows:
function generatePopulationQuestion(allCountries, filter) {
  const [a, b] = pickRandom2(allCountries);
  return {
    prompt: `Which country has a larger population?`,
    optionA: { id: a.id, label: a.name, flag: a.flag },
    optionB: { id: b.id, label: b.name, flag: b.flag },
    correctId: a.population > b.population ? a.id : b.id,
    revealData: { aPopulation: a.population, bPopulation: b.population },
  };
}
```

### Data Files Needed

`src/data/country-facts.json` — consolidate population, currency, language into one file per country (reuse work from ToDo #18 country info cards):

```json
{
  "de": {
    "population": 83240525,
    "currency": "EUR",
    "currencyName": "Euro",
    "currencySymbol": "€",
    "languages": ["German"]
  }
}
```

### Daily Challenge

`utils/dailyChallenge.js`:
```js
// Seeded RNG (mulberry32 or xoshiro128)
export function getDailyChallenge(date = new Date()) {
  const seed = dateToSeed(date);  // deterministic from YYYY-MM-DD
  return generateMixedQuiz(seed, DAILY_QUESTION_COUNT);
}

export function getDailyChallengeResult(date) { ... }
export function saveDailyChallengeResult(date, score) { ... }
```

### GamesPanel Updates

Add new cards to the grid:
- 🌍 Population Quiz
- 💰 Currency Quiz
- 🗣️ Language Quiz
- 📅 Daily Challenge (featured card at top, highlighted if not played today)

### Score Sharing

For Daily Challenge:
```
I scored 9/10 on the World Tracker Daily Challenge! 🌍
🟩🟩🟩🟩🟩🟩🟩🟩🟩🟥
Play at [app URL]
```
(Wordle-style share text, copyable via Share API)

## Implementation Phases

### Phase 1 — Data
- [ ] Generate `src/data/country-facts.json` (population, currency, language per country code)
- [ ] Verify coverage — handle missing data gracefully

### Phase 2 — Population Quiz
- [ ] `src/components/games/PopulationQuiz.jsx`
- [ ] Update `GamesPanel` with new card
- [ ] High score tracking
- [ ] Tests

### Phase 3 — Currency + Language Quiz
- [ ] `src/components/games/CurrencyQuiz.jsx`
- [ ] `src/components/games/LanguageQuiz.jsx`
- [ ] Easy/hard mode toggles
- [ ] Tests

### Phase 4 — Daily Challenge
- [ ] `utils/dailyChallenge.js` — seeded RNG + question generation
- [ ] `DailyChallengeScreen` — mixed quiz with special UI (progress tracker, streak counter)
- [ ] Daily result sharing (Web Share API)
- [ ] Streak badge in GamesPanel
- [ ] Featured card in GamesPanel (different highlight if already played today)
- [ ] Tests: seeded RNG determinism, streak tracking

## Notes

- Population data goes stale — add a comment in the JSON with the data vintage year
- Currency data is relatively stable — only major currency reforms require updates
- Daily Challenge seed must be computed from UTC date (not local TZ) to ensure all users get the same quiz on the same day
- `useGeographyGame.js` already handles scoring, timing, and state — new games plug in cleanly
