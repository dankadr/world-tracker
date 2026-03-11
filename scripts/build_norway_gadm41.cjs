#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const gadmPath = path.join(__dirname, 'gadm41_NOR_1.json');
const currentPath = path.join(__dirname, '../src/data/norway.json');
const outputPath = path.join(__dirname, '../src/data/norway.json');

const gadm = JSON.parse(fs.readFileSync(gadmPath, 'utf8'));
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

// GADM 4.1 uses old pre-2024 Norwegian county structure.
// Map GADM HASC_1 codes → target 2024 county ID.
// When multiple old counties merge into one, we collect all polygons into a MultiPolygon.
const hascToId = {
  'NO.AK': '32',  // Akershus
  'NO.OF': '31',  // Østfold
  'NO.BU': '33',  // Buskerud
  'NO.VF': '39',  // Vestfold
  'NO.TE': '40',  // Telemark
  'NO.AA': '42',  // Aust-Agder  → Agder (merged)
  'NO.VA': '42',  // Vest-Agder  → Agder (merged)
  'NO.RO': '11',  // Rogaland
  'NO.HO': '46',  // Hordaland   → Vestland (merged)
  'NO.SF': '46',  // Sogn og Fjordane → Vestland (merged)
  'NO.MR': '15',  // Møre og Romsdal
  'NO.ST': '50',  // Sør-Trøndelag → Trøndelag (merged)
  'NO.NT': '50',  // Nord-Trøndelag → Trøndelag (merged)
  'NO.NO': '18',  // Nordland
  'NO.TR': '55',  // Troms
  'NO.FI': '56',  // Finnmark
  'NO.HE': '34',  // Hedmark  → Innlandet (merged)
  'NO.OP': '34',  // Oppland  → Innlandet (merged)
  'NO.OS': '03',  // Oslo
};

const idToName = {
  '21': 'Svalbard',
  '31': 'Østfold',
  '32': 'Akershus',
  '33': 'Buskerud',
  '34': 'Innlandet',
  '39': 'Vestfold',
  '40': 'Telemark',
  '42': 'Agder',
  '46': 'Vestland',
  '50': 'Trøndelag',
  '55': 'Troms',
  '56': 'Finnmark',
  '03': 'Oslo',
  '11': 'Rogaland',
  '15': 'Møre og Romsdal',
  '18': 'Nordland',
};

// Helper: extract all polygon rings from a geometry (Polygon or MultiPolygon)
function extractPolygons(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates];
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates;
  }
  return [];
}

// Collect polygons per target ID
const polygonsByTargetId = {};

console.log('\nGADM features and mapping:');
gadm.features.forEach(f => {
  const hasc = f.properties.HASC_1;
  const name = f.properties.NAME_1;
  const targetId = hascToId[hasc];

  if (!targetId) {
    console.log(`  UNMAPPED: HASC=${hasc} NAME=${name}`);
    return;
  }

  console.log(`  HASC=${hasc} NAME=${name} → ID=${targetId} (${idToName[targetId]})`);

  if (!polygonsByTargetId[targetId]) {
    polygonsByTargetId[targetId] = [];
  }
  const polys = extractPolygons(f.geometry);
  polygonsByTargetId[targetId].push(...polys);
});

// Get Svalbard from current norway.json
const svalbardFeature = current.features.find(f => f.properties.id === '21');
if (!svalbardFeature) {
  console.error('ERROR: Svalbard not found in current norway.json!');
  process.exit(1);
}
console.log('\n  Svalbard (21): kept from existing norway.json');

// Build output features
const expectedIds = Object.keys(idToName);
const outputFeatures = [];

console.log('\nID mapping table (GADM → output):');
for (const id of expectedIds.sort()) {
  if (id === '21') {
    // Use existing Svalbard
    outputFeatures.push({
      type: 'Feature',
      properties: { id: '21', name: 'Svalbard' },
      geometry: svalbardFeature.geometry,
    });
    console.log(`  ID=21 | Svalbard | source: existing norway.json`);
    continue;
  }

  const polys = polygonsByTargetId[id];
  if (!polys || polys.length === 0) {
    console.error(`ERROR: No geometry found for ID=${id} (${idToName[id]})`);
    process.exit(1);
  }

  let geometry;
  if (polys.length === 1) {
    geometry = { type: 'Polygon', coordinates: polys[0] };
  } else {
    geometry = { type: 'MultiPolygon', coordinates: polys };
  }

  outputFeatures.push({
    type: 'Feature',
    properties: { id, name: idToName[id] },
    geometry,
  });

  console.log(`  ID=${id} | ${idToName[id]} | ${polys.length} polygon part(s) from GADM`);
}

const output = {
  type: 'FeatureCollection',
  features: outputFeatures,
};

fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');

console.log('\nWrote', outputPath);
console.log('Total features:', outputFeatures.length);

// Stats
const avgGeomChars = Math.round(
  outputFeatures.reduce((s, f) => s + JSON.stringify(f.geometry).length, 0) / outputFeatures.length
);
const totalKB = Math.round(JSON.stringify(output).length / 1024);
console.log(`avg geom chars: ${avgGeomChars} | total KB: ${totalKB}`);
