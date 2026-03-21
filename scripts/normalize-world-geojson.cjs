// One-off script: generates src/data/world.json from Natural Earth 1:10m countries data.
// Run from the project root: node scripts/normalize-world-geojson.cjs
// Requires: curl + python3 + shapely (available on macOS/Linux; on Windows use WSL)
//   pip install shapely
//
// Source: Natural Earth 1:10m Admin-0 Countries
// https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson
//
// Pipeline:
//   1. Fetch 10m GeoJSON (~13MB) from Natural Earth
//   2. Normalize properties to { id, name } schema
//   3. Deduplicate territories (keep sovereign country)
//   4. Apply Douglas-Peucker simplification (tolerance=0.01°) → ~3-5MB output
//   5. Dissolve Israel + Palestine into a single unified polygon via shapely
//   6. Dissolve Somalia + Somaliland to fill the blank gap Somaliland leaves

const { writeFileSync, readFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) { console.error(`✗ ${message}`); process.exit(1); }
}

// ─── Douglas-Peucker simplification ──────────────────────────────────────────
// Tolerance in degrees. 0.01° ≈ 1.1km at the equator — keeps coastline detail
// visible at zoom 5–9 before the overlay fades out.
const SIMPLIFY_TOLERANCE = 0.01;

function perpDist(pt, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
}

function dpReduce(pts, tol) {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > tol) {
    return [...dpReduce(pts.slice(0, maxI + 1), tol).slice(0, -1), ...dpReduce(pts.slice(maxI), tol)];
  }
  return [pts[0], pts[pts.length - 1]];
}

function simplifyRing(ring, tol) {
  const s = dpReduce(ring, tol);
  if (s.length < 4) return ring;                     // too simplified — keep original
  const last = s[s.length - 1];
  const closed = (s[0][0] === last[0] && s[0][1] === last[1]) ? s : [...s, s[0]];
  return closed;
}

function simplifyGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(r => simplifyRing(r, SIMPLIFY_TOLERANCE)) };
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(r => simplifyRing(r, SIMPLIFY_TOLERANCE))) };
  }
  return geom;
}

// ─── Shapely dissolve helper ──────────────────────────────────────────────────
// Takes an array of GeoJSON polygon coordinate arrays (each is [outerRing, ...holes]),
// dissolves them into a single unified geometry, returns a GeoJSON geometry object.
function dissolvePolygons(polygonCoordArrays, label) {
  console.log(`  Dissolving ${label} via shapely...`);
  const inputPath  = join(__dirname, '../.ne_dissolve_input_tmp.json');
  const outputPath = join(__dirname, '../.ne_dissolve_output_tmp.json');

  writeFileSync(inputPath, JSON.stringify(polygonCoordArrays));

  const pyScript = `
import json, sys
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

with open(sys.argv[1]) as f:
    polys_raw = json.load(f)

shapes = []
for coords in polys_raw:
    try:
        p = Polygon(coords[0], coords[1:])
        shapes.append(p if p.is_valid else p.buffer(0))
    except Exception:
        pass

result = unary_union(shapes)

with open(sys.argv[2], 'w') as f:
    json.dump(mapping(result), f)
`;

  execFileSync('python3', ['-c', pyScript, inputPath, outputPath]);
  const result = JSON.parse(readFileSync(outputPath, 'utf8'));

  unlinkSync(inputPath);
  unlinkSync(outputPath);
  return result;
}

// ─── Fetch 10m source ─────────────────────────────────────────────────────────
const SRC_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson';
const TMP_PATH = join(__dirname, '../.ne_10m_countries_tmp.geojson');

if (!existsSync(TMP_PATH)) {
  console.log('Downloading Natural Earth 1:10m countries data (~13MB)...');
  execFileSync('curl', ['-L', '-o', TMP_PATH, SRC_URL], { stdio: 'inherit' });
}

const src = JSON.parse(readFileSync(TMP_PATH, 'utf8'));

assert(src.type === 'FeatureCollection', 'Expected FeatureCollection');
assert(src.features.length > 150, `Expected 150+ features, got ${src.features.length}`);

// ─── Normalize + deduplicate ──────────────────────────────────────────────────
// Natural Earth uses ISO_A2; some countries (France, Norway, Kosovo) have '-99'
// due to disputed-borders encoding — ISO_A2_EH is the fallback.
// Territories share their sovereign's code; keep lowest scalerank entry.
const seen = new Set();

// Polygons collected for geometric dissolves (prevents internal border lines)
const israelPolygons     = [];  // IL + PS → merge into Israel feature
const palestinePolygons  = [];
const somaliaPolygons    = [];  // SO + Somaliland → merge into Somalia feature
const somalilandPolygons = [];

const features = src.features
  .sort((a, b) => a.properties.scalerank - b.properties.scalerank)
  .reduce((acc, f) => {
    let isoA2 = f.properties.ISO_A2;
    if (isoA2 === '-99') isoA2 = f.properties.ISO_A2_EH;

    const adminName = f.properties.ADMIN || '';

    // Somaliland: ISO_A2='-99' on both fields so it's normally skipped, leaving a
    // blank white gap in northern Somalia. Capture it for merging into Somalia.
    if (adminName === 'Somaliland') {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      somalilandPolygons.push(...polys);
      return acc;
    }

    if (!isoA2 || isoA2 === '-99') return acc; // skip truly unidentifiable features

    const id = isoA2.toLowerCase();

    // Israel + Palestine: collect for dissolve to avoid internal border lines
    if (id === 'il') {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      israelPolygons.push(...polys);
    }
    if (id === 'ps') {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      palestinePolygons.push(...polys);
      return acc; // skip Palestine as standalone feature
    }

    // Somalia: collect alongside Somaliland for dissolve
    if (id === 'so') {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      somaliaPolygons.push(...polys);
    }

    if (seen.has(isoA2)) return acc;
    seen.add(isoA2);

    acc.push({
      type: 'Feature',
      properties: { id, name: f.properties.ADMIN },
      geometry: simplifyGeometry(f.geometry),
    });
    return acc;
  }, []);

// ─── Geometric dissolves ──────────────────────────────────────────────────────
console.log('Running geometric dissolves...');

if (israelPolygons.length > 0) {
  const dissolved = dissolvePolygons(
    [...israelPolygons, ...palestinePolygons],
    `Israel (${israelPolygons.length}p) + Palestine (${palestinePolygons.length}p)`
  );
  const feat = features.find(f => f.properties.id === 'il');
  if (feat) feat.geometry = dissolved;
}

if (somalilandPolygons.length > 0) {
  const dissolved = dissolvePolygons(
    [...somaliaPolygons, ...somalilandPolygons],
    `Somalia (${somaliaPolygons.length}p) + Somaliland (${somalilandPolygons.length}p)`
  );
  const feat = features.find(f => f.properties.id === 'so');
  if (feat) feat.geometry = dissolved;
}

// ─── Output ───────────────────────────────────────────────────────────────────
const normalized = { type: 'FeatureCollection', features };

// Spot-check
[
  { id: 'zw', name: 'Zimbabwe' },
  { id: 'us', name: 'United States of America' },
  { id: 'fr', name: 'France' },
  { id: 'jp', name: 'Japan' },
].forEach(({ id, name }) => {
  const found = normalized.features.find(f => f.properties.id === id);
  assert(found, `Missing expected country: ${id}`);
  assert(found.properties.name === name, `Name mismatch for ${id}: got "${found.properties.name}", expected "${name}"`);
});

const outPath = join(__dirname, '../src/data/world.json');
writeFileSync(outPath, JSON.stringify(normalized));

unlinkSync(TMP_PATH);

const totalPts = normalized.features.reduce((sum, f) => {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : (g.coordinates || []);
  return sum + polys.reduce((s, poly) => s + poly.reduce((s2, ring) => s2 + ring.length, 0), 0);
}, 0);

const sizeMB = (Buffer.byteLength(JSON.stringify(normalized)) / 1024 / 1024).toFixed(2);
console.log(`✓ Written ${normalized.features.length} countries to src/data/world.json`);
console.log(`  Size: ${sizeMB} MB | Points: ${totalPts.toLocaleString()} | Tolerance: ${SIMPLIFY_TOLERANCE}°`);
