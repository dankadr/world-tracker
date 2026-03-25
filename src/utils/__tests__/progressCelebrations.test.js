import {
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
});
