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
