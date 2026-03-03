import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  levelFromXp,
  getUnlockedRewards,
  getLevelTier,
  LEVEL_UNLOCKS,
} from '../xpSystem';

describe('xpForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('returns 0 for level <= 1', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-5)).toBe(0);
  });

  it('returns correct value for level 2', () => {
    expect(xpForLevel(2)).toBe(Math.round(50 * Math.pow(2, 1.5)));
  });

  it('returns correct value for level 5', () => {
    expect(xpForLevel(5)).toBe(Math.round(50 * Math.pow(5, 1.5)));
  });

  it('is monotonically increasing', () => {
    for (let level = 2; level <= 20; level++) {
      expect(xpForLevel(level)).toBeLessThan(xpForLevel(level + 1));
    }
  });
});

describe('levelFromXp', () => {
  it('returns level 1 with 0 xp', () => {
    const result = levelFromXp(0);
    expect(result.level).toBe(1);
    expect(result.currentXp).toBe(0);
  });

  it('returns level 1 just below level 2 threshold', () => {
    const threshold = xpForLevel(2);
    const result = levelFromXp(threshold - 1);
    expect(result.level).toBe(1);
    expect(result.currentXp).toBe(threshold - 1);
  });

  it('advances to level 2 at exact level 2 threshold', () => {
    const threshold = xpForLevel(2);
    const result = levelFromXp(threshold);
    expect(result.level).toBe(2);
    expect(result.currentXp).toBe(0);
  });

  it('correctly computes multi-level progression', () => {
    const l2 = xpForLevel(2);
    const l3 = xpForLevel(3);
    const result = levelFromXp(l2 + l3);
    expect(result.level).toBe(3);
    expect(result.currentXp).toBe(0);
  });

  it('sets nextLevelXp to xpForLevel(level + 1)', () => {
    const result = levelFromXp(0);
    expect(result.nextLevelXp).toBe(xpForLevel(2));
  });

  it('correctly sets currentXp as partial progress within level', () => {
    const l2 = xpForLevel(2);
    const partial = 30;
    const result = levelFromXp(l2 + partial);
    expect(result.level).toBe(2);
    expect(result.currentXp).toBe(partial);
  });
});

describe('getUnlockedRewards', () => {
  it('returns empty array for level 1', () => {
    expect(getUnlockedRewards(1)).toEqual([]);
  });

  it('returns empty array for level 2', () => {
    expect(getUnlockedRewards(2)).toEqual([]);
  });

  it('unlocks shoes at level 3', () => {
    const rewards = getUnlockedRewards(3);
    expect(rewards).toContain('shoes');
    expect(rewards).not.toContain('glasses');
  });

  it('unlocks glasses at level 5', () => {
    const rewards = getUnlockedRewards(5);
    expect(rewards).toContain('shoes');
    expect(rewards).toContain('glasses');
    expect(rewards).not.toContain('cape');
  });

  it('unlocks cape at level 10', () => {
    const rewards = getUnlockedRewards(10);
    expect(rewards).toContain('cape');
    expect(rewards).not.toContain('badge');
  });

  it('unlocks badge at level 15', () => {
    const rewards = getUnlockedRewards(15);
    expect(rewards).toContain('badge');
    expect(rewards).not.toContain('pet');
  });

  it('unlocks pet at level 20', () => {
    const rewards = getUnlockedRewards(20);
    expect(rewards).toContain('pet');
  });

  it('unlocks all rewards at high level', () => {
    const rewards = getUnlockedRewards(30);
    expect(rewards).toHaveLength(Object.keys(LEVEL_UNLOCKS).length);
  });
});

describe('getLevelTier', () => {
  it('returns Bronze for level 1', () => {
    expect(getLevelTier(1).name).toBe('Bronze');
  });

  it('returns Bronze for level 9', () => {
    expect(getLevelTier(9).name).toBe('Bronze');
  });

  it('returns Silver for level 10', () => {
    expect(getLevelTier(10).name).toBe('Silver');
  });

  it('returns Silver for level 19', () => {
    expect(getLevelTier(19).name).toBe('Silver');
  });

  it('returns Gold for level 20', () => {
    expect(getLevelTier(20).name).toBe('Gold');
  });

  it('returns Gold for level 29', () => {
    expect(getLevelTier(29).name).toBe('Gold');
  });

  it('returns Diamond for level 30', () => {
    expect(getLevelTier(30).name).toBe('Diamond');
  });

  it('returns Diamond for level 50', () => {
    expect(getLevelTier(50).name).toBe('Diamond');
  });

  it('tier objects have color and bg fields', () => {
    const tier = getLevelTier(1);
    expect(tier).toHaveProperty('color');
    expect(tier).toHaveProperty('bg');
  });
});
