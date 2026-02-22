import { useState, useMemo } from 'react';
import unescoData from '../data/unesco-sites.json';
import useUnescoVisited from '../hooks/useUnescoVisited';
import { useTheme } from '../context/ThemeContext';
import './UnescoPanel.css';

// Get unique regions and countries for filters
const regions = [...new Set(unescoData.map(s => s.region))].sort();
const countries = [...new Set(unescoData.map(s => s.country))].sort();

export default function UnescoPanel({ onClose }) {
  const { visitedSites, toggleSite, isVisited } = useUnescoVisited();
  const { dark } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredSites = useMemo(() => {
    return unescoData.filter(site => {
      // Search filter
      if (searchTerm && !site.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Type filter
      if (typeFilter !== 'all' && site.type !== typeFilter) {
        return false;
      }
      // Region filter
      if (regionFilter !== 'all' && site.region !== regionFilter) {
        return false;
      }
      // Country filter
      if (countryFilter !== 'all' && site.country !== countryFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === 'visited' && !isVisited(site.id)) {
        return false;
      }
      if (statusFilter === 'unvisited' && isVisited(site.id)) {
        return false;
      }
      return true;
    });
  }, [searchTerm, typeFilter, regionFilter, countryFilter, statusFilter, visitedSites, isVisited]);

  const stats = useMemo(() => {
    const visited = Array.from(visitedSites).length;
    const total = unescoData.length;
    const percentage = total > 0 ? ((visited / total) * 100).toFixed(1) : 0;
    
    const byType = { cultural: 0, natural: 0, mixed: 0 };
    Array.from(visitedSites).forEach(idStr => {
      const site = unescoData.find(s => String(s.id) === idStr);
      if (site) byType[site.type]++;
    });

    return { visited, total, percentage, byType };
  }, [visitedSites]);

  const groupedSites = useMemo(() => {
    const grouped = {};
    filteredSites.forEach(site => {
      if (!grouped[site.country]) {
        grouped[site.country] = [];
      }
      grouped[site.country].push(site);
    });
    return grouped;
  }, [filteredSites]);

  return (
    <div className={`unesco-panel ${dark ? 'dark' : ''}`}>
      <div className="unesco-panel-header">
        <h2>🏛️ UNESCO World Heritage Sites</h2>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="unesco-stats">
        <div className="stat-main">
          <span className="stat-value">{stats.visited}</span>
          <span className="stat-total"> / {stats.total}</span>
          <span className="stat-label"> sites visited ({stats.percentage}%)</span>
        </div>
        <div className="stat-types">
          <span>🟤 Cultural: {stats.byType.cultural}</span>
          <span>🟢 Natural: {stats.byType.natural}</span>
          <span>🔵 Mixed: {stats.byType.mixed}</span>
        </div>
      </div>

      <div className="unesco-filters">
        <input
          type="text"
          placeholder="🔍 Search sites..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <div className="filter-row">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="cultural">Cultural</option>
            <option value="natural">Natural</option>
            <option value="mixed">Mixed</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="visited">Visited</option>
            <option value="unvisited">Not Yet Visited</option>
          </select>
        </div>

        <div className="filter-row">
          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="all">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="all">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="unesco-list">
        {filteredSites.length === 0 ? (
          <div className="no-results">No sites found matching your filters.</div>
        ) : (
          Object.entries(groupedSites).map(([country, sites]) => (
            <div key={country} className="country-group">
              <h3 className="country-header">
                {country} <span className="site-count">({sites.length})</span>
              </h3>
              {sites.map(site => (
                <div
                  key={site.id}
                  className={`site-item ${isVisited(site.id) ? 'visited' : ''}`}
                  onClick={() => toggleSite(site.id)}
                >
                  <div className="site-checkbox">
                    {isVisited(site.id) ? '✓' : ''}
                  </div>
                  <div className="site-info">
                    <div className="site-name">{site.name}</div>
                    <div className="site-meta">
                      <span className={`site-type type-${site.type}`}>
                        {site.type === 'cultural' ? '🟤' : site.type === 'natural' ? '🟢' : '🔵'} 
                        {site.type}
                      </span>
                      <span className="site-year">📅 {site.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
