import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import getAchievements from '../data/achievements';

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

// Only count inhabited continents (same set as yearStats.js)
const INHABITED_CONTINENTS = new Set([
  'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania',
]);

/**
 * Compute all-time aggregate stats across all trackers.
 * @param {string|null} userId
 * @returns {{ worldCountries: number, totalRegions: number, continentsVisited: number, achievements: number }}
 */
export function computeAllTimeStats(userId) {
  // World countries + continents
  let worldCountries = 0;
  const continentsSet = new Set();
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      const ids = Array.isArray(data) ? data : [];
      worldCountries = ids.length;
      ids.forEach(id => {
        const continent = continentMap[id];
        if (continent && INHABITED_CONTINENTS.has(continent)) continentsSet.add(continent);
      });
    }
  } catch { /* ignore */ }

  // Total visited regions across all trackers
  let totalRegions = 0;
  for (const c of countryList) {
    try {
      const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + c.id);
      if (raw) {
        const data = JSON.parse(raw);
        const ids = Array.isArray(data) ? data : Object.keys(data);
        totalRegions += ids.length;
      }
    } catch { /* ignore */ }
  }

  // Achievements unlocked — getAchievements returns objects with .check(), not .unlocked
  let achievements = 0;
  try {
    const all = getAchievements(userId);
    achievements = all.filter(a => a.check()).length;
  } catch { /* ignore */ }

  return {
    worldCountries,
    totalRegions,
    continentsVisited: continentsSet.size,
    achievements,
  };
}
