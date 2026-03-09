# Geography Mini Games Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Map Quiz, Flag Quiz, and Capital Quiz to the Explore tab using a shared game engine hook and per-mode components.

**Architecture:** `useGeographyGame(pool, options)` handles shuffling, scoring, timer, and state transitions. Three separate mode components (MapQuiz, FlagQuiz, CapitalQuiz) plug into the hook. GamesPanel is the selection screen, GameResultScreen is the shared end screen. High scores saved to localStorage.

**Tech Stack:** React, Vitest, Leaflet (map quiz), localStorage

---

### Task 1: Game engine hook `useGeographyGame`

**Files:**
- Create: `src/hooks/useGeographyGame.js`
- Create: `src/hooks/__tests__/useGeographyGame.test.js`

**Context:**
- Tests use Vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`)
- Run tests with: `npm test`
- This hook is pure logic — no React rendering, easy to test with `renderHook` from `@testing-library/react`

**Step 1: Write the failing tests**

Create `src/hooks/__tests__/useGeographyGame.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useGeographyGame from '../useGeographyGame';

const POOL = [
  { id: 'fr', name: 'France' },
  { id: 'de', name: 'Germany' },
  { id: 'es', name: 'Spain' },
];

describe('useGeographyGame', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts in playing status with first question from pool', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    expect(result.current.status).toBe('playing');
    expect(result.current.questionIndex).toBe(0);
    expect(result.current.total).toBe(3);
    expect(POOL.map(p => p.id)).toContain(result.current.question.id);
  });

  it('correct submit increments correct score and enters reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    const id = result.current.question.id;
    act(() => { result.current.submit(id); });
    expect(result.current.isCorrect).toBe(true);
    expect(result.current.score.correct).toBe(1);
    expect(result.current.status).toBe('reviewing');
  });

  it('wrong submit increments incorrect score and enters reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.submit('xx'); });
    expect(result.current.isCorrect).toBe(false);
    expect(result.current.score.incorrect).toBe(1);
    expect(result.current.status).toBe('reviewing');
  });

  it('advances to next question after 1200ms reviewing', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.submit(result.current.question.id); });
    expect(result.current.questionIndex).toBe(0);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current.questionIndex).toBe(1);
    expect(result.current.status).toBe('playing');
  });

  it('skip increments skipped score and advances', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    act(() => { result.current.skip(); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current.score.skipped).toBe(1);
    expect(result.current.questionIndex).toBe(1);
  });

  it('finishes after all questions answered', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { onFinish }));
    for (let i = 0; i < 3; i++) {
      act(() => { result.current.submit(result.current.question.id); });
      act(() => { vi.advanceTimersByTime(1200); });
    }
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ correct: 3 }));
  });

  it('finish() forces end immediately', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { onFinish }));
    act(() => { result.current.finish(); });
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalled();
  });

  it('counts down timeLeft and finishes when it hits 0', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() => useGeographyGame(POOL, { timeLimit: 5, onFinish }));
    expect(result.current.timeLeft).toBe(5);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.status).toBe('finished');
    expect(onFinish).toHaveBeenCalled();
  });

  it('timeLeft is null when no timeLimit provided', () => {
    const { result } = renderHook(() => useGeographyGame(POOL, {}));
    expect(result.current.timeLeft).toBeNull();
  });
});
```

**Step 2: Run to confirm failure**

```bash
npm test -- useGeographyGame
```
Expected: FAIL — `useGeographyGame` not found.

**Step 3: Implement `src/hooks/useGeographyGame.js`**

```js
import { useState, useEffect, useRef, useCallback } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function useGeographyGame(pool, { timeLimit = null, onFinish } = {}) {
  const [questions] = useState(() => shuffle(pool));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState({ correct: 0, incorrect: 0, skipped: 0 });
  const [status, setStatus] = useState('playing'); // 'playing' | 'reviewing' | 'finished'
  const [isCorrect, setIsCorrect] = useState(null);
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Global timer
  useEffect(() => {
    if (!timeLimit || status === 'finished') return;
    if (timeLeft <= 0) {
      setStatus('finished');
      onFinishRef.current?.(score);
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, timeLimit, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback((nextScore) => {
    setQuestionIndex(i => {
      const next = i + 1;
      if (next >= questions.length) {
        setStatus('finished');
        onFinishRef.current?.(nextScore);
      } else {
        setStatus('playing');
        setIsCorrect(null);
        setLastCorrectAnswer(null);
      }
      return next >= questions.length ? i : next;
    });
  }, [questions.length]);

  const submit = useCallback((answer) => {
    if (status !== 'playing') return;
    const question = questions[questionIndex];
    const correct = String(answer).trim().toLowerCase() === String(question.id).toLowerCase();
    const nextScore = {
      ...score,
      correct: score.correct + (correct ? 1 : 0),
      incorrect: score.incorrect + (correct ? 0 : 1),
    };
    setScore(nextScore);
    setIsCorrect(correct);
    setLastCorrectAnswer(correct ? null : question);
    setStatus('reviewing');
    setTimeout(() => advance(nextScore), 1200);
  }, [status, questions, questionIndex, score, advance]);

  const skip = useCallback(() => {
    if (status !== 'playing') return;
    const nextScore = { ...score, skipped: score.skipped + 1 };
    setScore(nextScore);
    setIsCorrect(null);
    setLastCorrectAnswer(null);
    setStatus('reviewing');
    setTimeout(() => advance(nextScore), 1200);
  }, [status, score, advance]);

  const finish = useCallback(() => {
    setStatus('finished');
    onFinishRef.current?.(score);
  }, [score]);

  return {
    question: questions[questionIndex] ?? null,
    questionIndex,
    total: questions.length,
    score,
    timeLeft,
    status,
    isCorrect,
    lastCorrectAnswer,
    submit,
    skip,
    finish,
  };
}
```

**Step 4: Run tests to confirm passing**

```bash
npm test -- useGeographyGame
```
Expected: PASS — 9 tests passing.

**Step 5: Commit**

```bash
git add src/hooks/useGeographyGame.js src/hooks/__tests__/useGeographyGame.test.js
git commit -m "feat(games): add useGeographyGame engine hook"
```

---

### Task 2: Answer matching utility

**Files:**
- Create: `src/utils/gameAnswers.js`
- Create: `src/utils/__tests__/gameAnswers.test.js`

**Context:**
The fuzzy match needs to: lowercase, strip diacritics, resolve common country name aliases.

**Step 1: Write failing tests**

Create `src/utils/__tests__/gameAnswers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeAnswer, checkTextAnswer } from '../gameAnswers';

describe('normalizeAnswer', () => {
  it('lowercases', () => expect(normalizeAnswer('France')).toBe('france'));
  it('strips diacritics', () => expect(normalizeAnswer('Bogotá')).toBe('bogota'));
  it('strips diacritics complex', () => expect(normalizeAnswer('Côte d\'Ivoire')).toBe('cote d\'ivoire'));
  it('trims whitespace', () => expect(normalizeAnswer('  France  ')).toBe('france'));
});

describe('checkTextAnswer', () => {
  it('accepts exact match', () => expect(checkTextAnswer('france', 'france')).toBe(true));
  it('accepts case-insensitive match', () => expect(checkTextAnswer('France', 'france')).toBe(true));
  it('accepts diacritic-stripped match', () => expect(checkTextAnswer('Bogota', 'Bogotá')).toBe(true));
  it('rejects wrong answer', () => expect(checkTextAnswer('Germany', 'France')).toBe(false));
  it('accepts alias USA for United States', () => expect(checkTextAnswer('USA', 'United States')).toBe(true));
  it('accepts alias UK for United Kingdom', () => expect(checkTextAnswer('UK', 'United Kingdom')).toBe(true));
  it('accepts alias Czech Republic for Czechia', () => expect(checkTextAnswer('Czech Republic', 'Czechia')).toBe(true));
});
```

**Step 2: Run to confirm failure**

```bash
npm test -- gameAnswers
```
Expected: FAIL.

**Step 3: Implement `src/utils/gameAnswers.js`**

```js
// Map of normalized alias → normalized correct name
const ALIASES = {
  'usa': 'united states',
  'united states of america': 'united states',
  'uk': 'united kingdom',
  'great britain': 'united kingdom',
  'czech republic': 'czechia',
  'russia': 'russia',  // already matches
  'south korea': 'south korea',
  'north korea': 'north korea',
  'taiwan': 'taiwan',
  'palestine': 'palestine',
  'ivory coast': "cote d'ivoire",
  "cote d'ivoire": "cote d'ivoire",
  'democratic republic of the congo': 'dr congo',
  'drc': 'dr congo',
  'congo kinshasa': 'dr congo',
  'republic of the congo': 'congo',
  'burma': 'myanmar',
  'cape verde': 'cabo verde',
  'swaziland': 'eswatini',
  'east timor': 'timor-leste',
  'macedonia': 'north macedonia',
};

export function normalizeAnswer(str) {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip diacritics
}

export function checkTextAnswer(userInput, correctAnswer) {
  const normalized = normalizeAnswer(userInput);
  const correct = normalizeAnswer(correctAnswer);
  if (normalized === correct) return true;
  // Check alias
  const aliasTarget = ALIASES[normalized];
  if (aliasTarget && aliasTarget === correct) return true;
  // Check reverse alias (correct is an alias key)
  const reversedAlias = ALIASES[correct];
  if (reversedAlias && reversedAlias === normalized) return true;
  return false;
}

export function fuzzyMatches(input, candidates, key = 'name', limit = 5) {
  if (!input.trim()) return [];
  const q = normalizeAnswer(input);
  return candidates
    .filter(c => normalizeAnswer(c[key]).includes(q))
    .slice(0, limit);
}
```

**Step 4: Run tests**

```bash
npm test -- gameAnswers
```
Expected: PASS — 8 tests passing.

**Step 5: Commit**

```bash
git add src/utils/gameAnswers.js src/utils/__tests__/gameAnswers.test.js
git commit -m "feat(games): add answer normalization and fuzzy match utility"
```

---

### Task 3: Shared game UI components

**Files:**
- Create: `src/components/games/GameTopBar.jsx`
- Create: `src/components/games/AnswerInput.jsx`
- Create: `src/components/games/GameResultScreen.jsx`
- Create: `src/components/games/games.css`

**Context:**
- No tests for pure UI components — verify visually
- `GameTopBar` shows: `Q {n}/{total} · ✓ {correct} · ✗ {incorrect} · ⏱ {mm:ss}` + Quit button
- `AnswerInput` is a text input with autocomplete dropdown (uses `fuzzyMatches` from Task 2)
- `GameResultScreen` shows final score, new high score banner, action buttons

**Step 1: Create `src/components/games/games.css`**

```css
/* ===== Shared Game Styles ===== */

.game-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--body-bg, #faf6f0);
  border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
  font-family: -apple-system, system-ui, sans-serif;
  font-size: 0.85rem;
  flex-shrink: 0;
  z-index: 10;
}

.game-top-bar-stats {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--text-secondary, #6b7280);
}

.game-top-bar-correct { color: #22c55e; font-weight: 600; }
.game-top-bar-incorrect { color: #ef4444; font-weight: 600; }
.game-top-bar-timer { font-variant-numeric: tabular-nums; }
.game-top-bar-timer.urgent { color: #ef4444; font-weight: 700; }

.game-quit-btn {
  background: none;
  border: 1px solid var(--border, rgba(0,0,0,0.15));
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
}
.game-quit-btn:hover { background: rgba(0,0,0,0.05); }

/* ===== Answer Input ===== */

.answer-input-wrapper {
  position: relative;
  width: 100%;
}

.answer-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border, rgba(0,0,0,0.12));
  border-radius: 12px;
  font-size: 1rem;
  background: var(--input-bg, #fff);
  color: var(--text, #1a1a1a);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.answer-input:focus { border-color: #3b82f6; }
.answer-input.correct { border-color: #22c55e; background: #f0fdf4; }
.answer-input.incorrect { border-color: #ef4444; background: #fef2f2; }

.answer-autocomplete {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--body-bg, #fff);
  border: 1px solid var(--border, rgba(0,0,0,0.12));
  border-radius: 10px;
  overflow: hidden;
  z-index: 20;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

.answer-autocomplete-item {
  padding: 10px 16px;
  cursor: pointer;
  font-size: 0.95rem;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  color: var(--text, #1a1a1a);
}
.answer-autocomplete-item:hover,
.answer-autocomplete-item.highlighted { background: rgba(59,130,246,0.08); }

/* ===== Game Action Buttons ===== */

.game-actions {
  display: flex;
  gap: 10px;
  padding: 0 16px;
  margin-top: 8px;
}

.game-btn {
  flex: 1;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.game-btn:active { opacity: 0.75; }
.game-btn-primary { background: #3b82f6; color: #fff; }
.game-btn-secondary { background: var(--border, rgba(0,0,0,0.08)); color: var(--text, #1a1a1a); }

/* ===== Result Screen ===== */

.game-result-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px 24px;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
  font-family: -apple-system, system-ui, sans-serif;
}

.game-result-title { font-size: 1.2rem; font-weight: 700; color: var(--text, #1a1a1a); text-align: center; }
.game-result-score { font-size: 3rem; font-weight: 800; color: #3b82f6; }
.game-result-pct { font-size: 1rem; color: var(--text-secondary, #6b7280); }
.game-result-breakdown { display: flex; gap: 20px; }
.game-result-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.game-result-stat-num { font-size: 1.4rem; font-weight: 700; }
.game-result-stat-label { font-size: 0.75rem; color: var(--text-secondary, #6b7280); }
.game-result-new-best {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  border-radius: 10px;
  padding: 8px 20px;
  font-weight: 700;
  font-size: 0.95rem;
}
.game-result-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }
```

**Step 2: Create `src/components/games/GameTopBar.jsx`**

```jsx
import './games.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameTopBar({ questionIndex, total, score, timeLeft, onQuit }) {
  return (
    <div className="game-top-bar">
      <div className="game-top-bar-stats">
        <span>Q {questionIndex + 1}/{total}</span>
        <span className="game-top-bar-correct">✓ {score.correct}</span>
        <span className="game-top-bar-incorrect">✗ {score.incorrect}</span>
        {timeLeft !== null && (
          <span className={`game-top-bar-timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
        )}
      </div>
      <button className="game-quit-btn" onClick={onQuit}>Quit</button>
    </div>
  );
}
```

**Step 3: Create `src/components/games/AnswerInput.jsx`**

```jsx
import { useState, useCallback } from 'react';
import { fuzzyMatches } from '../../utils/gameAnswers';
import './games.css';

export default function AnswerInput({ candidates, nameKey = 'name', onSubmit, onSkip, status, disabled }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = value.length > 0 ? fuzzyMatches(value, candidates, nameKey) : [];

  const handleSubmit = useCallback((val) => {
    if (!val.trim() || disabled) return;
    onSubmit(val);
    setValue('');
    setOpen(false);
  }, [onSubmit, disabled]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit(value);
    if (e.key === 'Tab') { e.preventDefault(); onSkip?.(); setValue(''); setOpen(false); }
  };

  const inputClass = `answer-input${status === 'reviewing' ? (/* passed from parent */ '') : ''}`;

  return (
    <div className="answer-input-wrapper">
      <input
        className={inputClass}
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type your answer..."
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <div className="answer-autocomplete">
          {suggestions.map(s => (
            <button
              key={s.id ?? s[nameKey]}
              className="answer-autocomplete-item"
              onMouseDown={() => handleSubmit(s[nameKey])}
            >
              {s.flag && <span style={{ marginRight: 8 }}>{s.flag}</span>}
              {s[nameKey]}
            </button>
          ))}
        </div>
      )}
      <div className="game-actions" style={{ marginTop: 8 }}>
        <button className="game-btn game-btn-primary" onClick={() => handleSubmit(value)} disabled={disabled}>
          Submit
        </button>
        <button className="game-btn game-btn-secondary" onClick={onSkip} disabled={disabled}>
          Skip
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Create `src/components/games/GameResultScreen.jsx`**

```jsx
import './games.css';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function GameResultScreen({ title, score, timeTaken, isNewBest, onPlayAgain, onBack }) {
  const total = score.correct + score.incorrect + score.skipped;
  const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;

  return (
    <div className="game-result-screen">
      <p className="game-result-title">{title} — Results</p>

      <div className="game-result-score">{score.correct}/{total}</div>
      <p className="game-result-pct">{pct}% correct · {formatTime(timeTaken)}</p>

      <div className="game-result-breakdown">
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#22c55e' }}>✓ {score.correct}</span>
          <span className="game-result-stat-label">correct</span>
        </div>
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#ef4444' }}>✗ {score.incorrect}</span>
          <span className="game-result-stat-label">wrong</span>
        </div>
        <div className="game-result-stat">
          <span className="game-result-stat-num" style={{ color: '#f59e0b' }}>⤼ {score.skipped}</span>
          <span className="game-result-stat-label">skipped</span>
        </div>
      </div>

      {isNewBest && <div className="game-result-new-best">🏆 New best score!</div>}

      <div className="game-result-actions">
        <button className="game-btn game-btn-primary" onClick={onPlayAgain}>Play Again</button>
        <button className="game-btn game-btn-secondary" onClick={onBack}>Back to Games</button>
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/games/
git commit -m "feat(games): add shared game UI components (TopBar, AnswerInput, ResultScreen)"
```

---

### Task 4: High score persistence utility

**Files:**
- Create: `src/utils/gameScores.js`
- Create: `src/utils/__tests__/gameScores.test.js`

**Context:**
High scores stored in localStorage under key `swiss-tracker-game-scores` (not user-prefixed — always local).
Score key format: `map_all`, `map_visited`, `map_africa`, `flag`, `capital_country`, `capital_city`.

**Step 1: Write failing tests**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { getHighScore, saveHighScore, isNewHighScore } from '../gameScores';

beforeEach(() => localStorage.clear());

describe('getHighScore', () => {
  it('returns null when no score stored', () => {
    expect(getHighScore('flag')).toBeNull();
  });

  it('returns stored score', () => {
    saveHighScore('flag', { correct: 50, total: 195, pct: 26 });
    expect(getHighScore('flag')).toEqual({ correct: 50, total: 195, pct: 26 });
  });
});

describe('isNewHighScore', () => {
  it('returns true when no previous score', () => {
    expect(isNewHighScore('flag', 30)).toBe(true);
  });

  it('returns true when pct beats stored pct', () => {
    saveHighScore('flag', { correct: 50, total: 195, pct: 26 });
    expect(isNewHighScore('flag', 27)).toBe(true);
  });

  it('returns false when pct does not beat stored pct', () => {
    saveHighScore('flag', { correct: 50, total: 195, pct: 26 });
    expect(isNewHighScore('flag', 25)).toBe(false);
  });
});

describe('saveHighScore', () => {
  it('saves and can be retrieved', () => {
    saveHighScore('map_all', { correct: 42, total: 195, pct: 22 });
    expect(getHighScore('map_all')).toEqual({ correct: 42, total: 195, pct: 22 });
  });

  it('does not overwrite better score', () => {
    saveHighScore('flag', { correct: 80, total: 195, pct: 41 });
    saveHighScore('flag', { correct: 30, total: 195, pct: 15 });
    expect(getHighScore('flag').pct).toBe(41);
  });
});
```

**Step 2: Run to confirm failure**

```bash
npm test -- gameScores
```

**Step 3: Implement `src/utils/gameScores.js`**

```js
const STORAGE_KEY = 'swiss-tracker-game-scores';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { /* ignore quota errors */ }
}

export function getHighScore(key) {
  return load()[key] ?? null;
}

export function isNewHighScore(key, pct) {
  const best = getHighScore(key);
  return !best || pct > best.pct;
}

export function saveHighScore(key, scoreObj) {
  const all = load();
  if (!all[key] || scoreObj.pct > all[key].pct) {
    all[key] = scoreObj;
    save(all);
  }
}
```

**Step 4: Run tests**

```bash
npm test -- gameScores
```
Expected: PASS — 7 tests passing.

**Step 5: Commit**

```bash
git add src/utils/gameScores.js src/utils/__tests__/gameScores.test.js
git commit -m "feat(games): add high score persistence utility"
```

---

### Task 5: Flag Quiz component

**Files:**
- Create: `src/components/games/FlagQuiz.jsx`
- Modify: nothing else (uses shared components from Task 3)

**Context:**
- Pool: all countries from `world.json` features with their emoji flag from `src/config/countries.json`
- Need to join world.json features with flag data from countries.json
- `submit()` in useGeographyGame checks `answer === question.id` (ID match)
- For text input, we need to check the typed name against country name, then submit the ID

**Step 1: Create `src/components/games/FlagQuiz.jsx`**

```jsx
import { useCallback, useMemo } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { getHighScore, saveHighScore, isNewHighScore } from '../../utils/gameScores';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import worldData from '../../data/world.json';
import countriesConfig from '../../config/countries.json';
import './games.css';

// Build flag lookup: id → flag emoji
const FLAG_MAP = {};
if (countriesConfig?.countries) {
  Object.entries(countriesConfig.countries).forEach(([id, c]) => {
    if (c.flag) FLAG_MAP[id] = c.flag;
  });
}

function buildPool() {
  return worldData.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    flag: FLAG_MAP[f.properties.id] || '🏳️',
  }));
}

const SCORE_KEY = 'flag';

export default function FlagQuiz({ onBack }) {
  const pool = useMemo(() => buildPool(), []);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    saveHighScore(SCORE_KEY, { correct: score.correct, total, pct });
  }, []);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  const handleTextSubmit = useCallback((text) => {
    // Find matching country by name
    const match = pool.find(c => checkTextAnswer(text, c.name));
    submit(match?.id ?? text);
  }, [pool, submit]);

  if (status === 'finished') {
    const t = score.correct + score.incorrect + score.skipped;
    const pct = t > 0 ? Math.round((score.correct / t) * 100) : 0;
    const prevBest = getHighScore(SCORE_KEY);
    return (
      <GameResultScreen
        title="Flag Quiz"
        score={score}
        timeTaken={0}
        isNewBest={!prevBest || pct >= prevBest.pct}
        onPlayAgain={() => window.location.reload()} // remount to restart
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 24 }}>
        <div style={{ fontSize: '6rem', lineHeight: 1 }}>{question.flag}</div>
        {status === 'reviewing' && (
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444', textAlign: 'center' }}>
            {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnswerInput
            candidates={pool}
            nameKey="name"
            onSubmit={handleTextSubmit}
            onSkip={skip}
            disabled={status === 'reviewing'}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify `countries.json` flag structure**

Run in browser console or check file:
```bash
node -e "const c = require('./src/config/countries.json'); console.log(Object.keys(c).slice(0,3));"
```
If the structure is different (e.g. flat array), adjust `buildPool()` accordingly. The flag emoji may be in `countries.json` as `{ "ch": { "flag": "🇨🇭", ... } }` or in `countryList` from `countries.js`.

If `countriesConfig` is a flat object (not `{ countries: {...} }`), update the FLAG_MAP builder:
```js
// If countries.json is a flat object: { "ch": { flag: "🇨🇭" }, ... }
Object.entries(countriesConfig).forEach(([id, c]) => {
  if (c?.flag) FLAG_MAP[id] = c.flag;
});
```

**Step 3: Commit**

```bash
git add src/components/games/FlagQuiz.jsx
git commit -m "feat(games): add Flag Quiz component"
```

---

### Task 6: Capital Quiz component

**Files:**
- Create: `src/components/games/CapitalQuiz.jsx`

**Context:**
- Pool built from `src/data/capitals.json` (GeoJSON FeatureCollection)
- Each capital feature: `{ properties: { id, name, country }, geometry: { type: "Point", coordinates: [lng, lat] } }`
- Two sub-modes: `country_to_capital` (show country name, guess capital) and `capital_to_country` (show capital, guess country)
- Sub-mode passed as prop from GamesPanel

**Step 1: Create `src/components/games/CapitalQuiz.jsx`**

```jsx
import { useCallback, useMemo } from 'vitest';
import { useCallback, useMemo } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { checkTextAnswer } from '../../utils/gameAnswers';
import { getHighScore, saveHighScore } from '../../utils/gameScores';
import GameTopBar from './GameTopBar';
import AnswerInput from './AnswerInput';
import GameResultScreen from './GameResultScreen';
import capitalsData from '../../data/capitals.json';
import worldData from '../../data/world.json';
import './games.css';

// Build country name lookup: id → name
const COUNTRY_NAME = {};
worldData.features.forEach(f => { COUNTRY_NAME[f.properties.id] = f.properties.name; });

function buildPool(subMode) {
  return capitalsData.features
    .filter(f => COUNTRY_NAME[f.properties.country]) // only countries in world map
    .map(f => ({
      id: f.properties.id,
      capitalName: f.properties.name,
      countryId: f.properties.country,
      countryName: COUNTRY_NAME[f.properties.country],
      // For the hook: question.id = correct answer id, question.name = prompt text
      prompt: subMode === 'country_to_capital' ? COUNTRY_NAME[f.properties.country] : f.properties.name,
      answer: subMode === 'country_to_capital' ? f.properties.name : COUNTRY_NAME[f.properties.country],
    }));
}

export default function CapitalQuiz({ subMode = 'country_to_capital', onBack }) {
  const pool = useMemo(() => buildPool(subMode), [subMode]);
  const scoreKey = `capital_${subMode}`;

  // Adapt pool for useGeographyGame: id = answer text (checked via checkTextAnswer)
  // We override submit logic so we use text matching
  const enginePool = useMemo(() => pool.map(p => ({ ...p, id: p.answer })), [pool]);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    saveHighScore(scoreKey, { correct: score.correct, total, pct });
  }, [scoreKey]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(enginePool, { onFinish: handleFinish });

  const candidates = useMemo(() =>
    pool.map(p => ({ id: p.answer, name: p.answer })),
  [pool]);

  const handleTextSubmit = useCallback((text) => {
    if (!question) return;
    // submit the answer text directly (hook will compare via exact match on id=answer)
    const match = candidates.find(c => checkTextAnswer(text, c.name));
    submit(match?.id ?? text);
  }, [question, candidates, submit]);

  if (status === 'finished') {
    const t = score.correct + score.incorrect + score.skipped;
    const pct = t > 0 ? Math.round((score.correct / t) * 100) : 0;
    const prevBest = getHighScore(scoreKey);
    return (
      <GameResultScreen
        title={subMode === 'country_to_capital' ? 'Capital Quiz' : 'Country Quiz'}
        score={score}
        timeTaken={0}
        isNewBest={!prevBest || pct >= prevBest.pct}
        onPlayAgain={() => window.location.reload()}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  const promptLabel = subMode === 'country_to_capital' ? 'What is the capital of' : 'Which country has capital';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', gap: 24 }}>
        <p style={{ color: 'var(--text-secondary, #6b7280)', fontSize: '0.9rem', margin: 0 }}>{promptLabel}</p>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, textAlign: 'center', color: 'var(--text, #1a1a1a)' }}>
          {question.prompt}
        </div>
        {status === 'reviewing' && (
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: isCorrect ? '#22c55e' : '#ef4444', textAlign: 'center' }}>
            {isCorrect ? '✓ Correct!' : `✗ ${question.answer}`}
          </div>
        )}
        <div style={{ width: '100%', maxWidth: 400 }}>
          <AnswerInput
            candidates={candidates}
            nameKey="name"
            onSubmit={handleTextSubmit}
            onSkip={skip}
            disabled={status === 'reviewing'}
          />
        </div>
      </div>
    </div>
  );
}
```

Note the duplicate import line — fix it: remove `import { useCallback, useMemo } from 'vitest';`.

**Step 2: Commit**

```bash
git add src/components/games/CapitalQuiz.jsx
git commit -m "feat(games): add Capital Quiz component"
```

---

### Task 7: Map Quiz component + WorldMap gameMode prop

**Files:**
- Modify: `src/components/WorldMap.jsx` — add `gameMode` prop
- Create: `src/components/games/MapQuiz.jsx`

**Context:**
- `gameMode` prop shape: `{ targetId: string, onCountryClick: (id) => void, correctId: string | null, incorrectId: string | null }`
- When `gameMode` is set: force clean tile layer (no labels), override click, apply highlight colors
- Highlight colors: target = blue `#3b82f6`, correct flash = green `#22c55e`, incorrect flash = red `#ef4444`
- Pool filter variants: `all`, `visited`, `unvisited`, `africa`, `asia`, `europe`, `north_america`, `south_america`, `oceania`

**Step 1: Modify `src/components/WorldMap.jsx`**

Add `gameMode` to props destructuring (around line 96 where other props are destructured):

```jsx
export default function WorldMap({
  visited,
  onToggle,
  friendsActive,
  onFriendsToggle,
  friendOverlayData,
  comparisonFriend,
  onExitComparison,
  wishlist,
  comparisonMode,
  gameMode,  // ADD THIS
}) {
```

In `onEachFeature` callback, modify the `click` handler (around line 346):

```js
click: (e) => {
  // Game mode: delegate click to game, no toggle
  if (gameMode) {
    gameMode.onCountryClick(id);
    return;
  }
  if (comparisonModeRef.current) return;
  onToggle(id);
  // ... existing animation code
},
```

Add game highlight styles to the `style` function (before the existing return, around line 280):

```js
// Game mode overrides all other styles
if (gameMode) {
  if (id === gameMode.correctId) return { fillColor: '#22c55e', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.incorrectId) return { fillColor: '#ef4444', fillOpacity: 0.8, color: '#fff', weight: 2 };
  if (id === gameMode.targetId) return { fillColor: '#3b82f6', fillOpacity: 0.75, color: '#fff', weight: 2 };
  return { fillColor: '#cfd8dc', fillOpacity: 0.3, color: 'rgba(0,0,0,0.05)', weight: 0.5 };
}
```

Force clean tile layer when gameMode is active — in the `useState` for `tileUrl` and override in JSX:

In the TileLayer JSX (around line 388), change:
```jsx
<TileLayer key={tileUrl} url={tileUrl} ... />
```
To:
```jsx
<TileLayer
  key={gameMode ? 'game-clean' : tileUrl}
  url={gameMode ? (dark ? LAYERS[0].dark : LAYERS[0].light) : tileUrl}
  attribution="..."
/>
```

Also hide `MapLayerControl` when gameMode is active — wrap it in `{!gameMode && <MapLayerControl ... />}`.

**Step 2: Create `src/components/games/MapQuiz.jsx`**

```jsx
import { useState, useCallback, useMemo } from 'react';
import useGeographyGame from '../../hooks/useGeographyGame';
import { getHighScore, saveHighScore } from '../../utils/gameScores';
import GameTopBar from './GameTopBar';
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
      return true; // 'all'
    })
    .map(f => ({ id: f.properties.id, name: f.properties.name }));
}

function scoreKey(filter) {
  return `map_${filter}`;
}

export default function MapQuiz({ filter = 'all', worldVisited, onBack }) {
  const pool = useMemo(() => buildPool(filter, worldVisited), [filter, worldVisited]);

  const [correctId, setCorrectId] = useState(null);
  const [incorrectId, setIncorrectId] = useState(null);

  const handleFinish = useCallback((score) => {
    const total = score.correct + score.incorrect + score.skipped;
    const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
    saveHighScore(scoreKey(filter), { correct: score.correct, total, pct });
  }, [filter]);

  const {
    question, questionIndex, total, score, timeLeft,
    status, isCorrect, submit, skip, finish,
  } = useGeographyGame(pool, { onFinish: handleFinish });

  const handleCountryClick = useCallback((clickedId) => {
    if (status !== 'playing' || !question) return;
    const correct = clickedId === question.id;
    if (correct) {
      setCorrectId(clickedId);
      setIncorrectId(null);
    } else {
      setIncorrectId(clickedId);
      setCorrectId(question.id); // show correct in green
    }
    submit(clickedId);
    setTimeout(() => { setCorrectId(null); setIncorrectId(null); }, 1200);
  }, [status, question, submit]);

  if (status === 'finished') {
    const t = score.correct + score.incorrect + score.skipped;
    const pct = t > 0 ? Math.round((score.correct / t) * 100) : 0;
    const key = scoreKey(filter);
    const prevBest = getHighScore(key);
    return (
      <GameResultScreen
        title="Map Quiz"
        score={score}
        timeTaken={0}
        isNewBest={!prevBest || pct >= prevBest.pct}
        onPlayAgain={() => window.location.reload()}
        onBack={onBack}
      />
    );
  }

  if (!question) return null;

  const gameMode = {
    targetId: question.id,
    onCountryClick: handleCountryClick,
    correctId,
    incorrectId,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <GameTopBar
        questionIndex={questionIndex}
        total={total}
        score={score}
        timeLeft={timeLeft}
        onQuit={finish}
      />
      {/* Floating prompt */}
      <div style={{
        position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 10,
        padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600, zIndex: 500,
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        🔵 Click: {question.name}
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <WorldMap
          visited={new Set()}
          onToggle={() => {}}
          wishlist={new Set()}
          comparisonMode={false}
          gameMode={gameMode}
        />
      </div>
      {status === 'reviewing' && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: isCorrect ? '#22c55e' : '#ef4444', color: '#fff',
          borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: '1rem', zIndex: 500,
        }}>
          {isCorrect ? '✓ Correct!' : `✗ ${question.name}`}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run the app and test manually**

```bash
npm run dev
```
Navigate to the Explore tab (once GamesPanel is wired in Task 8). Verify:
- Map renders with country highlighted in blue
- Clicking correct country shows green flash + "Correct!"
- Clicking wrong country shows red flash on clicked + green on correct

**Step 4: Commit**

```bash
git add src/components/WorldMap.jsx src/components/games/MapQuiz.jsx
git commit -m "feat(games): add Map Quiz component and WorldMap gameMode prop"
```

---

### Task 8: GamesPanel + App.jsx integration

**Files:**
- Create: `src/components/GamesPanel.jsx`
- Create: `src/components/GamesPanel.css`
- Modify: `src/App.jsx:830-835`

**Context:**
- GamesPanel is the main screen — mode selection grid
- Each card shows mode title, description, best score from localStorage, Play button
- Tapping Play → pre-game config screen (filter picker for map quiz, sub-mode for capital)
- After config → game component renders full-screen (replaces GamesPanel)

**Step 1: Create `src/components/GamesPanel.css`**

```css
.games-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  padding: 20px 16px;
  font-family: -apple-system, system-ui, sans-serif;
  background: var(--body-bg, #faf6f0);
}

.games-panel-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text, #1a1a1a);
  margin: 0 0 4px;
}

.games-panel-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary, #6b7280);
  margin: 0 0 20px;
}

.games-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.game-card {
  background: var(--card-bg, #fff);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border, rgba(0,0,0,0.08));
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.game-card-icon { font-size: 2rem; }
.game-card-title { font-size: 1rem; font-weight: 700; color: var(--text, #1a1a1a); }
.game-card-desc { font-size: 0.75rem; color: var(--text-secondary, #6b7280); line-height: 1.4; }
.game-card-best { font-size: 0.75rem; color: #3b82f6; font-weight: 600; margin-top: 4px; }

.game-card-play {
  margin-top: 8px;
  padding: 10px;
  border-radius: 10px;
  border: none;
  background: #3b82f6;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.game-card-play:active { opacity: 0.75; }

/* Pre-game config screen */
.game-config-screen {
  display: flex;
  flex-direction: column;
  padding: 24px 20px;
  gap: 12px;
  height: 100%;
  background: var(--body-bg, #faf6f0);
  font-family: -apple-system, system-ui, sans-serif;
}

.game-config-title { font-size: 1.2rem; font-weight: 700; color: var(--text, #1a1a1a); }
.game-config-label { font-size: 0.85rem; color: var(--text-secondary, #6b7280); margin-bottom: 4px; }

.game-config-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.game-config-option {
  padding: 12px 16px;
  border-radius: 12px;
  border: 2px solid var(--border, rgba(0,0,0,0.1));
  background: var(--card-bg, #fff);
  text-align: left;
  font-size: 0.95rem;
  cursor: pointer;
  color: var(--text, #1a1a1a);
  transition: border-color 0.15s;
}
.game-config-option.selected { border-color: #3b82f6; color: #3b82f6; font-weight: 600; }

.game-config-start {
  margin-top: auto;
  padding: 14px;
  border-radius: 14px;
  border: none;
  background: #3b82f6;
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.game-config-back {
  background: none;
  border: none;
  color: var(--text-secondary, #6b7280);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  text-align: left;
}
```

**Step 2: Create `src/components/GamesPanel.jsx`**

```jsx
import { useState } from 'react';
import { getHighScore } from '../utils/gameScores';
import MapQuiz from './games/MapQuiz';
import FlagQuiz from './games/FlagQuiz';
import CapitalQuiz from './games/CapitalQuiz';
import './GamesPanel.css';

const MAP_FILTERS = [
  { key: 'all', label: 'All countries (195)' },
  { key: 'visited', label: 'Countries I visited' },
  { key: 'unvisited', label: 'Countries I haven\'t visited' },
  { key: 'europe', label: 'Europe only' },
  { key: 'africa', label: 'Africa only' },
  { key: 'asia', label: 'Asia only' },
  { key: 'north_america', label: 'North America only' },
  { key: 'south_america', label: 'South America only' },
  { key: 'oceania', label: 'Oceania only' },
];

const CAPITAL_SUBMODES = [
  { key: 'country_to_capital', label: 'Country → Capital (guess the capital)' },
  { key: 'capital_to_country', label: 'Capital → Country (guess the country)' },
];

function bestLabel(key) {
  const best = getHighScore(key);
  if (!best) return 'Not played yet';
  return `Best: ${best.pct}% (${best.correct}/${best.total})`;
}

// Config screen shown before starting
function MapConfig({ worldVisited, onStart, onBack }) {
  const [filter, setFilter] = useState('all');
  return (
    <div className="game-config-screen">
      <button className="game-config-back" onClick={onBack}>← Back</button>
      <p className="game-config-title">🗺️ Map Quiz</p>
      <p className="game-config-label">Choose your question pool:</p>
      <div className="game-config-options">
        {MAP_FILTERS.map(f => (
          <button
            key={f.key}
            className={`game-config-option ${filter === f.key ? 'selected' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button className="game-config-start" onClick={() => onStart(filter)}>Start Quiz</button>
    </div>
  );
}

function CapitalConfig({ onStart, onBack }) {
  const [subMode, setSubMode] = useState('country_to_capital');
  return (
    <div className="game-config-screen">
      <button className="game-config-back" onClick={onBack}>← Back</button>
      <p className="game-config-title">🏛️ Capital Quiz</p>
      <p className="game-config-label">Choose mode:</p>
      <div className="game-config-options">
        {CAPITAL_SUBMODES.map(s => (
          <button
            key={s.key}
            className={`game-config-option ${subMode === s.key ? 'selected' : ''}`}
            onClick={() => setSubMode(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button className="game-config-start" onClick={() => onStart(subMode)}>Start Quiz</button>
    </div>
  );
}

export default function GamesPanel({ worldVisited }) {
  const [screen, setScreen] = useState('home'); // 'home' | 'map-config' | 'capital-config' | 'map' | 'flag' | 'capital'
  const [mapFilter, setMapFilter] = useState('all');
  const [capitalSubMode, setCapitalSubMode] = useState('country_to_capital');

  const handleBack = () => setScreen('home');

  if (screen === 'map-config') return <MapConfig worldVisited={worldVisited} onBack={handleBack} onStart={f => { setMapFilter(f); setScreen('map'); }} />;
  if (screen === 'capital-config') return <CapitalConfig onBack={handleBack} onStart={s => { setCapitalSubMode(s); setScreen('capital'); }} />;
  if (screen === 'map') return <MapQuiz filter={mapFilter} worldVisited={worldVisited} onBack={handleBack} />;
  if (screen === 'flag') return <FlagQuiz onBack={handleBack} />;
  if (screen === 'capital') return <CapitalQuiz subMode={capitalSubMode} onBack={handleBack} />;

  return (
    <div className="games-panel">
      <h1 className="games-panel-title">🎮 Geography Games</h1>
      <p className="games-panel-subtitle">Test your geography knowledge</p>
      <div className="games-grid">
        <div className="game-card">
          <span className="game-card-icon">🗺️</span>
          <span className="game-card-title">Map Quiz</span>
          <span className="game-card-desc">Click the highlighted country on a blank map</span>
          <span className="game-card-best">{bestLabel('map_all')}</span>
          <button className="game-card-play" onClick={() => setScreen('map-config')}>Play</button>
        </div>
        <div className="game-card">
          <span className="game-card-icon">🏳️</span>
          <span className="game-card-title">Flag Quiz</span>
          <span className="game-card-desc">Guess the country from its flag</span>
          <span className="game-card-best">{bestLabel('flag')}</span>
          <button className="game-card-play" onClick={() => setScreen('flag')}>Play</button>
        </div>
        <div className="game-card">
          <span className="game-card-icon">🏛️</span>
          <span className="game-card-title">Capital Quiz</span>
          <span className="game-card-desc">Match countries with their capitals</span>
          <span className="game-card-best">{bestLabel('capital_country_to_capital')}</span>
          <button className="game-card-play" onClick={() => setScreen('capital-config')}>Play</button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Wire into App.jsx**

Find this block in `src/App.jsx` (around line 830):

```jsx
{isMobile && !isShareMode && activeTab === 'explore' && (
  <div className="tab-screen tab-screen-placeholder">
    <span className="tab-screen-placeholder-icon">🗺️</span>
    <p>Explore — coming in Phase 2</p>
  </div>
)}
```

Replace with:

```jsx
{isMobile && !isShareMode && activeTab === 'explore' && (
  <div className="tab-screen">
    <GamesPanel worldVisited={worldVisited} />
  </div>
)}
```

Add import at top of App.jsx (with other component imports):
```js
import GamesPanel from './components/GamesPanel';
```

**Step 4: Test manually**

```bash
npm run dev
```
- Tap Explore tab on mobile → should see Games panel with 3 cards
- Tap Map Quiz Play → filter config screen → Start → blank map with blue highlighted country
- Click correct country → green flash + "Correct!"
- Tap Flag Quiz → flag shown → type country name → autocomplete → submit

**Step 5: Commit**

```bash
git add src/components/GamesPanel.jsx src/components/GamesPanel.css src/App.jsx
git commit -m "feat(games): add GamesPanel and wire into Explore tab"
```

---

### Task 9: Game achievements

**Files:**
- Modify: `src/config/achievements.json`
- Modify: `src/utils/achievementProgress.js` (add `gameCompleted` rule type)
- Create: `src/utils/gameAchievements.js` (check + save completed games)

**Context:**
- Achievements are rule-based, checked in `achievementProgress.js`
- New rule type: `gameCompleted: { minPct?: number, mode?: string }`
- Completed games stored in localStorage: `swiss-tracker-game-completed` → `{ any: true, flag_100: true, ... }`

**Step 1: Add achievements to `src/config/achievements.json`**

Add these 4 entries at the end of the JSON array (before the closing `]`):

```json
,
{ "id": "game-first", "icon": "🎮", "title": "First Quiz", "desc": "Complete any geography quiz", "category": "Games", "rule": { "type": "gameCompleted" } },
{ "id": "game-perfect", "icon": "⭐", "title": "Perfect Score", "desc": "Score 100% on any quiz", "category": "Games", "rule": { "type": "gameCompleted", "minPct": 100 } },
{ "id": "game-cartographer", "icon": "🗺️", "title": "Cartographer", "desc": "Complete the full world map quiz (all 195 countries)", "category": "Games", "rule": { "type": "gameCompleted", "mode": "map_all" } },
{ "id": "game-flag-master", "icon": "🏳️", "title": "Flag Master", "desc": "Score 100% on the Flag Quiz", "category": "Games", "rule": { "type": "gameCompleted", "mode": "flag", "minPct": 100 } }
```

**Step 2: Create `src/utils/gameAchievements.js`**

```js
const KEY = 'swiss-tracker-game-completed';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}

function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch {}
}

// Call this at the end of each game
export function recordGameCompletion(modeKey, pct) {
  const data = load();
  data.any = true;
  data[modeKey] = Math.max(data[modeKey] || 0, pct);
  save(data);
}

// Used by achievementProgress to check gameCompleted rules
export function getGameCompletions() {
  return load();
}
```

**Step 3: Add `gameCompleted` rule to `src/utils/achievementProgress.js`**

Find the switch/if block that handles rule types (search for `case 'totalVisited'` or `if (rule.type === 'totalVisited')`).

Add a new case:

```js
case 'gameCompleted': {
  const completions = getGameCompletions(); // import from gameAchievements.js
  if (!completions.any) return false;
  if (rule.mode && (!completions[rule.mode] && completions[rule.mode] !== 0)) return false;
  if (rule.minPct) {
    if (rule.mode) return (completions[rule.mode] || 0) >= rule.minPct;
    // Any mode at minPct
    return Object.values(completions).some(v => typeof v === 'number' && v >= rule.minPct);
  }
  return true;
}
```

Add import at top of `achievementProgress.js`:
```js
import { getGameCompletions } from './gameAchievements';
```

**Step 4: Call `recordGameCompletion` in game components**

In `GameResultScreen.jsx` — it doesn't know the mode key. Instead, call in each game's `handleFinish`:

In `FlagQuiz.jsx`, update `handleFinish`:
```js
import { recordGameCompletion } from '../../utils/gameAchievements';

const handleFinish = useCallback((score) => {
  const total = score.correct + score.incorrect + score.skipped;
  const pct = total > 0 ? Math.round((score.correct / total) * 100) : 0;
  saveHighScore(SCORE_KEY, { correct: score.correct, total, pct });
  recordGameCompletion('flag', pct);
}, []);
```

In `CapitalQuiz.jsx`, update `handleFinish`:
```js
import { recordGameCompletion } from '../../utils/gameAchievements';
// In handleFinish:
recordGameCompletion(scoreKey, pct);
```

In `MapQuiz.jsx`, update `handleFinish`:
```js
import { recordGameCompletion } from '../../utils/gameAchievements';
// In handleFinish:
recordGameCompletion(scoreKey(filter), pct);
```

**Step 5: Commit**

```bash
git add src/config/achievements.json src/utils/achievementProgress.js src/utils/gameAchievements.js src/components/games/FlagQuiz.jsx src/components/games/CapitalQuiz.jsx src/components/games/MapQuiz.jsx
git commit -m "feat(games): add game achievements (First Quiz, Perfect Score, Cartographer, Flag Master)"
```

---

### Task 10: Final cleanup + PR

**Step 1: Run all tests**

```bash
npm test
```
Expected: all tests passing including the new `useGeographyGame` and `gameAnswers` and `gameScores` tests.

**Step 2: Run build to verify no errors**

```bash
npm run build
```
Expected: builds successfully with no errors.

**Step 3: Fix the duplicate import in CapitalQuiz.jsx**

The plan accidentally included a duplicate import line. Open `src/components/games/CapitalQuiz.jsx` and remove:
```js
import { useCallback, useMemo } from 'vitest';
```
Keep only:
```js
import { useCallback, useMemo } from 'react';
```

**Step 4: Verify countries.json flag structure and fix if needed**

```bash
node -e "const c = require('./src/config/countries.json'); const keys = Object.keys(c); console.log('keys:', keys.slice(0,5)); if(c[keys[0]]) console.log('first value:', JSON.stringify(c[keys[0]]).slice(0,100));"
```

If structure differs from expected, adjust the `FLAG_MAP` builder in `FlagQuiz.jsx`.

**Step 5: Create branch and PR**

```bash
git checkout -b feat/geography-mini-games
# (if not already on this branch)
git push -u origin feat/geography-mini-games
gh pr create --title "feat: geography mini games (Map, Flag, Capital Quiz)" --body "Adds three geography quiz games to the Explore tab: Map Quiz (click the highlighted country), Flag Quiz (guess country from flag), and Capital Quiz (country↔capital). Includes shared game engine hook, high score persistence, and 4 new achievements."
```
