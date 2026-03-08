import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatTimeRemaining,
  getDifficultyLabel,
  getDurationLabel,
} from '../challengeUtils';

describe('formatTimeRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  it('returns null for null input', () => {
    expect(formatTimeRemaining(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatTimeRemaining(undefined)).toBeNull();
  });

  it('returns "Expired" for a past date', () => {
    expect(formatTimeRemaining('2024-12-31T00:00:00Z')).toBe('Expired');
  });

  it('returns "Expired" when time is exactly now (0ms diff)', () => {
    expect(formatTimeRemaining('2025-01-01T12:00:00Z')).toBe('Expired');
  });

  it('returns days and hours for 2d 3h remaining', () => {
    const end = new Date('2025-01-03T15:00:00Z'); // 2d 3h from now
    expect(formatTimeRemaining(end.toISOString())).toBe('2d 3h');
  });

  it('returns hours and minutes for sub-24h remaining', () => {
    const end = new Date('2025-01-01T15:30:00Z'); // 3h 30m from now
    expect(formatTimeRemaining(end.toISOString())).toBe('3h 30m');
  });

  it('returns minutes only for sub-1h remaining', () => {
    const end = new Date('2025-01-01T12:45:00Z'); // 45m from now
    expect(formatTimeRemaining(end.toISOString())).toBe('45m');
  });

  it('returns "0m" for very short remaining time (seconds only)', () => {
    const end = new Date('2025-01-01T12:00:30Z'); // 30 seconds from now
    expect(formatTimeRemaining(end.toISOString())).toBe('0m');
  });

  it('returns days with 0 hours correctly', () => {
    const end = new Date('2025-01-04T12:00:00Z'); // exactly 3d
    expect(formatTimeRemaining(end.toISOString())).toBe('3d 0h');
  });
});

describe('getDifficultyLabel', () => {
  it('returns correct object for easy', () => {
    expect(getDifficultyLabel('easy')).toEqual({
      emoji: '🟢',
      label: 'Easy',
      color: '#27ae60',
    });
  });

  it('returns correct object for medium', () => {
    expect(getDifficultyLabel('medium')).toEqual({
      emoji: '🟡',
      label: 'Medium',
      color: '#f39c12',
    });
  });

  it('returns correct object for hard', () => {
    expect(getDifficultyLabel('hard')).toEqual({
      emoji: '🔴',
      label: 'Hard',
      color: '#e74c3c',
    });
  });

  it('returns null for unknown difficulty', () => {
    expect(getDifficultyLabel('extreme')).toBeNull();
    expect(getDifficultyLabel('')).toBeNull();
    expect(getDifficultyLabel(undefined)).toBeNull();
  });
});

describe('getDurationLabel', () => {
  it('returns "48 hours" for "48h"', () => {
    expect(getDurationLabel('48h')).toBe('48 hours');
  });

  it('returns "1 week" for "1w"', () => {
    expect(getDurationLabel('1w')).toBe('1 week');
  });

  it('returns "1 month" for "1m"', () => {
    expect(getDurationLabel('1m')).toBe('1 month');
  });

  it('returns "No deadline" for "open-ended"', () => {
    expect(getDurationLabel('open-ended')).toBe('No deadline');
  });

  it('returns "No deadline" for unknown duration', () => {
    expect(getDurationLabel('2w')).toBe('No deadline');
    expect(getDurationLabel(undefined)).toBe('No deadline');
  });
});
