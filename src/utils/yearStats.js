import { countryList } from '../data/countries';
import worldData from '../data/world.json';
import continentMap from '../config/continents.json';
import getAchievements from '../data/achievements';
import { secureStorage } from './secureStorage';

const INHABITED_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const WORLD_TOTAL = worldData.features.length;

function getFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const offset = 0x1F1E6 - 65;
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + offset,
    code.toUpperCase().charCodeAt(1) + offset,
  );
}

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getDatesForCountry(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'dates-' + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function getVisitedIds(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.keys(data);
    }
  } catch { /* ignore */ }
  return [];
}

function getWorldVisitedIds(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * Get all years that have any dated visits.
 */
export function getAvailableYears(userId) {
  const years = new Set();
  for (const c of countryList) {
    const dates = getDatesForCountry(c.id, userId);
    for (const dateStr of Object.values(dates)) {
      if (dateStr && typeof dateStr === 'string' && dateStr.length >= 4) {
        const y = parseInt(dateStr.substring(0, 4), 10);
        if (y >= 2000 && y <= 2100) years.add(y);
      }
    }
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * Compute Year-in-Review stats for a given year.
 */
export function computeYearStats(userId, year) {
  const yearStr = String(year);

  // Collect all visits in this year, grouped by tracker
  const regionsByTracker = {}; // { countryId: [regionId, ...] }
  const allDatesInYear = new Set(); // unique visit dates
  let firstVisitDate = null;
  let lastVisitDate = null;

  for (const c of countryList) {
    const dates = getDatesForCountry(c.id, userId);
    const regionsThisYear = [];

    for (const [regionId, dateStr] of Object.entries(dates)) {
      if (!dateStr || !dateStr.startsWith(yearStr)) continue;
      regionsThisYear.push(regionId);
      allDatesInYear.add(dateStr);

      if (!firstVisitDate || dateStr < firstVisitDate) firstVisitDate = dateStr;
      if (!lastVisitDate || dateStr > lastVisitDate) lastVisitDate = dateStr;
    }

    if (regionsThisYear.length > 0) {
      regionsByTracker[c.id] = regionsThisYear;
    }
  }

  const totalRegions = Object.values(regionsByTracker).reduce((s, r) => s + r.length, 0);
  const trackersUsed = Object.keys(regionsByTracker).length;

  // Determine top tracker
  let topTracker = null;
  let topCount = 0;
  for (const [countryId, regions] of Object.entries(regionsByTracker)) {
    if (regions.length > topCount) {
      topCount = regions.length;
      const info = countryList.find(c => c.id === countryId);
      topTracker = {
        id: countryId,
        name: info?.name || countryId,
        flag: info?.flag || '',
        count: regions.length,
        regionLabel: info?.regionLabel || 'regions',
      };
    }
  }

  // Build per-tracker breakdown
  const trackerBreakdown = Object.entries(regionsByTracker).map(([countryId, regions]) => {
    const info = countryList.find(c => c.id === countryId);
    return {
      id: countryId,
      name: info?.name || countryId,
      flag: info?.flag || '',
      count: regions.length,
      regionLabel: info?.regionLabel || 'regions',
      color: info?.visitedColor || '#2B7A8C',
    };
  }).sort((a, b) => b.count - a.count);

  // World countries: we don't have per-country dates, but we can note total
  const worldVisited = getWorldVisitedIds(userId);
  const worldCount = worldVisited.length;
  const worldPercent = worldCount > 0 ? +((worldCount / WORLD_TOTAL) * 100).toFixed(1) : 0;
  const visitedFlags = worldVisited.map(getFlagEmoji).filter(Boolean);

  // Continent breakdown for world countries
  const continentBreakdown = {};
  INHABITED_CONTINENTS.forEach(c => { continentBreakdown[c] = 0; });
  worldVisited.forEach(id => {
    const continent = continentMap[id];
    if (continent && continentBreakdown[continent] !== undefined) {
      continentBreakdown[continent]++;
    }
  });

  // Achievements unlocked count
  let achievementsUnlocked = 0;
  try {
    const achievements = getAchievements(userId);
    achievementsUnlocked = achievements.filter(a => a.check()).length;
  } catch { /* ignore */ }

  // Compute previous year stats for comparison
  const prevYearStr = String(year - 1);
  let prevYearRegions = 0;
  for (const c of countryList) {
    const dates = getDatesForCountry(c.id, userId);
    for (const dateStr of Object.values(dates)) {
      if (dateStr && dateStr.startsWith(prevYearStr)) {
        prevYearRegions++;
      }
    }
  }

  let comparedToPrevYear = null;
  if (prevYearRegions > 0 && totalRegions > 0) {
    const change = Math.round(((totalRegions - prevYearRegions) / prevYearRegions) * 100);
    comparedToPrevYear = change >= 0 ? `+${change}%` : `${change}%`;
  } else if (prevYearRegions === 0 && totalRegions > 0) {
    comparedToPrevYear = 'first-year';
  }

  // Month distribution (for activity heat insight)
  const monthCounts = new Array(12).fill(0);
  for (const dateStr of allDatesInYear) {
    const month = parseInt(dateStr.substring(5, 7), 10) - 1;
    if (month >= 0 && month < 12) monthCounts[month]++;
  }
  const busiestMonth = monthCounts.indexOf(Math.max(...monthCounts));
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    year,
    totalRegions,
    trackersUsed,
    topTracker,
    trackerBreakdown,
    worldCountries: worldCount,
    worldTotal: WORLD_TOTAL,
    worldPercent,
    visitedFlags,
    continentBreakdown,
    achievementsUnlocked,
    totalVisitDays: allDatesInYear.size,
    firstVisitDate,
    lastVisitDate,
    comparedToPrevYear,
    busiestMonth: monthCounts[busiestMonth] > 0 ? monthNames[busiestMonth] : null,
    busiestMonthCount: monthCounts[busiestMonth],
    monthCounts,
    hasData: totalRegions > 0,
  };
}
