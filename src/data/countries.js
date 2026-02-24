import countriesConfig from '../config/countries.json';

// ── Dynamic GeoJSON loaders ────────────────────────────────────────────────
// Vite splits each import() into a separate browser-cached chunk.
// Keys must be static strings so Vite can statically analyse them.

const geoCache = new Map();

const geoLoaders = {
  'cantons.json':     () => import('./cantons.json'),
  'usa.json':         () => import('./usa.json'),
  'us-parks.json':    () => import('./us-parks.json'),
  'nyc.json':         () => import('./nyc.json'),
  'norway.json':      () => import('./norway.json'),
  'canada.json':      () => import('./canada.json'),
  'capitals.json':    () => import('./capitals.json'),
  'japan.json':       () => import('./japan.json'),
  'australia.json':   () => import('./australia.json'),
  'philippines.json': () => import('./philippines.json'),
};

/**
 * Load GeoJSON for a country on demand.
 * Results are cached in-memory after the first load.
 * @param {string} geoFile  e.g. 'cantons.json'
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export function loadCountryGeoData(geoFile) {
  if (geoCache.has(geoFile)) return geoCache.get(geoFile);
  const loader = geoLoaders[geoFile];
  if (!loader) return Promise.reject(new Error(`No loader registered for ${geoFile}`));
  const promise = loader().then((mod) => mod.default);
  geoCache.set(geoFile, promise);
  return promise;
}

// ── Countries config ───────────────────────────────────────────────────────
// countryList entries contain only config metadata (no .data field).
// Use loadCountryGeoData(country.geoFile) to get the GeoJSON when needed.

const countries = {};
for (const entry of countriesConfig) {
  countries[entry.id] = { ...entry };
}

export const countryList = Object.values(countries);
export default countries;
