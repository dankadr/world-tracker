import { countryList } from '../data/countries';

const STORAGE_PREFIX = 'swiss-tracker-visited-';
const DATES_PREFIX = 'swiss-tracker-dates-';

function getVisitedIds(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : Object.keys(data);
    }
  } catch { /* ignore */ }
  return [];
}

function getAllDates() {
  const timeline = [];
  for (const c of countryList) {
    try {
      const raw = localStorage.getItem(DATES_PREFIX + c.id);
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
function getVisitedCoords() {
  const points = [];
  for (const c of countryList) {
    const visitedIds = new Set(getVisitedIds(c.id));
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
  const lngRange = Math.max(...lngs) - Math.min(...lngs);

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
  const inSouth = coords.filter((c) => c.lat <= 0).length;
  const inWest = coords.filter((c) => c.lng < 0).length;
  const inEast = coords.filter((c) => c.lng >= 0).length;

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

export default function StatsModal({ onClose }) {
  const stats = countryList.map((c) => {
    const total = c.data.features.filter(f => !f.properties?.isBorough).length;
    const visited = getVisitedIds(c.id).length;
    return { ...c, total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });

  const totalAll = stats.reduce((s, c) => s + c.total, 0);
  const visitedAll = stats.reduce((s, c) => s + c.visited, 0);
  const mostExplored = [...stats].sort((a, b) => b.pct - a.pct)[0];
  const timeline = getAllDates().slice(0, 20);

  const coords = getVisitedCoords();
  const geo = computeGeoInsights(coords);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Your Travel Statistics</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

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

        {geo && (
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
        )}

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
      </div>
    </div>
  );
}
