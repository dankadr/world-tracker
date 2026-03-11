import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import worldData from '../data/world.json';
import countryMeta from '../config/countryMeta.json';

// Rule types that have no named region list — show hint box instead
const NON_LISTABLE = new Set([
  'totalVisited', 'totalPercent', 'achievementsUnlocked', 'categoryComplete',
  'worldAreaVisited', 'worldPopulationVisited', 'hemisphereVisited',
  'gameCompleted', 'easterEggToggled', 'specificCapitalVisited',
  // UNESCO tracker rules
  'unescoVisited', 'unescoTypesVisited', 'unescoRegionsVisited', 'unescoOldSiteVisited',
  // Challenge rules
  'challengesCompleted', 'raceWon', 'largeTeamChallenge', 'challengesCreated',
]);

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedSet(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return new Set(Array.isArray(data) ? data : Object.keys(data));
    }
  } catch { /* ignore */ }
  return new Set();
}

function getVisitedWorldSet(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch { /* ignore */ }
  return new Set();
}

// Quick id→name lookup for world countries
const worldNameMap = Object.fromEntries(
  (worldData.features ?? []).map(f => [f.properties?.id, f.properties?.name])
);

function sorted(arr) {
  return [...arr].sort((a, b) => a.localeCompare(b));
}

/**
 * Compute visited and remaining name lists for a given achievement rule.
 * @param {object} rule — achievement rule object from achievements.json
 * @param {string|null} userId
 * @returns {{ isListable: boolean, visited: string[], remaining: string[] }}
 */
export function getDetailItems(rule, userId) {
  if (!rule || NON_LISTABLE.has(rule.type)) {
    return { isListable: false, visited: [], remaining: [] };
  }

  const { type } = rule;

  // countryVisited / countryComplete — all regions of a tracker
  if (type === 'countryVisited' || type === 'countryComplete') {
    const tracker = countryList.find(c => c.id === rule.country);
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const features = tracker.data.features.filter(f => !f.properties?.isBorough);
    const vis = getVisitedSet(rule.country, userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // subregionVisited — only specific regionIds within a tracker
  if (type === 'subregionVisited') {
    const tracker = countryList.find(c => c.id === rule.country);
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const regionSet = new Set(rule.regionIds);
    const features = tracker.data.features.filter(f => regionSet.has(f.properties.id));
    const vis = getVisitedSet(rule.country, userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldVisited / worldPercent — all world countries
  if (type === 'worldVisited' || type === 'worldPercent') {
    const vis = getVisitedWorldSet(userId);
    const visited = [], remaining = [];
    worldData.features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldContinentComplete — countries within a specific continent
  // NOTE: continent membership is in continents.json (flat map), NOT in worldData feature properties
  if (type === 'worldContinentComplete') {
    const vis = getVisitedWorldSet(userId);
    const codes = Object.entries(continentMap)
      .filter(([, cont]) => cont === rule.continent)
      .map(([code]) => code);
    const visited = [], remaining = [];
    codes.forEach(code => {
      const name = worldNameMap[code];
      if (!name) return;
      (vis.has(code) ? visited : remaining).push(name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // worldTagVisited — countries with a specific tag in countryMeta
  if (type === 'worldTagVisited') {
    const vis = getVisitedWorldSet(userId);
    const codes = Object.entries(countryMeta)
      .filter(([, meta]) => meta?.tags?.includes(rule.tag))
      .map(([code]) => code);
    const visited = [], remaining = [];
    codes.forEach(code => {
      const name = worldNameMap[code];
      if (!name) return;
      (vis.has(code) ? visited : remaining).push(name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // continentsVisited — the 6 inhabited continents
  if (type === 'continentsVisited') {
    const vis = getVisitedWorldSet(userId);
    const visitedConts = new Set();
    vis.forEach(code => {
      const cont = continentMap[code];
      if (cont) visitedConts.add(cont);
    });
    const ALL = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
    return {
      isListable: true,
      visited: sorted(ALL.filter(c => visitedConts.has(c))),
      remaining: sorted(ALL.filter(c => !visitedConts.has(c))),
    };
  }

  // capitalsVisited / capitalsComplete — all entries in the capitals tracker
  if (type === 'capitalsVisited' || type === 'capitalsComplete') {
    const tracker = countryList.find(c => c.id === 'capitals');
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const features = tracker.data.features.filter(f => !f.properties?.isBorough);
    const vis = getVisitedSet('capitals', userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // allCapitalsVisited — specific capitalIds only
  if (type === 'allCapitalsVisited') {
    const tracker = countryList.find(c => c.id === 'capitals');
    if (!tracker) return { isListable: false, visited: [], remaining: [] };
    const capSet = new Set(rule.capitalIds);
    const features = tracker.data.features.filter(f => capSet.has(f.properties.id));
    const vis = getVisitedSet('capitals', userId);
    const visited = [], remaining = [];
    features.forEach(f => {
      (vis.has(f.properties.id) ? visited : remaining).push(f.properties.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // countriesComplete — which trackers are 100% visited
  if (type === 'countriesComplete') {
    const visited = [], remaining = [];
    countryList.forEach(c => {
      const total = c.data.features.filter(f => !f.properties?.isBorough).length;
      if (total === 0) return;
      const count = getVisitedSet(c.id, userId).size;
      (count >= total ? visited : remaining).push(c.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  // allCountriesHaveVisits — which trackers have at least 1 visit
  if (type === 'allCountriesHaveVisits') {
    const visited = [], remaining = [];
    countryList.forEach(c => {
      const count = getVisitedSet(c.id, userId).size;
      (count > 0 ? visited : remaining).push(c.name);
    });
    return { isListable: true, visited: sorted(visited), remaining: sorted(remaining) };
  }

  return { isListable: false, visited: [], remaining: [] };
}
