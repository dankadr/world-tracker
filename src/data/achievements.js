import achievementsConfig from '../config/achievements.json';
import { countryList } from './countries';
import continentMap from '../config/continents.json';
import worldData from './world.json';

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

function getWorldVisitedCount(userId) {
  return getWorldVisited(userId).length;
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

function evaluateRule(rule, userId) {
  switch (rule.type) {
    case 'totalVisited':
      return getAllVisited(userId) >= rule.min;

    case 'totalPercent': {
      const total = getAllTotal();
      return total > 0 && getAllVisited(userId) / total >= rule.min;
    }

    case 'countryVisited':
      return getVisited(rule.country, userId) >= rule.min;

    case 'countryComplete':
      return getVisited(rule.country, userId) >= getTotalRegions(rule.country) && getTotalRegions(rule.country) > 0;

    case 'countriesComplete':
      return countryList.filter(
        (c) => getVisited(c.id, userId) >= getTotalRegions(c.id) && getTotalRegions(c.id) > 0
      ).length >= rule.min;

    case 'allCountriesHaveVisits':
      return countryList.every((c) => getVisited(c.id, userId) > 0);

    case 'subregionVisited': {
      const ids = getVisitedIds(rule.country, userId);
      const regionSet = new Set(rule.regionIds);
      const count = ids.filter((id) => regionSet.has(id)).length;
      return count >= rule.min;
    }

    case 'worldVisited':
      return getWorldVisitedCount(userId) >= rule.min;

    case 'continentsVisited':
      return getContinentsVisited(userId) >= rule.min;

    case 'worldPercent':
      return TOTAL_WORLD_COUNTRIES > 0 && getWorldVisitedCount(userId) / TOTAL_WORLD_COUNTRIES >= rule.min;

    case 'capitalsVisited':
      return getVisited('capitals', userId) >= rule.min;

    case 'capitalsComplete':
      return getVisited('capitals', userId) >= getTotalRegions('capitals') && getTotalRegions('capitals') > 0;

    case 'worldContinentComplete': {
      const wVisited = new Set(getWorldVisited(userId));
      const continentCountries = Object.entries(continentMap)
        .filter(([, cont]) => cont === rule.continent);
      return continentCountries.length > 0 && continentCountries.every(([code]) => wVisited.has(code));
    }

    default:
      return false;
  }
}

export default function getAchievements(userId) {
  return achievementsConfig.map((entry) => ({
    ...entry,
    check: () => evaluateRule(entry.rule, userId),
  }));
}
