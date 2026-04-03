import {
  checkToggleCooldown,
  createAchievementBaseline,
  getCrossedMilestone,
  getNewlyUnlockedIds,
  markMilestoneShown,
  parseStoredIdList,
} from '../progressCelebrations';

describe('progressCelebrations', () => {
  it('uses current unlocked achievements as the baseline when nothing was persisted yet', () => {
    expect([...createAchievementBaseline([], ['a', 'b'])]).toEqual(['a', 'b']);
  });

  it('uses the persisted seen list as the baseline when it exists', () => {
    expect([...createAchievementBaseline(['a'], ['a', 'b'])]).toEqual(['a']);
  });

  it('detects only newly unlocked achievements', () => {
    expect(getNewlyUnlockedIds(new Set(['a', 'b']), ['a', 'b', 'c'])).toEqual(['c']);
  });

  it('parses stored ids defensively', () => {
    expect(parseStoredIdList('["a","b",3]')).toEqual(['a', 'b']);
    expect(parseStoredIdList('not-json')).toEqual([]);
  });

  it('detects the first milestone crossed by a progress increase', () => {
    expect(getCrossedMilestone(24, 26, [25, 50, 75, 100])).toBe(25);
    expect(getCrossedMilestone(25, 26, [25, 50, 75, 100])).toBeNull();
  });

  it('only fires confetti once per tracker milestone', () => {
    const first = markMilestoneShown(new Set(), 'ch', 25);
    expect(first.shouldFire).toBe(true);
    expect([...first.shownMilestones]).toEqual(['ch-25']);

    const second = markMilestoneShown(first.shownMilestones, 'ch', 25);
    expect(second.shouldFire).toBe(false);
    expect([...second.shownMilestones]).toEqual(['ch-25']);
  });

  describe('checkToggleCooldown', () => {
    it('allows the first toggle for a country', () => {
      const map = new Map();
      expect(checkToggleCooldown(map, 'jp', 1000)).toBe(true);
    });

    it('blocks a second toggle within 1500ms', () => {
      const map = new Map();
      checkToggleCooldown(map, 'jp', 1000);
      expect(checkToggleCooldown(map, 'jp', 2499)).toBe(false);
    });

    it('allows a toggle after 1500ms have elapsed', () => {
      const map = new Map();
      checkToggleCooldown(map, 'jp', 1000);
      expect(checkToggleCooldown(map, 'jp', 2500)).toBe(true);
    });

    it('does not block a different country during the cooldown', () => {
      const map = new Map();
      checkToggleCooldown(map, 'jp', 1000);
      expect(checkToggleCooldown(map, 'fr', 1001)).toBe(true);
    });

    it('updates the timestamp on an allowed toggle', () => {
      const map = new Map();
      checkToggleCooldown(map, 'jp', 1000);
      checkToggleCooldown(map, 'jp', 2500); // allowed, resets clock
      expect(checkToggleCooldown(map, 'jp', 3999)).toBe(false); // blocked: 3999 - 2500 = 1499
      expect(checkToggleCooldown(map, 'jp', 4000)).toBe(true);  // allowed: 4000 - 2500 = 1500
    });
  });
});
