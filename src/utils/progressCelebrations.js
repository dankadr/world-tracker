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

const TOGGLE_COOLDOWN_MS = 1500;

/**
 * Returns true and records the timestamp if the country can be toggled.
 * Returns false (blocking the toggle) if the same country was toggled
 * within TOGGLE_COOLDOWN_MS milliseconds.
 *
 * @param {Map<string, number>} cooldownMap - shared mutable Map (from useRef)
 * @param {string} countryCode
 * @param {number} [now=Date.now()]
 */
export function checkToggleCooldown(cooldownMap, countryCode, now = Date.now()) {
  const lastToggle = cooldownMap.get(countryCode);
  if (lastToggle !== undefined && now - lastToggle < TOGGLE_COOLDOWN_MS) return false;
  cooldownMap.set(countryCode, now);
  return true;
}

export function getAchShownKey(userId) {
  return userId ? `swiss-tracker-shown-ach-${userId}` : 'swiss-tracker-shown-ach';
}

export function readAchShown(userId) {
  const plain = localStorage.getItem(getAchShownKey(userId));
  return plain ? parseStoredIdList(plain) : [];
}

export function writeAchShown(userId, ids) {
  localStorage.setItem(getAchShownKey(userId), JSON.stringify([...ids]));
}
