export function parseStoredIdList(raw) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function createAchievementBaseline(storedSeenIds, currentUnlockedIds) {
  return new Set(storedSeenIds.length > 0 ? storedSeenIds : currentUnlockedIds);
}

export function getNewlyUnlockedIds(previouslyUnlockedIds, currentUnlockedIds) {
  const previousSet = previouslyUnlockedIds instanceof Set
    ? previouslyUnlockedIds
    : new Set(previouslyUnlockedIds || []);

  return currentUnlockedIds.filter((id) => !previousSet.has(id));
}

export function getCrossedMilestone(previousPct, nextPct, milestones) {
  if (previousPct === nextPct) return null;

  for (const milestone of milestones) {
    if (previousPct < milestone && nextPct >= milestone) {
      return milestone;
    }
  }

  return null;
}

export function markMilestoneShown(shownMilestones, trackerId, milestone) {
  const nextShown = shownMilestones instanceof Set
    ? new Set(shownMilestones)
    : new Set(shownMilestones || []);
  const milestoneId = `${trackerId}-${milestone}`;

  if (nextShown.has(milestoneId)) {
    return { shouldFire: false, shownMilestones: nextShown, milestoneId };
  }

  nextShown.add(milestoneId);
  return { shouldFire: true, shownMilestones: nextShown, milestoneId };
}
