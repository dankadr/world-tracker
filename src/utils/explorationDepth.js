import { countryList } from '../data/countries';

// Build a lookup map once
const TRACKER_MAP = countryList.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {});

/**
 * Returns 0.0 – 1.0 exploration depth for a country.
 * Uses all visited region keys from secureStorage that match countryId.
 */
export function getExplorationDepth(countryId, allVisitedKeys) {
  const tracker = TRACKER_MAP[countryId];
  if (!tracker) return 0;
  const total = tracker.data.features.filter((f) => !f.properties?.isBorough).length;
  if (total === 0) return 0;
  const visited = allVisitedKeys.filter((k) => k.startsWith(countryId + ':')).length;
  return Math.min(visited / total, 1);
}

export function depthToColor(depth, darkMode) {
  if (depth === 0) return darkMode ? '#3a3a3a' : '#cfd8dc';
  const stops = darkMode
    ? ['#5a4a1a', '#8a6a1a', '#c9a84c', '#f0cc60']
    : ['#f5e8c0', '#e8c96a', '#c9a84c', '#b8943a'];
  const idx = Math.min(3, Math.floor(depth * 4));
  return stops[idx];
}
