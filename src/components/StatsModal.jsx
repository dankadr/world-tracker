import { createPortal } from 'react-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAvailableYears } from '../utils/yearStats';
import YearInReview from './YearInReview';
import UnescoStatsCard from './UnescoStatsCard';
import { countryList } from '../data/countries';
import continentMap from '../config/continents.json';
import worldData from '../data/world.json';
import countryMeta from '../config/countryMeta.json';
import capitalsData from '../data/capitals.json';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
import { useFriendsData } from '../hooks/useFriendsData';
import { useFriends } from '../context/FriendsContext';

const INHABITED_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const TOTAL_WORLD_COUNTRIES = worldData.features.length;

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedIds(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.keys(data);
    }
  } catch { /* ignore */ }
  return [];
}

function getAllDates(userId) {
  const timeline = [];
  for (const c of countryList) {
    try {
      const raw = localStorage.getItem(storagePrefix(userId) + 'dates-' + c.id);
      if (raw) {
        const dates = JSON.parse(raw);
        for (const [regionId, dateStr] of Object.entries(dates)) {
          if (dateStr) timeline.push({ country: c.name, flag: c.flag, regionId, date: dateStr });
        }
      }
    } catch { /* ignore */ }
  }
  return timeline.sort((a, b) => b.date.localeCompare(a.date));
}

// Compute centroid of a geometry
function centroid(geom) {
  let coords;
  if (geom.type === 'Point') return [geom.coordinates[0], geom.coordinates[1]];
  if (geom.type === 'Polygon') coords = geom.coordinates[0];
  else if (geom.type === 'MultiPolygon') coords = geom.coordinates[0][0];
  else return null;
  let sx = 0, sy = 0;
  coords.forEach(([x, y]) => { sx += x; sy += y; });
  return [sx / coords.length, sy / coords.length];
}

// Get all visited region centroids across all countries
function getVisitedCoords(userId) {
  const points = [];
  for (const c of countryList) {
    const visitedIds = new Set(getVisitedIds(c.id, userId));
    if (visitedIds.size === 0) continue;
    for (const f of c.data.features) {
      if (f.properties.isBorough) continue;
      if (visitedIds.has(f.properties.id)) {
        const pt = centroid(f.geometry);
        if (pt) points.push({ lng: pt[0], lat: pt[1], name: f.properties.name, country: c.name, flag: c.flag });
      }
    }
  }
  return points;
}

function computeGeoInsights(coords) {
  if (coords.length === 0) return null;

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);

  const northernmost = coords.reduce((a, b) => (a.lat > b.lat ? a : b));
  const southernmost = coords.reduce((a, b) => (a.lat < b.lat ? a : b));
  const easternmost = coords.reduce((a, b) => (a.lng > b.lng ? a : b));
  const westernmost = coords.reduce((a, b) => (a.lng < b.lng ? a : b));

  const latRange = Math.max(...lats) - Math.min(...lats);
  let lngRange = Math.max(...lngs) - Math.min(...lngs);
  // Handle International Date Line crossing: take the shorter path around the globe
  if (lngRange > 180) lngRange = 360 - lngRange;

  // Approximate distance (Haversine) between northernmost and southernmost
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(northernmost.lat - southernmost.lat);
  const dLng = toRad(northernmost.lng - southernmost.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(southernmost.lat)) * Math.cos(toRad(northernmost.lat)) * Math.sin(dLng / 2) ** 2;
  const nsDistance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Average latitude
  const avgLat = lats.reduce((s, l) => s + l, 0) / lats.length;

  // Fun latitude facts
  const latFacts = [];
  if (Math.max(...lats) >= 78) latFacts.push('You\'ve been above the 78th parallel - Arctic territory!');
  else if (Math.max(...lats) >= 70) latFacts.push('You\'ve crossed the 70th parallel - deep into the Arctic!');
  else if (Math.max(...lats) >= 66.5) latFacts.push('You\'ve been above the Arctic Circle (66.5\u00b0N)!');
  else if (Math.max(...lats) >= 60) latFacts.push('You\'ve been above the 60th parallel - subarctic zone!');

  if (Math.min(...lats) <= 25) latFacts.push('You\'ve been below the 25th parallel - tropical zone!');
  if (Math.min(...lats) < 0) latFacts.push('You\'ve crossed the equator into the Southern Hemisphere!');

  if (lngRange > 100) latFacts.push(`Your visits span ${Math.round(lngRange)}\u00b0 of longitude!`);
  if (latRange > 30) latFacts.push(`Your visits span ${Math.round(latRange)}\u00b0 of latitude!`);
  if (nsDistance > 5000) latFacts.push(`${Math.round(nsDistance).toLocaleString()} km between your northernmost and southernmost visits!`);

  // Hemisphere stats
  const inNorth = coords.filter((c) => c.lat > 0).length;
  const inSouth = coords.filter((c) => c.lat < 0).length;
  const inWest = coords.filter((c) => c.lng < 0).length;
  const inEast = coords.filter((c) => c.lng > 0).length;

  return {
    northernmost,
    southernmost,
    easternmost,
    westernmost,
    latRange: Math.round(latRange * 10) / 10,
    lngRange: Math.round(lngRange * 10) / 10,
    nsDistance: Math.round(nsDistance),
    avgLat: Math.round(avgLat * 10) / 10,
    latFacts,
    inNorth,
    inSouth,
    inWest,
    inEast,
    totalPoints: coords.length,
  };
}

function getWorldVisitedIds(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    }
  } catch { /* ignore */ }
  return [];
}

function computeWorldStats(userId) {
  const visited = new Set(getWorldVisitedIds(userId));
  const visitedCount = visited.size;
  const pct = TOTAL_WORLD_COUNTRIES > 0 ? Math.round((visitedCount / TOTAL_WORLD_COUNTRIES) * 100) : 0;

  const continentBreakdown = {};
  INHABITED_CONTINENTS.forEach((c) => { continentBreakdown[c] = { total: 0, visited: 0 }; });

  worldData.features.forEach((f) => {
    const continent = continentMap[f.properties.id];
    if (continent && continentBreakdown[continent]) {
      continentBreakdown[continent].total++;
      if (visited.has(f.properties.id)) {
        continentBreakdown[continent].visited++;
      }
    }
  });

  const continentsWithVisits = Object.entries(continentBreakdown)
    .filter(([, s]) => s.visited > 0).length;

  const mostVisitedContinent = Object.entries(continentBreakdown)
    .sort(([, a], [, b]) => b.visited - a.visited)[0];

  return {
    visitedCount,
    total: TOTAL_WORLD_COUNTRIES,
    pct,
    continentBreakdown,
    continentsWithVisits,
    mostVisitedContinent: mostVisitedContinent?.[1].visited > 0 ? mostVisitedContinent[0] : null,
  };
}

const WORLD_LAND_AREA = 148940000; // km²
const WORLD_POPULATION = 8000000000;

function computeAreaPopStats(userId) {
  const visited = getWorldVisitedIds(userId);
  if (visited.length === 0) return null;

  let totalArea = 0;
  let totalPop = 0;
  let largest = null;
  let smallest = null;
  let mostPopulous = null;
  let leastPopulous = null;

  for (const code of visited) {
    const meta = countryMeta[code];
    if (!meta) continue;
    totalArea += meta.area;
    totalPop += meta.population;

    const name = worldData.features.find((f) => f.properties.id === code)?.properties.name || code;

    if (!largest || meta.area > largest.area) largest = { name, area: meta.area };
    if (!smallest || meta.area < smallest.area) smallest = { name, area: meta.area };
    if (!mostPopulous || meta.population > mostPopulous.pop) mostPopulous = { name, pop: meta.population };
    if (!leastPopulous || meta.population < leastPopulous.pop) leastPopulous = { name, pop: meta.population };
  }

  // Tag counts
  const tagCounts = {};
  for (const code of visited) {
    const meta = countryMeta[code];
    if (!meta || !meta.tags) continue;
    for (const tag of meta.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Tag totals (how many countries in the world have each tag)
  const tagTotals = {};
  for (const [, meta] of Object.entries(countryMeta)) {
    if (!meta.tags) continue;
    for (const tag of meta.tags) {
      tagTotals[tag] = (tagTotals[tag] || 0) + 1;
    }
  }

  return {
    totalArea,
    areaPct: Math.round((totalArea / WORLD_LAND_AREA) * 1000) / 10,
    totalPop,
    popPct: Math.round((totalPop / WORLD_POPULATION) * 1000) / 10,
    largest,
    smallest,
    mostPopulous,
    leastPopulous,
    tagCounts,
    tagTotals,
  };
}

function computeCapitalSuperlatives(userId) {
  const visitedCapIds = new Set(getVisitedIds('capitals', userId));
  if (visitedCapIds.size === 0) return null;

  const visitedCaps = capitalsData.features.filter((f) => visitedCapIds.has(f.properties.id));
  if (visitedCaps.length === 0) return null;

  let northernmost = null, southernmost = null, easternmost = null, westernmost = null;

  for (const f of visitedCaps) {
    const [lng, lat] = f.geometry.coordinates;
    const name = f.properties.name;
    if (!northernmost || lat > northernmost.lat) northernmost = { name, lat, lng };
    if (!southernmost || lat < southernmost.lat) southernmost = { name, lat, lng };
    if (!easternmost || lng > easternmost.lng) easternmost = { name, lat, lng };
    if (!westernmost || lng < westernmost.lng) westernmost = { name, lat, lng };
  }

  // Average lat/lng
  let sumLat = 0, sumLng = 0;
  for (const f of visitedCaps) {
    sumLat += f.geometry.coordinates[1];
    sumLng += f.geometry.coordinates[0];
  }

  // Farthest pair (only if > 1 capital)
  let farthestDist = 0;
  let farthestPair = null;
  if (visitedCaps.length > 1) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    for (let i = 0; i < visitedCaps.length; i++) {
      for (let j = i + 1; j < visitedCaps.length; j++) {
        const [lng1, lat1] = visitedCaps[i].geometry.coordinates;
        const [lng2, lat2] = visitedCaps[j].geometry.coordinates;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist > farthestDist) {
          farthestDist = dist;
          farthestPair = [visitedCaps[i].properties.name, visitedCaps[j].properties.name];
        }
      }
    }
  }

  return {
    count: visitedCaps.length,
    total: capitalsData.features.length,
    northernmost,
    southernmost,
    easternmost,
    westernmost,
    avgLat: Math.round((sumLat / visitedCaps.length) * 10) / 10,
    avgLng: Math.round((sumLng / visitedCaps.length) * 10) / 10,
    farthestDist: Math.round(farthestDist),
    farthestPair,
  };
}

export default function StatsModal({ onClose }) {
  const { user, isLoggedIn } = useAuth();
  const userId = user?.id || null;
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);
  const [yirYear, setYirYear] = useState(null);
  const availableYears = useMemo(() => getAvailableYears(userId), [userId]);

  const stats = countryList.map((c) => {
    const total = c.data.features.filter(f => !f.properties?.isBorough).length;
    const visited = getVisitedIds(c.id, userId).length;
    return { ...c, total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });

  const totalAll = stats.reduce((s, c) => s + c.total, 0);
  const visitedAll = stats.reduce((s, c) => s + c.visited, 0);
  const mostExplored = [...stats].sort((a, b) => b.pct - a.pct)[0];
  const timeline = getAllDates(userId).slice(0, 20);

  const coords = getVisitedCoords(userId);
  const geo = computeGeoInsights(coords);

  const worldStats = computeWorldStats(userId);
  const areaPopStats = computeAreaPopStats(userId);
  const capStats = computeCapitalSuperlatives(userId);

  if (yirYear) {
    return <YearInReview year={yirYear} onClose={() => setYirYear(null)} />;
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" ref={handleRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" {...dragHandlers}>
          <div className="drag-handle" />
          <h2>Your Travel Statistics</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {availableYears.length > 0 && (
          <div className="yir-button-row">
            <button
              className="yir-trigger-btn"
              onClick={() => setYirYear(availableYears[0])}
            >
              🎉 Year in Review
            </button>
            {availableYears.length > 1 && (
              <select
                className="yir-year-select"
                value={availableYears[0]}
                onChange={(e) => setYirYear(Number(e.target.value))}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="stats-section">
          <h3>Progress by Country</h3>
          <div className="stats-bars">
            {stats.map((s) => (
              <div key={s.id} className="stats-bar-row">
                <span className="stats-bar-label">{s.flag} {s.name}</span>
                <div className="stats-bar-track">
                  <div className="stats-bar-fill" style={{ width: `${s.pct}%`, background: s.visitedColor }} />
                </div>
                <span className="stats-bar-value">{s.visited}/{s.total} ({s.pct}%)</span>
              </div>
            ))}
          </div>

          <div className="stats-summary">
            <div className="stats-summary-item">
              <span className="stats-summary-num">{visitedAll}</span>
              <span className="stats-summary-label">Total visited</span>
            </div>
            <div className="stats-summary-item">
              <span className="stats-summary-num">{totalAll}</span>
              <span className="stats-summary-label">Total regions</span>
            </div>
            <div className="stats-summary-item">
              <span className="stats-summary-num">{totalAll > 0 ? Math.round((visitedAll / totalAll) * 100) : 0}%</span>
              <span className="stats-summary-label">Overall</span>
            </div>
          </div>

          {mostExplored && mostExplored.visited > 0 && (
            <p className="stats-highlight">
              Most explored: {mostExplored.flag} {mostExplored.name} at {mostExplored.pct}%
            </p>
          )}
        </div>

        {worldStats.visitedCount > 0 && (
          <div className="stats-section">
            <h3>World Countries</h3>
            <div className="stats-summary">
              <div className="stats-summary-item">
                <span className="stats-summary-num">{worldStats.visitedCount}</span>
                <span className="stats-summary-label">/ {worldStats.total} countries</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-num">{worldStats.continentsWithVisits}</span>
                <span className="stats-summary-label">/ 6 continents</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-num">{worldStats.pct}%</span>
                <span className="stats-summary-label">of the world</span>
              </div>
            </div>

            <div className="stats-bars" style={{ marginTop: '12px' }}>
              {Object.entries(worldStats.continentBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([continent, s]) => {
                  const cpct = s.total > 0 ? Math.round((s.visited / s.total) * 100) : 0;
                  return (
                    <div key={continent} className="stats-bar-row">
                      <span className="stats-bar-label">{continent}</span>
                      <div className="stats-bar-track">
                        <div className="stats-bar-fill" style={{ width: `${cpct}%`, background: '#d4b866' }} />
                      </div>
                      <span className="stats-bar-value">{s.visited}/{s.total}</span>
                    </div>
                  );
                })}
            </div>

            {worldStats.mostVisitedContinent && (
              <p className="stats-highlight">
                Most explored continent: {worldStats.mostVisitedContinent}
              </p>
            )}
          </div>
        )}

        {geo && geo.totalPoints >= 2 ? (
          <div className="stats-section">
            <h3>Geographic Insights</h3>
            <div className="geo-insights">
              <div className="geo-grid">
                <div className="geo-card">
                  <span className="geo-card-icon">&#8593;</span>
                  <span className="geo-card-label">Northernmost</span>
                  <span className="geo-card-value">{geo.northernmost.name}</span>
                  <span className="geo-card-sub">{geo.northernmost.flag} {geo.northernmost.lat.toFixed(1)}&deg;N</span>
                </div>
                <div className="geo-card">
                  <span className="geo-card-icon">&#8595;</span>
                  <span className="geo-card-label">Southernmost</span>
                  <span className="geo-card-value">{geo.southernmost.name}</span>
                  <span className="geo-card-sub">{geo.southernmost.flag} {Math.abs(geo.southernmost.lat).toFixed(1)}&deg;{geo.southernmost.lat >= 0 ? 'N' : 'S'}</span>
                </div>
                <div className="geo-card">
                  <span className="geo-card-icon">&#8592;</span>
                  <span className="geo-card-label">Westernmost</span>
                  <span className="geo-card-value">{geo.westernmost.name}</span>
                  <span className="geo-card-sub">{geo.westernmost.flag} {Math.abs(geo.westernmost.lng).toFixed(1)}&deg;{geo.westernmost.lng >= 0 ? 'E' : 'W'}</span>
                </div>
                <div className="geo-card">
                  <span className="geo-card-icon">&#8594;</span>
                  <span className="geo-card-label">Easternmost</span>
                  <span className="geo-card-value">{geo.easternmost.name}</span>
                  <span className="geo-card-sub">{geo.easternmost.flag} {Math.abs(geo.easternmost.lng).toFixed(1)}&deg;{geo.easternmost.lng >= 0 ? 'E' : 'W'}</span>
                </div>
              </div>

              <div className="geo-numbers">
                <div className="geo-number">
                  <span className="geo-num-val">{geo.latRange}&deg;</span>
                  <span className="geo-num-label">Latitude span</span>
                </div>
                <div className="geo-number">
                  <span className="geo-num-val">{geo.lngRange}&deg;</span>
                  <span className="geo-num-label">Longitude span</span>
                </div>
                <div className="geo-number">
                  <span className="geo-num-val">{geo.nsDistance.toLocaleString()} km</span>
                  <span className="geo-num-label">N-S distance</span>
                </div>
              </div>

              {geo.latFacts.length > 0 && (
                <div className="geo-facts">
                  {geo.latFacts.map((fact, i) => (
                    <p key={i} className="geo-fact">{fact}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : geo && geo.totalPoints === 1 ? (
          <div className="stats-section">
            <h3>Geographic Insights</h3>
            <p className="stats-highlight" style={{ textAlign: 'center', padding: '20px 0' }}>
              Visit more places to unlock detailed geographic insights!
            </p>
          </div>
        ) : null}

        {areaPopStats && (
          <div className="stats-section">
            <h3>Area & Population</h3>
            <div className="stats-summary">
              <div className="stats-summary-item">
                <span className="stats-summary-num">{areaPopStats.totalArea.toLocaleString()}</span>
                <span className="stats-summary-label">km² visited ({areaPopStats.areaPct}% of land)</span>
              </div>
              <div className="stats-summary-item">
                <span className="stats-summary-num">{(areaPopStats.totalPop / 1e6).toFixed(0)}M</span>
                <span className="stats-summary-label">people ({areaPopStats.popPct}% of world)</span>
              </div>
            </div>

            <div className="geo-grid" style={{ marginTop: '12px' }}>
              {areaPopStats.largest && (
                <div className="geo-card">
                  <span className="geo-card-icon">📐</span>
                  <span className="geo-card-label">Largest visited</span>
                  <span className="geo-card-value">{areaPopStats.largest.name}</span>
                  <span className="geo-card-sub">{areaPopStats.largest.area.toLocaleString()} km²</span>
                </div>
              )}
              {areaPopStats.smallest && (
                <div className="geo-card">
                  <span className="geo-card-icon">🔬</span>
                  <span className="geo-card-label">Smallest visited</span>
                  <span className="geo-card-value">{areaPopStats.smallest.name}</span>
                  <span className="geo-card-sub">{areaPopStats.smallest.area.toLocaleString()} km²</span>
                </div>
              )}
              {areaPopStats.mostPopulous && (
                <div className="geo-card">
                  <span className="geo-card-icon">👥</span>
                  <span className="geo-card-label">Most populous</span>
                  <span className="geo-card-value">{areaPopStats.mostPopulous.name}</span>
                  <span className="geo-card-sub">{(areaPopStats.mostPopulous.pop / 1e6).toFixed(1)}M people</span>
                </div>
              )}
              {areaPopStats.leastPopulous && (
                <div className="geo-card">
                  <span className="geo-card-icon">👤</span>
                  <span className="geo-card-label">Least populous</span>
                  <span className="geo-card-value">{areaPopStats.leastPopulous.name}</span>
                  <span className="geo-card-sub">{areaPopStats.leastPopulous.pop.toLocaleString()} people</span>
                </div>
              )}
            </div>

            {Object.keys(areaPopStats.tagCounts).length > 0 && (
              <div className="geo-facts" style={{ marginTop: '12px' }}>
                {areaPopStats.tagCounts.island && (
                  <p className="geo-fact">🏝️ {areaPopStats.tagCounts.island}/{areaPopStats.tagTotals.island} island nations visited</p>
                )}
                {areaPopStats.tagCounts.landlocked && (
                  <p className="geo-fact">🏜️ {areaPopStats.tagCounts.landlocked}/{areaPopStats.tagTotals.landlocked} landlocked countries visited</p>
                )}
                {areaPopStats.tagCounts.g7 && (
                  <p className="geo-fact">💼 {areaPopStats.tagCounts.g7}/7 G7 nations visited</p>
                )}
                {areaPopStats.tagCounts.g20 && (
                  <p className="geo-fact">🏦 {areaPopStats.tagCounts.g20}/20 G20 nations visited</p>
                )}
                {areaPopStats.tagCounts.nordic && (
                  <p className="geo-fact">❄️ {areaPopStats.tagCounts.nordic}/5 Nordic countries visited</p>
                )}
                {areaPopStats.tagCounts.microstate && (
                  <p className="geo-fact">🔬 {areaPopStats.tagCounts.microstate} microstate{areaPopStats.tagCounts.microstate > 1 ? 's' : ''} visited</p>
                )}
                {areaPopStats.tagCounts.equator && (
                  <p className="geo-fact">♨️ {areaPopStats.tagCounts.equator} equatorial countr{areaPopStats.tagCounts.equator > 1 ? 'ies' : 'y'} visited</p>
                )}
              </div>
            )}
          </div>
        )}

        {capStats && (
          <div className="stats-section">
            <h3>Capital Superlatives</h3>
            <p className="stats-highlight" style={{ marginBottom: '12px' }}>
              {capStats.count} / {capStats.total} world capitals visited
            </p>
            <div className="geo-grid">
              <div className="geo-card">
                <span className="geo-card-icon">&#8593;</span>
                <span className="geo-card-label">Northernmost capital</span>
                <span className="geo-card-value">{capStats.northernmost.name}</span>
                <span className="geo-card-sub">{Math.abs(capStats.northernmost.lat).toFixed(1)}&deg;{capStats.northernmost.lat >= 0 ? 'N' : 'S'}</span>
              </div>
              <div className="geo-card">
                <span className="geo-card-icon">&#8595;</span>
                <span className="geo-card-label">Southernmost capital</span>
                <span className="geo-card-value">{capStats.southernmost.name}</span>
                <span className="geo-card-sub">{Math.abs(capStats.southernmost.lat).toFixed(1)}&deg;{capStats.southernmost.lat >= 0 ? 'N' : 'S'}</span>
              </div>
              <div className="geo-card">
                <span className="geo-card-icon">&#8592;</span>
                <span className="geo-card-label">Westernmost capital</span>
                <span className="geo-card-value">{capStats.westernmost.name}</span>
                <span className="geo-card-sub">{Math.abs(capStats.westernmost.lng).toFixed(1)}&deg;{capStats.westernmost.lng >= 0 ? 'E' : 'W'}</span>
              </div>
              <div className="geo-card">
                <span className="geo-card-icon">&#8594;</span>
                <span className="geo-card-label">Easternmost capital</span>
                <span className="geo-card-value">{capStats.easternmost.name}</span>
                <span className="geo-card-sub">{Math.abs(capStats.easternmost.lng).toFixed(1)}&deg;{capStats.easternmost.lng >= 0 ? 'E' : 'W'}</span>
              </div>
            </div>

            <div className="geo-numbers" style={{ marginTop: '12px' }}>
              <div className="geo-number">
                <span className="geo-num-val">{capStats.avgLat}&deg;</span>
                <span className="geo-num-label">Avg latitude</span>
              </div>
              <div className="geo-number">
                <span className="geo-num-val">{capStats.avgLng}&deg;</span>
                <span className="geo-num-label">Avg longitude</span>
              </div>
              {capStats.farthestPair && (
                <div className="geo-number">
                  <span className="geo-num-val">{capStats.farthestDist.toLocaleString()} km</span>
                  <span className="geo-num-label">Farthest apart</span>
                </div>
              )}
            </div>

            {capStats.farthestPair && (
              <p className="stats-highlight" style={{ marginTop: '8px' }}>
                Farthest pair: {capStats.farthestPair[0]} ↔ {capStats.farthestPair[1]}
              </p>
            )}
          </div>
        )}

        <UnescoStatsCard />

        {timeline.length > 0 && (
          <div className="stats-section">
            <h3>Recent Visits</h3>
            <div className="timeline-list">
              {timeline.map((t, i) => (
                <div key={i} className="timeline-item">
                  <span className="timeline-date">{t.date}</span>
                  <span className="timeline-flag">{t.flag}</span>
                  <span className="timeline-region">{t.regionId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoggedIn && <FriendsCompare worldVisited={worldStats.visitedCount} />}
      </div>
    </div>,
    document.body
  );
}

function FriendsCompare({ worldVisited }) {
  const { friends } = useFriends();
  const { leaderboard, loadLeaderboard } = useFriendsData();

  useEffect(() => {
    if (friends.length > 0 && leaderboard.length === 0) {
      loadLeaderboard();
    }
  }, [friends.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (friends.length === 0 || leaderboard.length === 0) return null;

  const sorted = [...leaderboard].sort((a, b) => (b.world_countries || 0) - (a.world_countries || 0));
  const myRank = sorted.findIndex(e => e.is_self) + 1;

  return (
    <div className="stats-section">
      <h3>Compare with Friends</h3>
      {myRank > 0 && (
        <p className="stats-highlight" style={{ marginBottom: '10px' }}>
          You rank #{myRank} of {sorted.length} friends for world countries
        </p>
      )}
      <div className="stats-bars">
        {sorted.slice(0, 8).map((entry, i) => {
          const count = entry.world_countries || 0;
          const maxCount = sorted[0]?.world_countries || 1;
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div key={entry.user_id || i} className="stats-bar-row">
              <span className="stats-bar-label" style={entry.is_self ? { fontWeight: 700 } : {}}>
                {entry.is_self ? '⭐ You' : entry.name}
              </span>
              <div className="stats-bar-track">
                <div
                  className="stats-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: entry.is_self ? '#c9a84c' : '#d4b866',
                  }}
                />
              </div>
              <span className="stats-bar-value">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
