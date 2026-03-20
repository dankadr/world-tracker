import { useMemo, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { countryList } from '../data/countries';
import worldData from '../data/world.json';
import continentMap from '../config/continents.json';
import { secureStorage } from '../utils/secureStorage';
import usePullToRefresh from '../hooks/usePullToRefresh';
import useTouchFeedback from '../hooks/useTouchFeedback';
import './ExploreScreen.css';
import './iosPrimitives.css';

const CONTINENT_ORDER = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
  'Other',
];

const INHABITED_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedRegionCount(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && data) return Object.keys(data).length;
  } catch {
    return 0;
  }
  return 0;
}

function getTrackerRegionTotal(country) {
  return country.data.features.filter((f) => !f.properties?.isBorough).length;
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" />
      <polygon points="15.9 8.1 13.7 13.7 8.1 15.9 10.3 10.3 15.9 8.1" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" />
      <path d="M2.75 12h18.5" />
      <path d="M12 2.75c2.7 2.47 4.25 5.68 4.25 9.25S14.7 18.78 12 21.25c-2.7-2.47-4.25-5.68-4.25-9.25S9.3 5.22 12 2.75Z" />
    </svg>
  );
}

function RegionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="9" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
    </svg>
  );
}

function PullArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
    </svg>
  );
}

export default function ExploreScreen({ worldVisited, onToggleWorld, onExploreCountry, onOpenWorld }) {
  const { user } = useAuth();
  const { switchTab } = useNavigation();
  const [tab, setTab] = useState('countries');
  const [search, setSearch] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const userId = user?.id || null;

  const countriesTabTouch = useTouchFeedback();
  const trackersTabTouch = useTouchFeedback();
  const worldCardTouch = useTouchFeedback();
  const clearSearchTouch = useTouchFeedback();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleVisitedChange = () => setRefreshVersion((prev) => prev + 1);
    window.addEventListener('visitedchange', handleVisitedChange);
    return () => window.removeEventListener('visitedchange', handleVisitedChange);
  }, []);

  const handleRefresh = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 260));
    setRefreshVersion((prev) => prev + 1);
  }, []);

  const countriesPull = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: tab !== 'countries',
  });

  const trackersPull = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: tab !== 'trackers',
  });

  const trackerById = useMemo(() => {
    return countryList.reduce((acc, country) => {
      acc[country.id] = country;
      return acc;
    }, {});
  }, []);

  const allCountries = useMemo(() => {
    return worldData.features
      .map((feature) => {
        const id = feature.properties.id;
        return {
          id,
          name: feature.properties.name,
          continent: continentMap[id] || 'Other',
          tracker: trackerById[id] || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [trackerById]);

  const groupedCountries = useMemo(() => {
    const grouped = allCountries.reduce((acc, country) => {
      if (!acc[country.continent]) acc[country.continent] = [];
      acc[country.continent].push(country);
      return acc;
    }, {});

    return CONTINENT_ORDER
      .filter((continent) => grouped[continent]?.length)
      .map((continent) => ({ continent, countries: grouped[continent] }));
  }, [allCountries]);

  const trackerStats = useMemo(() => {
    return countryList
      .map((country) => {
        const total = getTrackerRegionTotal(country);
        const visited = getVisitedRegionCount(country.id, userId);
        return {
          ...country,
          total,
          visited,
          pct: total > 0 ? Math.round((visited / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  }, [refreshVersion, userId]);

  const query = search.trim().toLowerCase();

  const filteredCountries = useMemo(() => {
    if (!query) return null;
    return allCountries.filter((country) => (
      country.name.toLowerCase().includes(query)
      || country.continent.toLowerCase().includes(query)
    ));
  }, [allCountries, query]);

  const filteredTrackers = useMemo(() => {
    if (!query) return trackerStats;
    return trackerStats.filter((country) => (
      country.name.toLowerCase().includes(query)
      || country.regionLabel.toLowerCase().includes(query)
    ));
  }, [trackerStats, query]);

  const worldVisitedCount = worldVisited.size;
  const worldTotal = allCountries.length;
  const worldPct = worldTotal > 0 ? Math.round((worldVisitedCount / worldTotal) * 100) : 0;

  const continentsVisited = useMemo(() => {
    const reached = new Set(
      allCountries
        .filter((country) => worldVisited.has(country.id))
        .map((country) => country.continent)
        .filter((continent) => INHABITED_CONTINENTS.includes(continent))
    );
    return reached.size;
  }, [allCountries, worldVisited]);

  const trackerProgress = useMemo(() => {
    return trackerStats.reduce((acc, tracker) => {
      acc.visited += tracker.visited;
      acc.total += tracker.total;
      if (tracker.total > 0 && tracker.visited >= tracker.total) {
        acc.completed += 1;
      }
      return acc;
    }, { visited: 0, total: 0, completed: 0 });
  }, [trackerStats]);

  const trackerPct = trackerProgress.total > 0
    ? Math.round((trackerProgress.visited / trackerProgress.total) * 100)
    : 0;

  const handleOpenWorldMap = () => {
    onOpenWorld?.();
    switchTab('map');
  };

  const handleOpenTracker = (countryId) => {
    onExploreCountry?.(countryId);
    switchTab('map');
  };

  // Scroll-to-top when the already-active Explore tab is re-tapped
  useEffect(() => {
    const handler = (e) => {
      if (e.detail !== 'explore') return;
      const ref = tab === 'countries' ? countriesPull.containerRef : trackersPull.containerRef;
      ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('tab-reselect', handler);
    return () => window.removeEventListener('tab-reselect', handler);
  }, [tab, countriesPull.containerRef, trackersPull.containerRef]);

  const handlePaneScroll = useCallback((event) => {
    setHeaderCollapsed(event.currentTarget.scrollTop > 22);
  }, []);

  const handleSetTab = useCallback((nextTab) => {
    countriesPull.reset();
    trackersPull.reset();
    setTab(nextTab);
    setHeaderCollapsed(false);
  }, [countriesPull, trackersPull]);

  return (
    <div className="tab-screen explore-screen">
      <header className={`explore-large-header${headerCollapsed ? ' is-collapsed' : ''}`}>
        <div className="explore-large-title-row">
          <span className="explore-large-icon" aria-hidden="true">
            <CompassIcon />
          </span>
          <h1 className="explore-large-title">Explore</h1>
        </div>
        <p className="explore-large-subtitle">
          {tab === 'countries'
            ? 'Track countries and revisit your world progress.'
            : 'Jump into region trackers and keep momentum.'}
        </p>
      </header>

      <div className="explore-seg-header">
        <div className="explore-seg-control" role="tablist" aria-label="Explore navigation">
          <button
            role="tab"
            aria-selected={tab === 'countries'}
            className={`explore-seg-btn ${countriesTabTouch.touchClassName}${tab === 'countries' ? ' active' : ''}`}
            onClick={() => handleSetTab('countries')}
            {...countriesTabTouch.touchHandlers}
          >
            <span className="explore-seg-btn-icon"><GlobeIcon /></span>
            Countries
          </button>
          <button
            role="tab"
            aria-selected={tab === 'trackers'}
            className={`explore-seg-btn ${trackersTabTouch.touchClassName}${tab === 'trackers' ? ' active' : ''}`}
            onClick={() => handleSetTab('trackers')}
            {...trackersTabTouch.touchHandlers}
          >
            <span className="explore-seg-btn-icon"><RegionsIcon /></span>
            Regions
          </button>
        </div>
      </div>

      <div className="explore-progress-cards">
        <button
          className={`explore-progress-card ${worldCardTouch.touchClassName}`}
          onClick={handleOpenWorldMap}
          {...worldCardTouch.touchHandlers}
        >
          <span className="explore-card-kicker">World progress</span>
          <span className="explore-card-title">{worldVisitedCount} / {worldTotal} countries</span>
          <span className="explore-card-subtitle">{continentsVisited} / {INHABITED_CONTINENTS.length} continents visited</span>
          <div className="explore-progress-bar">
            <div className="explore-progress-fill" style={{ width: `${worldPct}%` }} />
          </div>
          <span className="explore-card-meta">{worldPct}% visited · Open world map</span>
        </button>

        <div className="explore-progress-card tracker">
          <span className="explore-card-kicker">Region trackers</span>
          <span className="explore-card-title">{trackerProgress.visited} / {trackerProgress.total} regions</span>
          <span className="explore-card-subtitle">{trackerProgress.completed} / {trackerStats.length} trackers complete</span>
          <div className="explore-progress-bar">
            <div className="explore-progress-fill" style={{ width: `${trackerPct}%` }} />
          </div>
          <span className="explore-card-meta">{trackerPct}% total tracker progress</span>
        </div>
      </div>

      <div className="explore-search-wrap">
        <input
          type="text"
          className="explore-search-input"
          placeholder={tab === 'countries' ? 'Search countries or continents…' : 'Search trackers or region types…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className={`explore-search-clear ${clearSearchTouch.touchClassName}`}
            onClick={() => setSearch('')}
            aria-label="Clear search"
            {...clearSearchTouch.touchHandlers}
          >
            &times;
          </button>
        )}
      </div>

      {tab === 'countries' ? (
        <div className="explore-tab-pane" ref={countriesPull.containerRef} {...countriesPull.bind} onScroll={handlePaneScroll}>
          <div className={`ios-pull-indicator${countriesPull.pullDistance > 4 || countriesPull.isRefreshing ? ' visible' : ''}${countriesPull.isReady ? ' ready' : ''}${countriesPull.isRefreshing ? ' refreshing' : ''}`}>
            <PullArrowIcon />
            <span>{countriesPull.indicatorText}</span>
          </div>
          <div className="explore-pane-content" style={countriesPull.contentStyle}>
            {filteredCountries ? (
              <>
                <p className="explore-section-hint">
                  {filteredCountries.length} countr{filteredCountries.length === 1 ? 'y' : 'ies'} found
                </p>
                <ul className="explore-country-list">
                  {filteredCountries.map((country) => {
                    const isVisited = worldVisited.has(country.id);
                    return (
                      <li key={country.id} className="explore-country-item">
                        <label
                          className={`explore-country-toggle${isVisited ? ' is-visited' : ''}`}
                          style={isVisited ? { '--explore-country-accent': '#c9a84c', '--explore-country-bg': '#c9a84c1f' } : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={isVisited}
                            onChange={() => onToggleWorld(country.id)}
                            style={{ accentColor: '#c9a84c' }}
                          />
                          <span className="explore-country-name">{country.name}</span>
                          <span className="explore-country-continent">{country.continent}</span>
                        </label>
                        {country.tracker && (
                          <button
                            className="explore-country-action ios-touch-feedback"
                            onClick={() => handleOpenTracker(country.id)}
                          >
                            Open {country.tracker.regionLabel}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              groupedCountries.map(({ continent, countries }) => {
                const visitedInContinent = countries.filter((country) => worldVisited.has(country.id)).length;
                return (
                  <section key={continent} className="explore-continent-group">
                    <div className="explore-continent-header">
                      <h2>{continent}</h2>
                      <span>{visitedInContinent}/{countries.length}</span>
                    </div>
                    <ul className="explore-country-list">
                      {countries.map((country) => {
                        const isVisited = worldVisited.has(country.id);
                        return (
                          <li key={country.id} className="explore-country-item">
                            <label
                              className={`explore-country-toggle${isVisited ? ' is-visited' : ''}`}
                              style={isVisited ? { '--explore-country-accent': '#c9a84c', '--explore-country-bg': '#c9a84c1f' } : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={isVisited}
                                onChange={() => onToggleWorld(country.id)}
                                style={{ accentColor: '#c9a84c' }}
                              />
                              <span className="explore-country-name">{country.name}</span>
                              <span className="explore-country-continent">{country.continent}</span>
                            </label>
                            {country.tracker && (
                              <button
                                className="explore-country-action ios-touch-feedback"
                                onClick={() => handleOpenTracker(country.id)}
                              >
                                Open {country.tracker.regionLabel}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="explore-tab-pane" ref={trackersPull.containerRef} {...trackersPull.bind} onScroll={handlePaneScroll}>
          <div className={`ios-pull-indicator${trackersPull.pullDistance > 4 || trackersPull.isRefreshing ? ' visible' : ''}${trackersPull.isReady ? ' ready' : ''}${trackersPull.isRefreshing ? ' refreshing' : ''}`}>
            <PullArrowIcon />
            <span>{trackersPull.indicatorText}</span>
          </div>
          <div className="explore-pane-content" style={trackersPull.contentStyle}>
            {filteredTrackers.length === 0 ? (
              <p className="explore-empty">No trackers match “{search.trim()}”.</p>
            ) : (
              <div className="explore-tracker-grid">
                {filteredTrackers.map((tracker) => (
                  <button
                    key={tracker.id}
                    className="explore-tracker-card ios-touch-feedback"
                    onClick={() => handleOpenTracker(tracker.id)}
                  >
                    <div className="explore-tracker-head">
                      <span className="explore-tracker-flag">{tracker.flag}</span>
                      <div className="explore-tracker-copy">
                        <span className="explore-tracker-name">{tracker.name}</span>
                        <span className="explore-tracker-subtitle">
                          {tracker.visited}/{tracker.total} {tracker.regionLabel.toLowerCase()}
                        </span>
                      </div>
                      <span className="explore-tracker-pct">{tracker.pct}%</span>
                    </div>
                    <div className="explore-tracker-bar">
                      <div
                        className="explore-tracker-fill"
                        style={{
                          width: `${tracker.pct}%`,
                          background: `linear-gradient(90deg, ${tracker.visitedColor}, ${tracker.visitedHover})`,
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
