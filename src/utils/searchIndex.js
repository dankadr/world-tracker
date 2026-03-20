/**
 * Global Search Index
 *
 * Builds a flat array of SearchEntry objects from all data sources.
 * Lazy — only built on first call to getIndex(); cached until resetIndex()
 * is called (e.g. when visited data changes).
 */

import countriesConfig from '../config/countries.json';
import worldData from '../data/world.json';
import unescoSites from '../data/unesco-sites.json';

// Lazy-loaded region GeoJSON modules — imported dynamically so the index
// is only constructed when the user opens the search palette.
const GEO_MODULES = {
  'cantons.json': () => import('../data/cantons.json'),
  'usa.json': () => import('../data/usa.json'),
  'us-parks.json': () => import('../data/us-parks.json'),
  'nyc.json': () => import('../data/nyc.json'),
  'norway.json': () => import('../data/norway.json'),
  'canada.json': () => import('../data/canada.json'),
  'japan.json': () => import('../data/japan.json'),
  'australia.json': () => import('../data/australia.json'),
  'philippines.json': () => import('../data/philippines.json'),
  'brazil.json': () => import('../data/brazil.json'),
  'france.json': () => import('../data/france.json'),
  'germany.json': () => import('../data/germany.json'),
  'italy.json': () => import('../data/italy.json'),
  'spain.json': () => import('../data/spain.json'),
  'mexico.json': () => import('../data/mexico.json'),
  'uk.json': () => import('../data/uk.json'),
  'india.json': () => import('../data/india.json'),
  'new-zealand.json': () => import('../data/new-zealand.json'),
  'england.json': () => import('../data/england.json'),
};

let cachedIndex = null;
let buildPromise = null;

/**
 * Reset the index cache (call when visited data changes).
 */
export function resetIndex() {
  cachedIndex = null;
  buildPromise = null;
}

/**
 * Returns the full search index, building it on first call.
 * @returns {Promise<SearchEntry[]>}
 */
export async function getIndex() {
  if (cachedIndex) return cachedIndex;
  if (buildPromise) return buildPromise;

  buildPromise = _buildIndex().then((idx) => {
    cachedIndex = idx;
    buildPromise = null;
    return idx;
  });
  return buildPromise;
}

async function _buildIndex() {
  const entries = [];

  // ── World countries ──────────────────────────────────────────────────
  for (const feature of worldData.features) {
    const { id, name, continent } = feature.properties;
    entries.push({
      id: `world:${id}`,
      type: 'country',
      trackerId: id,
      regionId: null,
      label: name,
      sublabel: continent || 'World',
      flag: null,
      continent,
    });
  }

  // ── Tracker regions ───────────────────────────────────────────────────
  for (const tracker of countriesConfig) {
    const loader = GEO_MODULES[tracker.geoFile];
    if (!loader) continue;
    try {
      const mod = await loader();
      const geo = mod.default || mod;
      for (const feature of geo.features || []) {
        const { id, name } = feature.properties;
        if (!id || !name) continue;
        // Skip boroughs (sub-regions not shown as primary regions)
        if (feature.properties.isBorough) continue;
        entries.push({
          id: `region:${tracker.id}:${id}`,
          type: 'region',
          trackerId: tracker.id,
          regionId: id,
          label: name,
          sublabel: `${tracker.name} · ${tracker.regionLabelSingular || tracker.regionLabel}`,
          flag: tracker.flag || null,
        });
      }
    } catch {
      // Skip unavailable data files silently
    }
  }

  // ── UNESCO sites ──────────────────────────────────────────────────────
  for (const site of unescoSites) {
    entries.push({
      id: `unesco:${site.id}`,
      type: 'unesco',
      trackerId: site.countryCode || null,
      regionId: null,
      label: site.name,
      sublabel: `UNESCO · ${site.country}`,
      flag: null,
      lat: site.lat,
      lng: site.lng,
    });
  }

  // ── Tracker shortcuts ─────────────────────────────────────────────────
  for (const tracker of countriesConfig) {
    entries.push({
      id: `tracker:${tracker.id}`,
      type: 'tracker',
      trackerId: tracker.id,
      regionId: null,
      label: tracker.name,
      sublabel: `Open ${tracker.name} tracker`,
      flag: tracker.flag || null,
    });
  }

  return entries;
}
