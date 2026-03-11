import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import worldData from '../data/world.json';
import getAchievements from '../data/achievements';

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

// Only count inhabited continents (same set as yearStats.js)
const INHABITED_CONTINENTS = new Set([
  'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania',
]);

const WORLD_TOTAL = worldData.features.length; // 238

function getFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + offset,
    code.toUpperCase().charCodeAt(1) + offset,
  );
}

/**
 * Compute all-time aggregate stats across all trackers.
 */
export function computeAllTimeStats(userId) {
  // World countries + continents
  let worldCountries = 0;
  let visitedFlags = [];
  const continentsSet = new Set();
  const continentBreakdown = {};
  [...INHABITED_CONTINENTS].forEach(c => { continentBreakdown[c] = 0; });
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      const ids = Array.isArray(data) ? data : [];
      worldCountries = ids.length;
      visitedFlags = ids.map(getFlagEmoji).filter(Boolean);
      ids.forEach(id => {
        const continent = continentMap[id];
        if (continent && INHABITED_CONTINENTS.has(continent)) {
          continentsSet.add(continent);
          continentBreakdown[continent] = (continentBreakdown[continent] || 0) + 1;
        }
      });
    }
  } catch { /* ignore */ }

  const worldPercent = worldCountries > 0
    ? +((worldCountries / WORLD_TOTAL) * 100).toFixed(1)
    : 0;

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

  // Achievements unlocked
  let achievements = 0;
  try {
    const all = getAchievements(userId);
    achievements = all.filter(a => a.check()).length;
  } catch { /* ignore */ }

  return {
    worldCountries,
    worldTotal: WORLD_TOTAL,
    worldPercent,
    visitedFlags,
    totalRegions,
    continentsVisited: continentsSet.size,
    continentBreakdown,
    achievements,
  };
}
