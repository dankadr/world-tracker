# Shape Quiz — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Add a Shape Quiz game — a country is highlighted in blue on a blank world map, the player types its name.

**Architecture:** New `ShapeQuiz` component reusing `useGeographyGame`, `AnswerInput`, `GameTopBar`, `GameResultScreen`, and `WorldMap` with `gameMode`. Pool/filter logic copied from `MapQuiz`. `WorldMap` gains `targetId` blue highlight support (re-added to `getStyle`).

**Tech Stack:** React, Leaflet (via WorldMap), existing `checkTextAnswer` + alias map, localStorage high scores.

---

## Component Structure

```
GamesPanel
└── ShapeQuiz               — new file
    ├── WorldMap (gameMode) — targetId painted blue
    ├── AnswerInput         — fuzzy text input, reused
    ├── GameTopBar          — reused
    └── GameResultScreen    — reused
```

**New files:**
- `src/components/games/ShapeQuiz.jsx`

**Modified files:**
- `src/components/WorldMap.jsx` — re-add `targetId` blue highlight in `getStyle`
- `src/components/GamesPanel.jsx` — 4th game card + ShapeQuiz screen + reuse MapConfig

---

## ShapeQuiz

Pool and filter logic identical to MapQuiz — same `buildPool(filter, worldVisited)` and `CONTINENT_FILTER_KEYS`.

`gameMode` object passed to WorldMap:
```js
const gameMode = useMemo(() => ({
  targetId: question?.id,
  correctId,
  incorrectId,
  onCountryClick: null, // map is not clickable
}), [question?.id, correctId, incorrectId]);
```

Answer flow:
- `AnswerInput` with `candidates = pool` (all countries in pool), `nameKey = "name"`
- On submit: `checkTextAnswer(text, candidate.name)` to find match, then `submit(match?.id ?? text)`
- Correct → `setCorrectId(question.id)` (green flash on the country)
- Wrong → `setIncorrectId(question.id)` (red flash on the country) + show correct name in review banner
- On question advance: clear `correctId`/`incorrectId` via `useEffect([questionIndex])`

During `reviewing`: AnswerInput disabled (same pattern as FlagQuiz/CapitalQuiz).

---

## WorldMap — targetId highlight

Re-add to `getStyle` game mode block:
```js
if (gameMode) {
  if (id === gameMode.correctId)  return { fillColor: '#22c55e', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.incorrectId) return { fillColor: '#ef4444', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.targetId)   return { fillColor: '#3b82f6', fillOpacity: 0.75, color: '#fff', weight: 2 };
  return { fillColor: '#cfd8dc', fillOpacity: 0.3, color: 'rgba(0,0,0,0.05)', weight: 0.5 };
}
```

Also update the imperative `useEffect` in WorldMap to handle `targetId`:
```js
if (id === gameMode.correctId)   l.setStyle({ fillColor: '#22c55e', ... });
else if (id === gameMode.incorrectId) l.setStyle({ fillColor: '#ef4444', ... });
else if (id === gameMode.targetId)    l.setStyle({ fillColor: '#3b82f6', fillOpacity: 0.75, color: '#fff', weight: 2 });
else                                  l.setStyle({ fillColor: '#cfd8dc', ... });
```

WorldMap click handler: when `gameModeRef.current` is set but `onCountryClick` is null, do nothing (map is view-only in Shape Quiz).

---

## Scoring

Score key: `shape_${filter}` (e.g. `shape_all`, `shape_europe`). Same localStorage structure as map scores.

---

## GamesPanel

Add 4th card:
```
🌍 Shape Quiz
Name the highlighted country
Best: X% (N/M)
[Play]
```

Tapping Play → reuse existing `MapConfig` component (same filter options) → `setScreen('shape')`.

New state: `shapeFilter` (default `'all'`).

Screen routing:
```js
if (screen === 'shape-config') return <MapConfig onBack={handleBack} onStart={f => { setShapeFilter(f); setScreen('shape'); }} />;
if (screen === 'shape') return <ShapeQuiz key={gameKey} filter={shapeFilter} worldVisited={worldVisited} onBack={handleBack} onPlayAgain={handlePlayAgain} />;
```
