#!/usr/bin/env node
'use strict';

const fs = require('fs');

const norwayPath = '/Users/dankadr/swiss-tracker/src/data/norway.json';
const sjm1Path = '/Users/dankadr/swiss-tracker/scripts/gadm41_SJM_1.json';

const norway = JSON.parse(fs.readFileSync(norwayPath, 'utf8'));
const sjm1 = JSON.parse(fs.readFileSync(sjm1Path, 'utf8'));

// Find Svalbard feature in GADM SJM level 1 (NAME_1 === 'Svalbard')
const svalbardGadm = sjm1.features.find(f => f.properties.NAME_1 === 'Svalbard');
if (!svalbardGadm) {
  console.error('ERROR: Svalbard feature not found in GADM SJM_1');
  process.exit(1);
}

// Find and update Svalbard in norway.json (id === '21')
const svalbardFeature = norway.features.find(f => f.properties.id === '21');
if (!svalbardFeature) {
  console.error('ERROR: Feature with id "21" not found in norway.json');
  process.exit(1);
}

const oldChars = JSON.stringify(svalbardFeature.geometry).length;
svalbardFeature.geometry = svalbardGadm.geometry;
const newChars = JSON.stringify(svalbardFeature.geometry).length;

fs.writeFileSync(norwayPath, JSON.stringify(norway), 'utf8');

console.log('Done.');
console.log('Old Svalbard geom chars:', oldChars);
console.log('New Svalbard geom chars:', newChars);
console.log('Total norway features:', norway.features.length);
console.log('Total file KB:', Math.round(JSON.stringify(norway).length / 1024));
