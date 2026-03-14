import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { countryList } from '../data/countries';
import { secureStorage } from '../utils/secureStorage';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { withTouchFeedback } from '../utils/touchFeedback';
import './ExploreScreen.css';

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedCount(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.length;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length;
    }
  } catch {
    return 0;
  }
  return 0;
}

export default function ExploreScreen({
  worldVisited,
  onToggleWorld,
  onExploreCountry,
  country,
  visitedRegions,
  onToggleRegion,
  dates = {},
  onRefresh,
}) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [tab, setTab] = useState('countries');
  const [query, setQuery] = useState('');
  const [compactHeader, setCompactHeader] = useState(false);
  const { pullDistance, isRefreshing, bind } = usePullToRefresh(onRefresh, { enabled: true });

  const trackers = useMemo(() => {
    return countryList.map((entry) => {
      const total = entry.data.features.filter((f) => !f.properties?.isBorough).length;
      const visited = entry.id === country.id ? visitedRegions.size : getVisitedCount(entry.id, userId);
      return {
        ...entry,
        total,
        visited,
        pct: total > 0 ? Math.round((visited / total) * 100) : 0,
      };
    });
  }, [country.id, visitedRegions.size, userId]);

  const filteredTrackers = useMemo(() => {
    if (!query.trim()) return trackers;
    const q = query.trim().toLowerCase();
    return trackers.filter((entry) => entry.name.toLowerCase().includes(q));
  }, [trackers, query]);

  const regionRows = useMemo(() => {
    const rows = country.data.features
      .filter((feature) => !feature.properties?.isBorough)
      .map((feature) => ({
        id: feature.properties.id,
        name: feature.properties.name,
        date: dates?.[feature.properties.id] || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [country, dates, query]);

  return (
    <div className="tab-screen explore-screen">
      <div className={`explore-large-header${compactHeader ? ' compact' : ''}`}>
        <p className="explore-kicker">Explore</p>
        <h1>Find places</h1>
      </div>

      <div className="explore-seg-header">
        <div className="explore-seg-control" role="tablist" aria-label="Explore navigation">
          <button
            role="tab"
            aria-selected={tab === 'countries'}
            className={withTouchFeedback(`explore-seg-btn${tab === 'countries' ? ' active' : ''}`)}
            onClick={() => setTab('countries')}
          >
            Countries
          </button>
          <button
            role="tab"
            aria-selected={tab === 'regions'}
            className={withTouchFeedback(`explore-seg-btn${tab === 'regions' ? ' active' : ''}`)}
            onClick={() => setTab('regions')}
          >
            Regions
          </button>
        </div>
        <input
          className="explore-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'countries' ? 'Search countries' : `Search ${country.name} regions`}
          aria-label="Search places"
        />
      </div>

      <div
        className="explore-tab-pane"
        onScroll={(e) => setCompactHeader((e.target?.scrollTop ?? e.currentTarget.scrollTop) > 24)}
        {...bind}
      >
        <div className={`pull-refresh-indicator${isRefreshing ? ' refreshing' : ''}`} style={{ height: pullDistance }}>
          <span>{isRefreshing ? 'Refreshing…' : 'Pull to refresh'}</span>
        </div>

        {tab === 'countries' ? (
          <ul className="explore-list">
            {filteredTrackers.map((entry) => {
                const isWorldVisited = worldVisited.has(entry.id);
                return (
                  <li key={entry.id} className="explore-list-item">
                    <button className={withTouchFeedback('explore-item-main')} onClick={() => onExploreCountry(entry.id)}>
                      <span className="explore-item-flag" aria-hidden="true">{entry.flag}</span>
                      <span className="explore-item-text">
                        <span className="explore-item-title">{entry.name}</span>
                      <span className="explore-item-subtitle">{entry.visited}/{entry.total} regions · {entry.pct}%</span>
                    </span>
                    <span className="explore-item-chevron" aria-hidden="true">›</span>
                  </button>
                  <button
                    className={withTouchFeedback(`explore-toggle-world${isWorldVisited ? ' active' : ''}`)}
                    onClick={() => onToggleWorld(entry.id)}
                    aria-label={`${isWorldVisited ? 'Unmark' : 'Mark'} ${entry.name} as visited in world tracker`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="explore-list">
            {regionRows.map((row) => {
                const isVisited = visitedRegions.has(row.id);
                return (
                  <li key={row.id} className="explore-list-item">
                    <button className={withTouchFeedback(`explore-toggle-world explore-toggle-region${isVisited ? ' active' : ''}`)} onClick={() => onToggleRegion(row.id)} aria-label={`${isVisited ? 'Unmark' : 'Mark'} ${row.name} as visited`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                  </button>
                  <div className="explore-item-main explore-item-region">
                    <span className="explore-item-text">
                      <span className="explore-item-title">{row.name}</span>
                      <span className="explore-item-subtitle">{isVisited ? (row.date || 'Visited') : 'Not visited'}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
