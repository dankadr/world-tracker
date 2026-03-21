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
//   4. Apply Douglas-Peucker simplification (tolerance=0.05°) → ~3-4MB output
//   5. Dissolve Israel + Palestine into a single unified polygon via shapely

const { writeFileSync, readFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

function assert(condition, message) {
  if (!condition) { console.error(`✗ ${message}`); process.exit(1); }
}

// ─── Douglas-Peucker simplification ──────────────────────────────────────────
// Tolerance in degrees. 0.05° ≈ 5.5km at the equator.
const SIMPLIFY_TOLERANCE = 0.05;

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
const israelPolygons = [];    // collect all IL + PS polygon rings for geometric dissolve
const palestinePolygons = [];

const features = src.features
  .sort((a, b) => a.properties.scalerank - b.properties.scalerank)
  .reduce((acc, f) => {
    let isoA2 = f.properties.ISO_A2;
    if (isoA2 === '-99') isoA2 = f.properties.ISO_A2_EH;
    if (!isoA2 || isoA2 === '-99') return acc;

    const id = isoA2.toLowerCase();

    // Collect all Israel + Palestine geometries for geometric union
    if (id === 'il') {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      israelPolygons.push(...polys);
    }
    if (id === 'ps') {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      palestinePolygons.push(...polys);
      return acc; // skip Palestine as a standalone feature
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

// ─── Dissolve Israel + Palestine via shapely ──────────────────────────────────
// Naive polygon concatenation produces internal borders wherever adjacent
// polygons share an edge. shapely.unary_union does a proper geometric dissolve,
// yielding a single borderless shape.
if (israelPolygons.length > 0) {
  console.log(`Dissolving Israel (${israelPolygons.length} parts) + Palestine (${palestinePolygons.length} parts) via shapely...`);

  const allPolygons = [...israelPolygons, ...palestinePolygons];
  const dissolveInputPath = join(__dirname, '../.ne_dissolve_input_tmp.json');
  const dissolveOutputPath = join(__dirname, '../.ne_dissolve_output_tmp.json');

  writeFileSync(dissolveInputPath, JSON.stringify(allPolygons));

  // Python reads polygon rings from file, dissolves with shapely, writes result to file.
  // Using execFileSync (not execSync) to avoid shell injection.
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

  execFileSync('python3', ['-c', pyScript, dissolveInputPath, dissolveOutputPath]);

  const dissolved = JSON.parse(readFileSync(dissolveOutputPath, 'utf8'));

  // Replace Israel's geometry with the dissolved result (already simplified by shapely)
  const israelFeature = features.find(f => f.properties.id === 'il');
  if (israelFeature) israelFeature.geometry = dissolved;

  unlinkSync(dissolveInputPath);
  unlinkSync(dissolveOutputPath);
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
