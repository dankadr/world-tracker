# Shape Quiz Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Shape Quiz game where a country is highlighted in blue on a blank world map and the player types its name.

**Architecture:** New `ShapeQuiz.jsx` reuses `useGeographyGame`, `AnswerInput`, `GameTopBar`, `GameResultScreen`, and `WorldMap` with `gameMode`. Two existing files need small changes: `WorldMap.jsx` (re-add `targetId` blue highlight) and `GamesPanel.jsx` (add 4th card + routing).

**Tech Stack:** React, Leaflet (via WorldMap), existing `checkTextAnswer` fuzzy matching, localStorage high scores.

---

### Task 1: Add `targetId` support back to WorldMap

The `targetId` highlight was intentionally removed from Map Quiz (it gave the answer away). Shape Quiz needs it back — here the whole point is the blue country.

**Files:**
- Modify: `src/components/WorldMap.jsx`

**Step 1: Update `getStyle` to paint `targetId` blue**

In `getStyle` (around line 303), the game mode block currently reads:

```js
if (gameMode) {
  if (id === gameMode.correctId) return { fillColor: '#22c55e', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.incorrectId) return { fillColor: '#ef4444', fillOpacity: 0.8, color: '#fff', weight: 2 };
  return { fillColor: '#cfd8dc', fillOpacity: 0.3, color: 'rgba(0,0,0,0.05)', weight: 0.5 };
}
```

Add the `targetId` case (between incorrectId and the default):

```js
if (gameMode) {
  if (id === gameMode.correctId)   return { fillColor: '#22c55e', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.incorrectId) return { fillColor: '#ef4444', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.targetId)    return { fillColor: '#3b82f6', fillOpacity: 0.75, color: '#fff', weight: 2 };
  return { fillColor: '#cfd8dc', fillOpacity: 0.3, color: 'rgba(0,0,0,0.05)', weight: 0.5 };
}
```

**Step 2: Update the imperative `useEffect` to handle `targetId`**

The effect at line 256 iterates all layers and calls `setStyle` imperatively (needed because react-leaflet doesn't reliably re-apply function styles on mobile). Add the `targetId` case:

```js
useEffect(() => {
  if (!gameMode) return;
  const layer = geoJsonRef.current;
  if (!layer) return;
  layer.eachLayer((l) => {
    const id = l.feature?.properties?.id;
    if (!id) return;
    if (id === gameMode.correctId) {
      l.setStyle({ fillColor: '#22c55e', fillOpacity: 0.8, color: '#fff', weight: 2 });
    } else if (id === gameMode.incorrectId) {
      l.setStyle({ fillColor: '#ef4444', fillOpacity: 0.8, color: '#fff', weight: 2 });
    } else if (id === gameMode.targetId) {
      l.setStyle({ fillColor: '#3b82f6', fillOpacity: 0.75, color: '#fff', weight: 2 });
    } else {
      l.setStyle({ fillColor: '#cfd8dc', fillOpacity: 0.3, color: 'rgba(0,0,0,0.05)', weight: 0.5 });
    }
  });
}, [gameMode]);
```

**Step 3: Guard `onCountryClick` call with optional chaining**

Shape Quiz passes `onCountryClick: null` (map is view-only). The click handler at line 381 currently calls `gameModeRef.current.onCountryClick(id)` unconditionally, which would throw. Fix with `?.`:

```js
click: (e) => {
  if (gameModeRef.current) {
    gameModeRef.current.onCountryClick?.(id);
    return;
  }
```

**Step 4: Run existing tests to confirm nothing broke**

```bash
npm test -- --run
```

Expected: all existing tests pass.

**Step 5: Commit**

```bash
git add src/components/WorldMap.jsx
git commit -m "feat(world-map): re-add targetId highlight and guard onCountryClick"
```

---

### Task 2: Create `ShapeQuiz.jsx`

**Files:**
- Create: `src/components/games/ShapeQuiz.jsx`

**Step 1: Write the component**

```jsx
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { saveHighScore, isNewHighScore } from '../../utils/gameScores';
import { recordGameCompletion } from '../../utils/gameAchievements';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import WorldMap from '../WorldMap';
import worldData from '../../data/world.json';
import continentMap from '../../config/continents.json';
import './games.css';

const CONTINENT_FILTER_KEYS = {
  africa: 'Africa',
  asia: 'Asia',
  europe: 'Europe',
  north_america: 'North America',
  south_america: 'South America',
  oceania: 'Oceania',
};

function buildPool(filter, worldVisited) {
  return worldData.features
    .filter(f => {
      const id = f.properties.id;
      if (filter === 'visited') return worldVisited.has(id);
      if (filter === 'unvisited') return !worldVisited.has(id);
      if (CONTINENT_FILTER_KEYS[filter]) return continentMap[id] === CONTINENT_FILTER_KEYS[filter];
      return true;
    })
    .map(f => ({ id: f.properties.id, name: f.properties.name }));
}

function getScoreKey(filter) {
  return `shape_${filter}`;
}

export default function ShapeQuiz({ filter = 'all', worldVisited = new Set(), onBack, onPlayAgain }) {
  const pool = useMemo(() => buildPool(filter, worldVisited), [filter, worldVisited]);
  const isNewBestRef = useRef(false);

  const [correctId, setCorrectId] = useState(null);
  const [incorrectId, setIncorrectId] = useState(null);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    const key = getScoreKey(filter);
    isNewBestRef.current = isNewHighScore(key, pct);
    saveHighScore(key, { correct: score.correct, total, pct });
    recordGameCompletion(key, pct);
  }, [filter]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  // Clear highlights when question advances
  useEffect(() => {
    setCorrectId(null);
    setIncorrectId(null);
  }, [questionIndex]);

  // Stable submit ref so handleTextSubmit has empty deps
  const submitStateRef = useRef({ question, submit });
  submitStateRef.current = { question, submit };

  const handleTextSubmit = useCallback((text) => {
    const { question: q, submit: sub } = submitStateRef.current;
    if (!q) return;
    const match = pool.find(c => checkTextAnswer(text, c.name));
    const correct = match?.id === q.id;
    if (correct) {
      setCorrectId(q.id);
      setIncorrectId(null);
    } else {
      setIncorrectId(q.id);
      setCorrectId(null);
    }
    sub(match?.id ?? text);
  }, [pool]); // pool is stable (useMemo); question/submit read via ref

  const gameMode = useMemo(() => ({
    targetId: question?.id ?? null,
    correctId,
    incorrectId,
    onCountryClick: null, // map is view-only in Shape Quiz
  }), [question?.id, correctId, incorrectId]);

  if (status === 'finished') {
    return (
      <GameResultScreen
        title="Shape Quiz"
        score={score}
        timeTaken={null}
        isNewBest={isNewBestRef.current}
        onPlayAgain={onPlayAgain}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
          gameMode={gameMode}
        />
      </div>
      <div style={{ padding: '12px 16px 20px', background: 'var(--bg, #fff)' }}>
        {status === 'reviewing' && (
          <div style={{
            textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: 10,
            color: isCorrect ? '#22c55e' : '#ef4444',
          }}>
            {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
          </div>
        )}
        <AnswerInput
          candidates={pool}
          nameKey="name"
          onSubmit={handleTextSubmit}
          onSkip={skip}
          disabled={status === 'reviewing'}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify the file looks right — check for obvious issues**

- `gameMode.targetId` is set to `question?.id` — the current country is painted blue
- `handleTextSubmit` checks `match?.id === q.id` to determine correct/incorrect for the visual flash, then calls `sub(match?.id ?? text)` — the hook's own comparison handles final scoring
- `onCountryClick: null` — the `?.` guard added in Task 1 prevents crashes

**Step 3: Run existing tests**

```bash
npm test -- --run
```

Expected: all pass (no new test file needed — ShapeQuiz is a UI component with no new pure logic; all underlying logic is already tested).

**Step 4: Commit**

```bash
git add src/components/games/ShapeQuiz.jsx
git commit -m "feat: add ShapeQuiz component"
```

---

### Task 3: Wire ShapeQuiz into GamesPanel

**Files:**
- Modify: `src/components/GamesPanel.jsx`

**Step 1: Add import and state**

At the top of the file, add the import after the other quiz imports:

```js
import ShapeQuiz from './games/ShapeQuiz';
```

Inside `GamesPanel`, add `shapeFilter` state alongside the other filter states:

```js
const [shapeFilter, setShapeFilter] = useState('all');
```

**Step 2: Add screen routing**

Add two new `if` blocks alongside the existing screen checks (before the `return` for the home screen):

```js
if (screen === 'shape-config') return <MapConfig onBack={handleBack} onStart={f => { setShapeFilter(f); setScreen('shape'); }} />;
if (screen === 'shape') return <ShapeQuiz key={gameKey} filter={shapeFilter} worldVisited={worldVisited} onBack={handleBack} onPlayAgain={handlePlayAgain} />;
```

Note: `MapConfig` is already defined in `GamesPanel.jsx` — Shape Quiz reuses it exactly. No new config component needed.

**Step 3: Add the 4th game card**

In the `games-grid` div, add after the Capital Quiz card:

```jsx
<div className="game-card">
  <span className="game-card-icon">🌍</span>
  <span className="game-card-title">Shape Quiz</span>
  <span className="game-card-desc">Name the highlighted country on the map</span>
  <span className="game-card-best">{bestLabel('shape_all')}</span>
  <button className="game-card-play" onClick={() => setScreen('shape-config')}>Play</button>
</div>
```

**Step 4: Manual smoke test**

1. Open the app
2. Tap/click Games → Shape Quiz card → Play
3. Confirm a blue country appears on the map
4. Type the correct name → confirm green flash + score increments
5. Type a wrong name → confirm red flash + correct name shown
6. Complete the game → confirm result screen with Play Again / Back to Games

**Step 5: Run tests**

```bash
npm test -- --run
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/components/GamesPanel.jsx
git commit -m "feat: add Shape Quiz card and routing to GamesPanel"
```
