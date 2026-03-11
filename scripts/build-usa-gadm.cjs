#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const gadmPath = path.join(__dirname, 'gadm41_USA_1.json');
const currentPath = path.join(__dirname, '../src/data/usa.json');
// Use the original file from git if it exists (to preserve proper name formatting)
const originalPath = '/tmp/usa_original.json';
const outputPath = currentPath;

const gadm = JSON.parse(fs.readFileSync(gadmPath, 'utf8'));
// Load original names from git backup if available, else current
const nameSource = fs.existsSync(originalPath)
  ? JSON.parse(fs.readFileSync(originalPath, 'utf8'))
  : JSON.parse(fs.readFileSync(currentPath, 'utf8'));
const current = nameSource;

// Build lookup of current features by ID
const currentById = {};
for (const f of current.features) {
  currentById[f.properties.id] = f;
}

const currentIds = new Set(Object.keys(currentById));
console.log('Current IDs (' + currentIds.size + '):', [...currentIds].sort().join(', '));

// Build GADM lookup by 2-letter code
const gadmByCode = {};
for (const f of gadm.features) {
  const hasc = f.properties.HASC_1; // e.g. "US.AL"
  const code = hasc.replace('US.', '');
  gadmByCode[code] = f;
}

console.log('\nGADM codes (' + Object.keys(gadmByCode).length + '):', Object.keys(gadmByCode).sort().join(', '));

// Build new features array
const newFeatures = [];
const matched = [];
const notInGadm = [];
const notInCurrent = [];

// Process all current IDs in sorted order
const sortedCurrentIds = [...currentIds].sort();
for (const id of sortedCurrentIds) {
  if (gadmByCode[id]) {
    const gadmFeature = gadmByCode[id];
    // Prefer the original name (which has proper spacing) over GADM NAME_1 (which strips spaces)
    const name = currentById[id].properties.name || gadmFeature.properties.NAME_1;
    const oldGeomChars = JSON.stringify(currentById[id].geometry).length;
    const newGeomChars = JSON.stringify(gadmFeature.geometry).length;
    console.log(`  ${id}: "${name}" | old geom: ${oldGeomChars} chars -> new geom: ${newGeomChars} chars (${newGeomChars > oldGeomChars ? '+' : ''}${newGeomChars - oldGeomChars})`);
    newFeatures.push({
      type: 'Feature',
      properties: { id, name },
      geometry: gadmFeature.geometry,
    });
    matched.push(id);
  } else {
    console.log(`  ${id}: NOT IN GADM — keeping existing geometry`);
    newFeatures.push(currentById[id]);
    notInGadm.push(id);
  }
}

// Check for GADM codes not in current IDs
for (const code of Object.keys(gadmByCode).sort()) {
  if (!currentIds.has(code)) {
    console.log(`  ${code}: IN GADM but NOT in current (skipping)`);
    notInCurrent.push(code);
  }
}

console.log('\n--- Summary ---');
console.log('Matched (upgraded to GADM):', matched.length, '->', matched.join(', '));
console.log('Kept from current (not in GADM):', notInGadm.length, notInGadm.length ? '-> ' + notInGadm.join(', ') : '');
console.log('In GADM but skipped (not in current):', notInCurrent.length, notInCurrent.length ? '-> ' + notInCurrent.join(', ') : '');

// Build output GeoJSON
const output = {
  type: 'FeatureCollection',
  features: newFeatures,
};

fs.writeFileSync(outputPath, JSON.stringify(output));
console.log('\nWritten to:', outputPath);
console.log('Features:', newFeatures.length);
const totalBytes = JSON.stringify(output).length;
console.log('Total KB:', Math.round(totalBytes / 1024));
const avgGeom = Math.round(newFeatures.reduce((s, f) => s + JSON.stringify(f.geometry).length, 0) / newFeatures.length);
console.log('Avg geom chars:', avgGeom, '(was 24,442)');
