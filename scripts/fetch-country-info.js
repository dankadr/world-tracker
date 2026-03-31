#!/usr/bin/env node
/**
 * Fetches country info from the RestCountries v3.1 API and writes
 * src/data/countryInfo.json with one entry per ISO 3166-1 alpha-2 code.
 *
 * Run once: node scripts/fetch-country-info.js
 * Update quarterly to refresh population / area figures.
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '../src/data/countryInfo.json');

// Two requests because the API returns 400 with too many fields in one call
const RESTCOUNTRIES_BASE_URL = 'https://restcountries.com/v3.1/all?fields=cca2,name,capital,region,subregion,population,area,currencies,languages';
const RESTCOUNTRIES_EXTRA_URL = 'https://restcountries.com/v3.1/all?fields=cca2,flag,idd,car';

async function main() {
  console.log('Fetching country data from RestCountries v3.1…');

  const [res1, res2] = await Promise.all([
    fetch(RESTCOUNTRIES_BASE_URL),
    fetch(RESTCOUNTRIES_EXTRA_URL),
  ]);
  if (!res1.ok) throw new Error(`HTTP ${res1.status}: ${res1.statusText}`);
  if (!res2.ok) throw new Error(`HTTP ${res2.status}: ${res2.statusText}`);

  const countries = await res1.json();
  const extraList = await res2.json();

  // Merge extra fields by cca2
  const extra = {};
  for (const e of extraList) {
    if (e.cca2) extra[e.cca2] = e;
  }

  // Merge extra into countries
  for (const c of countries) {
    if (c.cca2 && extra[c.cca2]) {
      Object.assign(c, extra[c.cca2]);
    }
  }

  const result = {};

  for (const c of countries) {
    const id = c.cca2?.toLowerCase();
    if (!id) continue;

    // Capital
    const capital = Array.isArray(c.capital) ? c.capital[0] : null;

    // Currency — pick first listed
    const currencies = c.currencies || {};
    const currencyCode = Object.keys(currencies)[0] || null;
    const currencySymbol = currencyCode ? (currencies[currencyCode]?.symbol || currencyCode) : null;
    const currencyName = currencyCode ? (currencies[currencyCode]?.name || null) : null;

    // Language — pick first listed
    const languages = c.languages || {};
    const language = Object.values(languages)[0] || null;

    // Continent (RestCountries uses 'region' for continent)
    const continent = c.region || null;

    // Calling code
    const idd = c.idd || {};
    const callingCode = idd.root
      ? (idd.root + (idd.suffixes?.length === 1 ? idd.suffixes[0] : ''))
      : null;

    // Driving side
    const drivingSide = c.car?.side || 'right';

    // Flag emoji (already in the data as unicode emoji sequence)
    const flag = c.flag || null;

    result[id] = {
      name: c.name?.common || id.toUpperCase(),
      capital,
      continent,
      subregion: c.subregion || null,
      population: c.population || 0,
      area: c.area || 0,
      currency: currencyCode,
      currencySymbol,
      currencyName,
      language,
      flag,
      callingCode,
      drivingSide,
    };
  }

  // Sort by key for stable diffs
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));

  writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Written ${Object.keys(sorted).length} countries to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
