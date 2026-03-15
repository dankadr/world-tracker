// One-off script: generates src/data/world.json from Natural Earth 1:50m countries data.
// Run from the project root: node scripts/normalize-world-geojson.cjs
// Requires: curl (available on macOS/Linux; on Windows use WSL or install curl)
//
// Source: Natural Earth 1:50m Admin-0 Countries
// https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
//
// Note: The geo-countries npm package (which this task originally referenced) was unpublished
// from npm in 2019. This script fetches equivalent data directly from the Natural Earth vector
// repository which is the canonical upstream source for that dataset.

const { writeFileSync, readFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) { console.error(`\u2717 ${message}`); process.exit(1); }
}

const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const TMP_PATH = join(__dirname, '../.ne_50m_countries_tmp.geojson');

// Download source if not already cached
if (!existsSync(TMP_PATH)) {
  console.log('Downloading Natural Earth 1:50m countries data...');
  execFileSync('curl', ['-L', '-o', TMP_PATH, SRC_URL], { stdio: 'inherit' });
}

const src = JSON.parse(readFileSync(TMP_PATH, 'utf8'));

// Verify source looks right
assert(src.type === 'FeatureCollection', 'Expected FeatureCollection');
assert(src.features.length > 150, `Expected 150+ features, got ${src.features.length}`);

// Normalize to match existing schema: { id: "zw", name: "Zimbabwe" }
// Natural Earth uses ISO_A2 for country codes, but some countries (France, Norway, Kosovo)
// have ISO_A2 = '-99' due to disputed-borders encoding; ISO_A2_EH is the fallback.
// Deduplicate by ISO code (territories share their sovereign's code) keeping lowest scalerank.
const seen = new Set();
const features = src.features
  .sort((a, b) => a.properties.scalerank - b.properties.scalerank)
  .reduce((acc, f) => {
    let isoA2 = f.properties.ISO_A2;
    if (isoA2 === '-99') isoA2 = f.properties.ISO_A2_EH;
    if (!isoA2 || isoA2 === '-99') return acc; // skip truly unidentifiable features
    if (seen.has(isoA2)) return acc;            // deduplicate
    seen.add(isoA2);
    acc.push({
      ...f,
      properties: {
        id: isoA2.toLowerCase(),
        name: f.properties.ADMIN,
      },
    });
    return acc;
  }, []);

const normalized = {
  type: 'FeatureCollection',
  features,
};

// Spot-check
const spots = [
  { id: 'zw', name: 'Zimbabwe' },
  { id: 'us', name: 'United States of America' },
  { id: 'fr', name: 'France' },
  { id: 'jp', name: 'Japan' },
];
spots.forEach(({ id, name }) => {
  const found = normalized.features.find((f) => f.properties.id === id);
  assert(found, `Missing expected country: ${id}`);
  assert(found.properties.name === name, `Name mismatch for ${id}: got "${found.properties.name}", expected "${name}"`);
});

const outPath = join(__dirname, '../src/data/world.json');
writeFileSync(outPath, JSON.stringify(normalized));

// Clean up temp file
unlinkSync(TMP_PATH);

const sizeMB = (Buffer.byteLength(JSON.stringify(normalized)) / 1024 / 1024).toFixed(2);
console.log(`\u2713 Written ${normalized.features.length} countries to src/data/world.json (${sizeMB} MB)`);
