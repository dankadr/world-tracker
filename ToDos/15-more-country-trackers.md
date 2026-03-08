# ToDo: More Country Sub-Trackers

**Date:** 2026-03-06
**Status:** Not Started
**Priority:** Medium
**Scope:** Add sub-region trackers for more countries, following the exact same pattern as the existing trackers (CH, US, NO, CA, JP, AU, PH, BR)

---

## Overview

The app already supports sub-region tracking for Switzerland, USA, Norway, Canada, Japan, Australia, Philippines, and Brazil via `src/config/countries.json` and the corresponding GeoJSON files. This plan extends that to cover major popular destinations: England (UK regions), France, Germany, Italy, Spain, India, China, Mexico, New Zealand, and Argentina.

Each new tracker requires:
1. A GeoJSON file in `src/data/`
2. An entry in `src/config/countries.json`
3. A new import in `src/data/countries.js`
4. Adding the country's ISO code to `TRACKED_COUNTRY_IDS` in `WorldMap.jsx`
5. Adding the tracker to the backend's valid tracker list

---

## Countries to Add

### 1. England / United Kingdom 🏴󠁧󠁢󠁥󠁮󠁧󠁿
- **Regions:** England's 9 ceremonial regions (North East, North West, Yorkshire, East Midlands, West Midlands, East of England, London, South East, South West)
- **GeoJSON source:** Natural Earth admin-1 filtered for GB-ENG, or ONS Boundary Data
- **Tracker ID:** `gb-eng`
- **World map ISO:** `gb` (click on UK → explore England)
- **Region label:** "Regions"
- **Color:** `#c0392b` (deep red, St George's Cross)
- **Achievements:** "Visit London", "Complete the North", "All 9 Regions"
- **Notes:** Could expand later to Scotland (council areas), Wales, and Northern Ireland as separate trackers

### 2. France 🇫🇷
- **Regions:** 13 metropolitan regions (Île-de-France, Auvergne-Rhône-Alpes, Bourgogne-Franche-Comté, Brittany, Centre-Val de Loire, Grand Est, Hauts-de-France, Normandy, Nouvelle-Aquitaine, Occitanie, Pays de la Loire, Provence-Alpes-Côte d'Azur, Corsica)
- **GeoJSON source:** Natural Earth admin-1 filtered for FR, or French government open data (geo.data.gouv.fr)
- **Tracker ID:** `fr`
- **World map ISO:** `fr`
- **Region label:** "Regions"
- **Color:** `#2980b9` (French blue)
- **Achievements:** "Visit Paris (Île-de-France)", "Complete the Mediterranean Coast", "All 13 Regions"
- **Notes:** Departments (101) could be a stretch goal for a more detailed tracker

### 3. Germany 🇩🇪
- **Regions:** 16 Bundesländer (Bavaria, NRW, Baden-Württemberg, Lower Saxony, Hesse, Saxony, Rhineland-Palatinate, Berlin, Brandenburg, Thuringia, Saxony-Anhalt, Hamburg, Mecklenburg-Vorpommern, Saarland, Bremen, Schleswig-Holstein)
- **GeoJSON source:** Natural Earth admin-1 filtered for DE
- **Tracker ID:** `de`
- **World map ISO:** `de`
- **Region label:** "States (Bundesländer)"
- **Color:** `#f39c12` (German gold)
- **Achievements:** "Visit Berlin", "Complete the South (BY + BW)", "All 16 States"

### 4. Italy 🇮🇹
- **Regions:** 20 regions (Lombardy, Lazio, Campania, Sicily, Veneto, Emilia-Romagna, Piedmont, Puglia, Tuscany, Calabria, Sardinia, Liguria, Marche, Abruzzo, Friuli-Venezia Giulia, Trentino-Alto Adige, Umbria, Basilicata, Molise, Aosta Valley)
- **GeoJSON source:** Natural Earth admin-1 filtered for IT
- **Tracker ID:** `it`
- **World map ISO:** `it`
- **Region label:** "Regions"
- **Color:** `#27ae60` (Italian green)
- **Achievements:** "Visit Rome (Lazio)", "Complete the South (Mezzogiorno)", "All 20 Regions"

### 5. Spain 🇪🇸
- **Regions:** 17 autonomous communities (Andalusia, Catalonia, Madrid, Valencia, Galicia, Castile-La Mancha, Castile and León, Basque Country, Canary Islands, Murcia, Aragon, Extremadura, Asturias, Navarre, Cantabria, La Rioja, Balearic Islands)
- **GeoJSON source:** Natural Earth admin-1 filtered for ES
- **Tracker ID:** `es`
- **World map ISO:** `es`
- **Region label:** "Autonomous Communities"
- **Color:** `#e74c3c` (Spanish red)
- **Achievements:** "Visit Madrid", "Complete the Islands (Canary + Balearic)", "All 17 Communities"

### 6. India 🇮🇳
- **Regions:** 28 states + 8 union territories
- **GeoJSON source:** Natural Earth admin-1 filtered for IN
- **Tracker ID:** `in`
- **World map ISO:** `in`
- **Region label:** "States & Territories"
- **Color:** `#e67e22` (saffron orange)
- **Achievements:** "Visit Delhi", "Complete South India", "All 36 States & Territories"

### 7. China 🇨🇳
- **Regions:** 23 provinces + 5 autonomous regions + 4 municipalities + 2 SARs = 34 divisions
- **GeoJSON source:** Natural Earth admin-1 filtered for CN
- **Tracker ID:** `cn`
- **World map ISO:** `cn`
- **Region label:** "Provinces & Regions"
- **Color:** `#e74c3c` (Chinese red)
- **Achievements:** "Visit Beijing", "Visit Shanghai", "Complete the West", "All 34 Divisions"

### 8. Mexico 🇲🇽
- **Regions:** 31 states + Mexico City (CDMX)
- **GeoJSON source:** Natural Earth admin-1 filtered for MX
- **Tracker ID:** `mx`
- **World map ISO:** `mx`
- **Region label:** "States"
- **Color:** `#27ae60` (Mexican green)
- **Achievements:** "Visit CDMX", "Complete the Yucatán Peninsula", "All 32 States"

### 9. New Zealand 🇳🇿
- **Regions:** 16 regions (Auckland, Wellington, Canterbury, Waikato, Bay of Plenty, Manawatu-Whanganui, Hawke's Bay, Northland, Otago, Taranaki, Nelson/Marlborough, Southland, Gisborne, West Coast, Tasman, Chatham Islands)
- **GeoJSON source:** Statistics NZ or Natural Earth admin-1 filtered for NZ
- **Tracker ID:** `nz`
- **World map ISO:** `nz`
- **Region label:** "Regions"
- **Color:** `#2c3e50` (NZ dark blue)
- **Achievements:** "Visit Auckland", "Complete South Island", "All 16 Regions"

### 10. Argentina 🇦🇷
- **Regions:** 23 provinces + Buenos Aires CABA
- **GeoJSON source:** Natural Earth admin-1 filtered for AR
- **Tracker ID:** `ar`
- **World map ISO:** `ar`
- **Region label:** "Provinces"
- **Color:** `#74b9ff` (Argentine sky blue)
- **Achievements:** "Visit Buenos Aires", "Complete Patagonia", "All 24 Provinces"

---

## Implementation Pattern (per country)

All new trackers follow the same 5-step pattern already used by the existing ones:

### Step 1 — GeoJSON
- Download from Natural Earth admin-1 boundaries (free, public domain)
- Filter to the target country using `scripts/generate_geojson.py` or mapshaper.org
- Simplify geometry to keep file under ~300KB
- Ensure each feature has `properties.id` (ISO sub-code) and `properties.name` (English)
- Save to `src/data/<tracker-id>.json`

### Step 2 — `src/config/countries.json`
Add an entry:
```json
{
  "id": "fr",
  "name": "France",
  "flag": "🇫🇷",
  "regionLabel": "Regions",
  "regionLabelSingular": "region",
  "geoFile": "france.json",
  "center": [46.5, 2.5],
  "zoom": 5,
  "minZoom": 2,
  "maxZoom": 18,
  "visitedColor": "#2980b9",
  "visitedHover": "#1f6391"
}
```

### Step 3 — `src/data/countries.js`
```js
import franceData from './france.json';
// add to geoMap:
'france.json': franceData,
```

### Step 4 — `src/components/WorldMap.jsx`
```js
const TRACKED_COUNTRY_IDS = {
  // existing...
  fr: 'fr',
  de: 'de',
  it: 'it',
  es: 'es',
  // etc.
};
```

### Step 5 — `backend/main.py`
Add new tracker IDs to `VALID_TRACKERS` (or equivalent list).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/config/countries.json` | Add 10 new tracker entries |
| `src/data/countries.js` | Import 10 new GeoJSON files |
| `src/components/WorldMap.jsx` | Add 10 new entries to `TRACKED_COUNTRY_IDS` |
| `backend/main.py` | Register new tracker IDs |
| `scripts/generate_geojson.py` | Use/extend to filter and prep new GeoJSON files |

## Files to Create

| File | Contents |
|------|----------|
| `src/data/england.json` | GeoJSON — 9 English regions |
| `src/data/france.json` | GeoJSON — 13 French regions |
| `src/data/germany.json` | GeoJSON — 16 Bundesländer |
| `src/data/italy.json` | GeoJSON — 20 regions |
| `src/data/spain.json` | GeoJSON — 17 autonomous communities |
| `src/data/india.json` | GeoJSON — 36 states & territories |
| `src/data/china.json` | GeoJSON — 34 divisions |
| `src/data/mexico.json` | GeoJSON — 32 states |
| `src/data/new-zealand.json` | GeoJSON — 16 regions |
| `src/data/argentina.json` | GeoJSON — 24 provinces |

---

## GeoJSON Data Sources

| Country | Source |
|---------|--------|
| All | [Natural Earth admin-1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/) — free, public domain |
| France | [geo.data.gouv.fr](https://geo.data.gouv.fr) — official French government open data |
| England/UK | [ONS Boundary Data](https://geoportal.statistics.gov.uk) — official UK stats office |
| New Zealand | [Stats NZ](https://www.stats.govt.nz/tools/map-maker) |
| Germany | [BKG](https://www.bkg.bund.de) or Natural Earth |

Process all files through mapshaper.org to simplify and reduce file size before adding to the repo.

---

## Testing Checklist (per new tracker)
- [ ] GeoJSON renders correctly (no gaps, correct boundaries)
- [ ] Click to mark / unmark region works
- [ ] Region names display correctly in tooltip and sidebar
- [ ] Achievements unlock correctly
- [ ] Progress bar and stats update correctly
- [ ] Guest mode (localStorage) works
- [ ] Authenticated mode (API) works
- [ ] Friends overlay renders on new maps
- [ ] Sidebar "Region Trackers" card shows correct progress
- [ ] Dark mode colors look good
- [ ] Mobile pinch-to-zoom works

---

## Estimated Effort
- GeoJSON prep per country (download, filter, simplify): ~30–60 min each
- Config + code wiring per country: ~20 min each
- Testing per country: ~30 min each
- **Per country total: ~1.5–2 hours**
- **All 10 countries: ~15–20 hours**
