/**
 * XP & Leveling System
 *
 * XP curve: xpForLevel(N) = 50 * N^1.5 (rounded)
 * Level rewards unlock avatar categories at specific levels.
 */

export const XP_RULES = {
  VISIT_REGION: 10,
  VISIT_COUNTRY: 25,
  COMPLETE_TRACKER: 200,
  UNLOCK_ACHIEVEMENT: 50,
  COMPLETE_CHALLENGE: 100,
  FIRST_TRACKER_VISIT: 15,
};

/**
 * XP required to advance FROM level `level` to level+1.
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level, 1.5));
}

/**
 * Derive current level, progress, and next-level threshold from total XP.
 * @param {number} totalXp
 * @returns {{ level: number, currentXp: number, nextLevelXp: number }}
 */
export function levelFromXp(totalXp) {
  let level = 1;
  let cumulative = 0;
  while (true) {
    const next = xpForLevel(level + 1);
    if (cumulative + next > totalXp) break;
    cumulative += next;
    level++;
  }
  return {
    level,
    currentXp: totalXp - cumulative,
    nextLevelXp: xpForLevel(level + 1),
  };
}

/**
 * Level-based avatar category unlocks.
 * Maps category IDs → required level.
 */
export const LEVEL_UNLOCKS = {
  shoes: 3,
  glasses: 5,
  cape: 10,
  badge: 15,
  pet: 20,
};

/**
 * Returns array of unlocked avatar category IDs for a given level.
 */
export function getUnlockedRewards(level) {
  return Object.entries(LEVEL_UNLOCKS)
    .filter(([, reqLevel]) => level >= reqLevel)
    .map(([id]) => id);
}

/**
 * Get tier name and color based on level.
 */
export function getLevelTier(level) {
  if (level >= 30) return { name: 'Diamond', color: '#B9F2FF', bg: '#1a3a4a' };
  if (level >= 20) return { name: 'Gold', color: '#FFD700', bg: '#4a3a1a' };
  if (level >= 10) return { name: 'Silver', color: '#C0C0C0', bg: '#3a3a3a' };
  return { name: 'Bronze', color: '#CD7F32', bg: '#3a2a1a' };
}
