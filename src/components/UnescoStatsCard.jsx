import { useMemo } from 'react';
import unescoData from '../data/unesco-sites.json';
import useUnescoVisited from '../hooks/useUnescoVisited';

export default function UnescoStatsCard() {
  const { visitedSites } = useUnescoVisited();

  const stats = useMemo(() => {
    const visited = Array.from(visitedSites).length;
    const total = unescoData.length;
    const percentage = total > 0 ? ((visited / total) * 100).toFixed(1) : 0;

    // Count by type
    const byType = { cultural: 0, natural: 0, mixed: 0 };
    Array.from(visitedSites).forEach(idStr => {
      const site = unescoData.find(s => String(s.id) === idStr);
      if (site) byType[site.type]++;
    });

    // Count by continent/region
    const byRegion = {};
    Array.from(visitedSites).forEach(idStr => {
      const site = unescoData.find(s => String(s.id) === idStr);
      if (site) {
        byRegion[site.region] = (byRegion[site.region] || 0) + 1;
      }
    });

    // Count unique countries visited
    const countriesVisited = new Set();
    Array.from(visitedSites).forEach(idStr => {
      const site = unescoData.find(s => String(s.id) === idStr);
      if (site) countriesVisited.add(site.country);
    });

    // Find oldest site visited
    let oldestSite = null;
    Array.from(visitedSites).forEach(idStr => {
      const site = unescoData.find(s => String(s.id) === idStr);
      if (site && (!oldestSite || site.year < oldestSite.year)) {
        oldestSite = site;
      }
    });

    return {
      visited,
      total,
      percentage,
      byType,
      byRegion,
      countriesCount: countriesVisited.size,
      oldestSite,
    };
  }, [visitedSites]);

  if (stats.visited === 0) {
    return null;
  }

  return (
    <div className="stats-card">
      <h3 className="stats-card-title">🏛️ UNESCO World Heritage Sites</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{stats.visited}</div>
          <div className="stat-label">Sites Visited</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.percentage}%</div>
          <div className="stat-label">of {stats.total} Total</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.countriesCount}</div>
          <div className="stat-label">Countries</div>
        </div>
      </div>

      <div className="stats-breakdown">
        <div className="breakdown-title">By Type:</div>
        <div className="breakdown-items">
          {stats.byType.cultural > 0 && (
            <div className="breakdown-item">
              <span className="breakdown-icon">🟤</span>
              <span className="breakdown-label">Cultural</span>
              <span className="breakdown-value">{stats.byType.cultural}</span>
            </div>
          )}
          {stats.byType.natural > 0 && (
            <div className="breakdown-item">
              <span className="breakdown-icon">🟢</span>
              <span className="breakdown-label">Natural</span>
              <span className="breakdown-value">{stats.byType.natural}</span>
            </div>
          )}
          {stats.byType.mixed > 0 && (
            <div className="breakdown-item">
              <span className="breakdown-icon">🔵</span>
              <span className="breakdown-label">Mixed</span>
              <span className="breakdown-value">{stats.byType.mixed}</span>
            </div>
          )}
        </div>
      </div>

      {Object.keys(stats.byRegion).length > 0 && (
        <div className="stats-breakdown">
          <div className="breakdown-title">By Region:</div>
          <div className="breakdown-items">
            {Object.entries(stats.byRegion)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([region, count]) => (
                <div key={region} className="breakdown-item">
                  <span className="breakdown-label">{region}</span>
                  <span className="breakdown-value">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {stats.oldestSite && (
        <div className="stats-highlight">
          <div className="highlight-label">Oldest Site Visited:</div>
          <div className="highlight-value">
            {stats.oldestSite.name} ({stats.oldestSite.year})
          </div>
        </div>
      )}
    </div>
  );
}
