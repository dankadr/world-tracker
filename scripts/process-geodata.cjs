#!/usr/bin/env node
// scripts/process-geodata.cjs
// Usage: node scripts/process-geodata.cjs <country-key>
// Reads scripts/ne_10m_admin_1_states_provinces.geojson and outputs src/data/<key>.json

const fs = require('fs');
const path = require('path');

// Country configs: filter selects features, idFn produces the region ID, nameFn produces display name
const CONFIGS = {
  usa: {
    filter: f => f.properties.adm0_a3 === 'USA',
    idFn: p => (p.iso_3166_2 || '').replace('US-', ''),
    nameFn: p => p.name,
    out: 'usa.json',
  },
  no: {
    filter: f => f.properties.adm0_a3 === 'NOR' && (f.properties.iso_3166_2 || '') !== 'NO-X01~',
    idFn: p => (p.iso_3166_2 || '').replace('NO-', ''),
    nameFn: p => p.name_en || p.name,
    out: 'norway.json',
  },
  fr: {
    // Metropolitan France only (exclude overseas territories) — aggregate departments into 13 regions
    // Exclude overseas by region_cod prefix (FR-GUF=Guyane, FR-MTQ=Martinique, FR-GUA=Guadeloupe, FR-LRE=Réunion, FR-MAY=Mayotte)
    filter: f => f.properties.adm0_a3 === 'FRA' && !['FR-GUF','FR-MTQ','FR-GUA','FR-LRE','FR-MAY'].includes(f.properties.region_cod),
    groupBy: p => p.region,
    groupIdFn: p => (p.region_cod || '').replace('FR-', '').trim(),
    groupNameFn: p => p.region,
    out: 'france.json',
  },
  de: {
    filter: f => f.properties.adm0_a3 === 'DEU',
    idFn: p => (p.iso_3166_2 || '').replace('DE-', ''),
    nameFn: p => p.name_en || p.name,
    out: 'germany.json',
  },
  it: {
    // Aggregate provinces into 20 regions, use region_cod for ID (e.g. IT-23 -> 23)
    filter: f => f.properties.adm0_a3 === 'ITA',
    groupBy: p => p.region,
    groupIdFn: p => (p.region_cod || '').replace('IT-', ''),
    groupNameFn: p => p.region,
    out: 'italy.json',
  },
  es: {
    // Aggregate provinces into 17 autonomous communities + Ceuta + Melilla (19 total)
    // Ceuta region_cod and Melilla region_cod are both ES.CE, so use code_hasc for those two
    filter: f => f.properties.adm0_a3 === 'ESP',
    groupBy: p => p.region,
    groupIdFn: p => p.region === 'Melilla'
      ? (p.code_hasc || '').replace('ES.', '')
      : (p.region_cod || '').replace('ES.', ''),
    groupNameFn: p => p.region,
    out: 'spain.json',
  },
  mx: {
    // Exclude null/placeholder features (iso_3166_2 ending in ~)
    filter: f => f.properties.adm0_a3 === 'MEX' && !(f.properties.iso_3166_2 || '').endsWith('~'),
    idFn: p => (p.iso_3166_2 || '').replace('MX-', ''),
    nameFn: p => p.name_en || p.name,
    out: 'mexico.json',
  },
  en: {
    // England — group districts by the 9 official English regions
    filter: f => f.properties.adm0_a3 === 'GBR' && ['North East','North West','Yorkshire and the Humber','East Midlands','West Midlands','East','Greater London','South East','South West'].includes(f.properties.region),
    groupBy: p => p.region,
    groupIdFn: p => p.region.replace(/ /g, '-').replace(/[^A-Za-z0-9-]/g, ''),
    groupNameFn: p => p.region,
    out: 'england.json',
  },
  gb: {
    // UK — group districts into 4 constituent countries
    filter: f => f.properties.adm0_a3 === 'GBR',
    groupBy: p => {
      const eng = ['North East','North West','Yorkshire and the Humber','East Midlands','West Midlands','East','Greater London','South East','South West'];
      const scot = ['Eastern','South Western','Highlands and Islands','North Eastern'];
      const wales = ['West Wales and the Valleys','East Wales'];
      if (eng.includes(p.region)) return 'England';
      if (scot.includes(p.region)) return 'Scotland';
      if (wales.includes(p.region)) return 'Wales';
      if (p.region === 'Northern Ireland') return 'Northern Ireland';
      return null;
    },
    groupIdFn: p => {
      const eng = ['North East','North West','Yorkshire and the Humber','East Midlands','West Midlands','East','Greater London','South East','South West'];
      const scot = ['Eastern','South Western','Highlands and Islands','North Eastern'];
      const wales = ['West Wales and the Valleys','East Wales'];
      if (eng.includes(p.region)) return 'ENG';
      if (scot.includes(p.region)) return 'SCT';
      if (wales.includes(p.region)) return 'WLS';
      if (p.region === 'Northern Ireland') return 'NIR';
      return '';
    },
    groupNameFn: p => {
      const eng = ['North East','North West','Yorkshire and the Humber','East Midlands','West Midlands','East','Greater London','South East','South West'];
      const scot = ['Eastern','South Western','Highlands and Islands','North Eastern'];
      const wales = ['West Wales and the Valleys','East Wales'];
      if (eng.includes(p.region)) return 'England';
      if (scot.includes(p.region)) return 'Scotland';
      if (wales.includes(p.region)) return 'Wales';
      if (p.region === 'Northern Ireland') return 'Northern Ireland';
      return '';
    },
    out: 'uk.json',
  },
  in: {
    filter: f => f.properties.adm0_a3 === 'IND',
    idFn: p => (p.iso_3166_2 || '').replace('IN-', ''),
    nameFn: p => p.name_en || p.name,
    out: 'india.json',
  },
  nz: {
    // Only mainland regions: North Island and South Island (16 regional councils + unitary authorities)
    filter: f => f.properties.adm0_a3 === 'NZL' && ['North Island','South Island'].includes(f.properties.region),
    idFn: p => (p.iso_3166_2 || '').replace('NZ-', ''),
    nameFn: p => p.name_en || p.name,
    out: 'new-zealand.json',
  },
};

const key = process.argv[2];
if (!key || !CONFIGS[key]) {
  console.error(`Usage: node scripts/process-geodata.cjs <key>`);
  console.error(`Keys: ${Object.keys(CONFIGS).join(', ')}`);
  process.exit(1);
}

const config = CONFIGS[key];
const srcPath = path.join(__dirname, 'ne_10m_admin_1_states_provinces.geojson');
const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'));

// Helper: collect all polygon ring arrays from a geometry (Polygon or MultiPolygon)
function collectPolygons(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

let features;
if (config.groupBy) {
  // Aggregate sub-features into region-level MultiPolygon features
  const filtered = raw.features.filter(config.filter);
  const groups = new Map();
  for (const f of filtered) {
    const groupKey = config.groupBy(f.properties);
    if (!groupKey) continue;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: config.groupIdFn(f.properties),
        name: config.groupNameFn(f.properties),
        polys: [],
      });
    }
    groups.get(groupKey).polys.push(...collectPolygons(f.geometry));
  }
  features = Array.from(groups.values())
    .filter(g => g.id)
    .map(g => ({
      type: 'Feature',
      properties: { id: g.id, name: g.name },
      geometry: g.polys.length === 1
        ? { type: 'Polygon', coordinates: g.polys[0] }
        : { type: 'MultiPolygon', coordinates: g.polys },
    }));
} else {
  features = raw.features
    .filter(config.filter)
    .map(f => ({
      type: 'Feature',
      properties: {
        id: config.idFn(f.properties),
        name: config.nameFn(f.properties),
      },
      geometry: f.geometry,
    }))
    .filter(f => f.properties.id); // drop any with empty ID
}

const output = { type: 'FeatureCollection', features };
const outPath = path.join(__dirname, '..', 'src', 'data', config.out);
fs.writeFileSync(outPath, JSON.stringify(output));

const sizeKB = Math.round(JSON.stringify(output).length / 1024);
const avgKB = Math.round(sizeKB / features.length);
console.log(`✓ ${key}: ${features.length} features, ${sizeKB}KB total, ~${avgKB}KB avg`);
features.forEach(f => console.log(`  ${f.properties.id}: ${f.properties.name}`));
