/**
 * Computes progress for a given achievement rule.
 * Returns { current, target, pct, unlocked }.
 * - current: how far the user is now
 * - target: what number is needed for unlock
 * - pct: 0-100 percentage
 * - unlocked: boolean
 */

import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import worldData from '../data/world.json';
import countryMeta from '../config/countryMeta.json';
import capitalsData from '../data/capitals.json';
import achievementsConfig from '../config/achievements.json';

const INHABITED_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const TOTAL_WORLD_COUNTRIES = worldData.features.length;

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedIds(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.keys(data);
    }
  } catch { /* ignore */ }
  return [];
}

function getVisited(countryId, userId) {
  return getVisitedIds(countryId, userId).length;
}

function getTotalRegions(countryId) {
  const c = countryList.find((x) => x.id === countryId);
  return c ? c.data.features.filter((f) => !f.properties?.isBorough).length : 0;
}

function getAllVisited(userId) {
  return countryList.reduce((sum, c) => sum + getVisited(c.id, userId), 0);
}

function getAllTotal() {
  return countryList.reduce((sum, c) => sum + getTotalRegions(c.id), 0);
}

function getWorldVisited(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

function getContinentsVisited(userId) {
  const visited = getWorldVisited(userId);
  const continents = new Set();
  visited.forEach((code) => {
    const continent = continentMap[code];
    if (continent && INHABITED_CONTINENTS.includes(continent)) {
      continents.add(continent);
    }
  });
  return continents.size;
}

function getCountriesComplete(userId) {
  return countryList.filter(
    (c) => getVisited(c.id, userId) >= getTotalRegions(c.id) && getTotalRegions(c.id) > 0
  ).length;
}

function getCountriesWithVisits(userId) {
  return countryList.filter((c) => getVisited(c.id, userId) > 0).length;
}

function getWorldContinentCounts(userId, continent) {
  const wVisited = new Set(getWorldVisited(userId));
  const continentCountries = Object.entries(continentMap)
    .filter(([, cont]) => cont === continent);
  const current = continentCountries.filter(([code]) => wVisited.has(code)).length;
  return { current, target: continentCountries.length };
}

function getWorldTagCount(userId, tag) {
  const wVisited = getWorldVisited(userId);
  return wVisited.filter((code) => {
    const meta = countryMeta[code];
    return meta && meta.tags && meta.tags.includes(tag);
  }).length;
}

function getWorldTagTotal(tag) {
  return Object.values(countryMeta).filter(
    (meta) => meta && meta.tags && meta.tags.includes(tag)
  ).length;
}

function getHemisphereCount(userId, mode) {
  const wVisited = getWorldVisited(userId);
  const visitedCoords = [];
  for (const code of wVisited) {
    const cap = capitalsData.features.find((f) => f.properties.country === code);
    if (cap) visitedCoords.push(cap.geometry.coordinates);
  }
  if (mode === 'ns') {
    const hasNorth = visitedCoords.some(([, lat]) => lat > 0);
    const hasSouth = visitedCoords.some(([, lat]) => lat <= 0);
    return { current: (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0), target: 2 };
  }
  // mode === 'all'
  const hasNorth = visitedCoords.some(([, lat]) => lat > 0);
  const hasSouth = visitedCoords.some(([, lat]) => lat <= 0);
  const hasEast = visitedCoords.some(([lng]) => lng >= 0);
  const hasWest = visitedCoords.some(([lng]) => lng < 0);
  return {
    current: (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasEast ? 1 : 0) + (hasWest ? 1 : 0),
    target: 4,
  };
}

/**
 * Evaluate how many achievements are unlocked (for "achievementsUnlocked" rule).
 * Avoids circular dependency by taking a pre-computed result set.
 */
function getUnlockedCount(allResults) {
  return allResults.filter(
    (a) => a.unlocked && a.rule.type !== 'achievementsUnlocked' && a.rule.type !== 'categoryComplete'
  ).length;
}

function getCategoryUnlockedCount(allResults, category) {
  const catAchievements = allResults.filter(
    (a) => a.category === category && a.rule.type !== 'categoryComplete'
  );
  return {
    current: catAchievements.filter((a) => a.unlocked).length,
    target: catAchievements.length,
  };
}

/**
 * Compute progress for a single achievement rule.
 * allResults is optional, only needed for 'achievementsUnlocked' and 'categoryComplete'.
 */
export function computeProgress(rule, userId, allResults = []) {
  let current = 0;
  let target = 1;

  switch (rule.type) {
    case 'totalVisited':
      current = getAllVisited(userId);
      target = rule.min;
      break;

    case 'totalPercent': {
      const total = getAllTotal();
      const needed = Math.ceil(total * rule.min);
      current = getAllVisited(userId);
      target = needed;
      break;
    }

    case 'countryVisited':
      current = getVisited(rule.country, userId);
      target = rule.min;
      break;

    case 'countryComplete': {
      const total = getTotalRegions(rule.country);
      current = getVisited(rule.country, userId);
      target = total || 1;
      break;
    }

    case 'countriesComplete':
      current = getCountriesComplete(userId);
      target = rule.min;
      break;

    case 'allCountriesHaveVisits':
      current = getCountriesWithVisits(userId);
      target = countryList.length;
      break;

    case 'subregionVisited': {
      const ids = getVisitedIds(rule.country, userId);
      const regionSet = new Set(rule.regionIds);
      current = ids.filter((id) => regionSet.has(id)).length;
      target = rule.min;
      break;
    }

    case 'worldVisited':
      current = getWorldVisited(userId).length;
      target = rule.min;
      break;

    case 'continentsVisited':
      current = getContinentsVisited(userId);
      target = rule.min;
      break;

    case 'worldPercent': {
      const needed = Math.ceil(TOTAL_WORLD_COUNTRIES * rule.min);
      current = getWorldVisited(userId).length;
      target = needed;
      break;
    }

    case 'capitalsVisited':
      current = getVisited('capitals', userId);
      target = rule.min;
      break;

    case 'capitalsComplete': {
      const total = getTotalRegions('capitals');
      current = getVisited('capitals', userId);
      target = total || 1;
      break;
    }

    case 'worldContinentComplete': {
      const counts = getWorldContinentCounts(userId, rule.continent);
      current = counts.current;
      target = counts.target;
      break;
    }

    case 'specificCapitalVisited': {
      const visitedCaps = getVisitedIds('capitals', userId);
      current = visitedCaps.includes(rule.capitalId) ? 1 : 0;
      target = 1;
      break;
    }

    case 'allCapitalsVisited': {
      const visitedCaps = new Set(getVisitedIds('capitals', userId));
      current = rule.capitalIds.filter((id) => visitedCaps.has(id)).length;
      target = rule.capitalIds.length;
      break;
    }

    case 'worldTagVisited': {
      current = getWorldTagCount(userId, rule.tag);
      // For tags with a known total (like g7=7, nordic=5), use min as target
      // since that's what the achievement requires
      target = rule.min;
      break;
    }

    case 'worldAreaVisited': {
      const wVisited = getWorldVisited(userId);
      current = wVisited.reduce((sum, code) => {
        const meta = countryMeta[code];
        return sum + (meta ? meta.area : 0);
      }, 0);
      target = rule.min;
      break;
    }

    case 'worldPopulationVisited': {
      const wVisited = getWorldVisited(userId);
      current = wVisited.reduce((sum, code) => {
        const meta = countryMeta[code];
        return sum + (meta ? meta.population : 0);
      }, 0);
      target = rule.min;
      break;
    }

    case 'hemisphereVisited': {
      const hemi = getHemisphereCount(userId, rule.mode);
      current = hemi.current;
      target = hemi.target;
      break;
    }

    case 'achievementsUnlocked':
      current = getUnlockedCount(allResults);
      target = rule.min;
      break;

    case 'categoryComplete': {
      const cat = getCategoryUnlockedCount(allResults, rule.category);
      current = cat.current;
      target = cat.target;
      break;
    }

    case 'easterEggToggled': {
      try {
        const key = `swiss-tracker-easter-egg-${rule.easterEgg}`;
        current = localStorage.getItem(key) === 'true' ? 1 : 0;
      } catch { current = 0; }
      target = 1;
      break;
    }

    default:
      current = 0;
      target = 1;
  }

  // Clamp current to target max for percentage
  const clampedCurrent = Math.min(current, target);
  const pct = target > 0 ? Math.round((clampedCurrent / target) * 100) : 0;
  const unlocked = current >= target;

  return { current, target, pct, unlocked };
}

/**
 * Format progress display text.
 * For large numbers (area, population), abbreviate them.
 */
export function formatProgressText(current, target, ruleType) {
  if (ruleType === 'worldAreaVisited') {
    return `${formatLargeNumber(current)} / ${formatLargeNumber(target)} km²`;
  }
  if (ruleType === 'worldPopulationVisited') {
    return `${formatLargeNumber(current)} / ${formatLargeNumber(target)}`;
  }
  return `${Math.min(current, target)} / ${target}`;
}

function formatLargeNumber(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
