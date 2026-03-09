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

  it('returns false when pct equals stored pct (tie)', () => {
    saveHighScore('flag', { correct: 50, total: 195, pct: 26 });
    expect(isNewHighScore('flag', 26)).toBe(false);
  });

  it('isNewHighScore returns true when stored score has no pct', () => {
    localStorage.setItem('swiss-tracker-game-scores', JSON.stringify({ flag: { correct: 5 } }));
    expect(isNewHighScore('flag', 0)).toBe(true);
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

  it('does not overwrite equal score', () => {
    saveHighScore('flag', { correct: 80, total: 195, pct: 41 });
    saveHighScore('flag', { correct: 100, total: 195, pct: 41 }); // same pct, different correct
    expect(getHighScore('flag').correct).toBe(80); // first one preserved
  });
});

describe('load() resilience', () => {
  it('returns empty object when stored value is null JSON', () => {
    localStorage.setItem('swiss-tracker-game-scores', 'null');
    expect(getHighScore('flag')).toBeNull();
  });

  it('returns empty object when stored value is an array', () => {
    localStorage.setItem('swiss-tracker-game-scores', '[]');
    expect(getHighScore('flag')).toBeNull();
  });

  it('returns empty object when stored value is invalid JSON', () => {
    localStorage.setItem('swiss-tracker-game-scores', 'not-json');
    expect(getHighScore('flag')).toBeNull();
  });
});
