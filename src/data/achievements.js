import achievementsConfig from '../config/achievements.json';
import { countryList } from './countries';

const STORAGE_PREFIX = 'swiss-tracker-visited-';

// ---- Helpers ----

function getVisitedIds(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.keys(data);
    }
  } catch { /* ignore */ }
  return [];
}

function getVisited(countryId) {
  return getVisitedIds(countryId).length;
}

function getTotalRegions(countryId) {
  const c = countryList.find((x) => x.id === countryId);
  return c ? c.data.features.filter((f) => !f.properties?.isBorough).length : 0;
}

function getAllVisited() {
  return countryList.reduce((sum, c) => sum + getVisited(c.id), 0);
}

function getAllTotal() {
  return countryList.reduce((sum, c) => sum + getTotalRegions(c.id), 0);
}

// ---- Rule Engine ----

function evaluateRule(rule) {
  switch (rule.type) {
    case 'totalVisited':
      return getAllVisited() >= rule.min;

    case 'totalPercent': {
      const total = getAllTotal();
      return total > 0 && getAllVisited() / total >= rule.min;
    }

    case 'countryVisited':
      return getVisited(rule.country) >= rule.min;

    case 'countryComplete':
      return getVisited(rule.country) >= getTotalRegions(rule.country) && getTotalRegions(rule.country) > 0;

    case 'countriesComplete':
      return countryList.filter(
        (c) => getVisited(c.id) >= getTotalRegions(c.id) && getTotalRegions(c.id) > 0
      ).length >= rule.min;

    case 'allCountriesHaveVisits':
      return countryList.every((c) => getVisited(c.id) > 0);

    case 'subregionVisited': {
      const ids = getVisitedIds(rule.country);
      const regionSet = new Set(rule.regionIds);
      const count = ids.filter((id) => regionSet.has(id)).length;
      return count >= rule.min;
    }

    default:
      return false;
  }
}

// ---- Build achievements with check functions from config ----

const achievements = achievementsConfig.map((entry) => ({
  ...entry,
  check: () => evaluateRule(entry.rule),
}));

export default achievements;
