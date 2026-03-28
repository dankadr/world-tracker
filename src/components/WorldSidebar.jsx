import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/ThemeContext';
import { secureStorage } from '../utils/secureStorage';
import { countryList } from '../data/countries';
import { useAuth } from '../context/AuthContext';
import worldData from '../data/world.json';
import continentMap from '../config/continents.json';
import AuthButton from './AuthButton';
import AvatarCanvas from './AvatarCanvas';
import AvatarEditor from './AvatarEditor';
import useAvatar from '../hooks/useAvatar';
import Achievements from './Achievements';
import StatsModal from './StatsModal';
import UnescoPanel from './UnescoPanel';
import { isGreaterIsraelEnabled, toggleGreaterIsrael } from '../utils/easterEggs';
import { ADMIN_EMAIL } from '../utils/adminConfig';
import AdminPanel from './AdminPanel';
import SwipeableModal from './SwipeableModal';

const CONTINENT_EMOJI = {
  'Africa': '🌍',
  'Asia': '🌏',
  'Europe': '🌍',
  'North America': '🌎',
  'South America': '🌎',
  'Oceania': '🌏',
  'Other': '🌐',
};

const INHABITED_CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function getVisitedCount(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object') return Object.keys(data).length;
    }
  } catch { /* ignore */ }
  return 0;
}

function getTotalRegions(country) {
  return country.data.features.filter((f) => !f.properties?.isBorough).length;
}

export default function WorldSidebar({
  visited,
  onToggle,
  onExploreCountry,
  collapsed,
  onOpenFriends,
  friendsPendingCount,
  isMobile,
}) {
  const { dark, toggle: toggleTheme } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || null;
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [search, setSearch] = useState('');
  const [openContinents, setOpenContinents] = useState({});
  const [showAvatar, setShowAvatar] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showUnesco, setShowUnesco] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [greaterIsraelEnabled, setGreaterIsraelEnabled] = useState(() => isGreaterIsraelEnabled());
  const { config: avatarConfig, setPart: setAvatarPart, resetAvatar } = useAvatar();

  const allCountries = useMemo(() => {
    return worldData.features.map((f) => ({
      id: f.properties.id,
      name: f.properties.name,
      continent: continentMap[f.properties.id] || 'Other',
    }));
  }, []);

  const totalCountries = allCountries.length;
  const visitedCount = visited.size;
  const pct = totalCountries > 0 ? Math.round((visitedCount / totalCountries) * 100) : 0;

  const continentStats = useMemo(() => {
    const stats = {};
    allCountries.forEach((c) => {
      if (!stats[c.continent]) stats[c.continent] = { total: 0, visited: 0, countries: [] };
      stats[c.continent].total++;
      if (visited.has(c.id)) stats[c.continent].visited++;
      stats[c.continent].countries.push(c);
    });
    return stats;
  }, [allCountries, visited]);

  const continentsVisited = INHABITED_CONTINENTS.filter(
    (c) => continentStats[c]?.visited > 0
  ).length;

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return allCountries.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCountries, search]);

  const toggleContinent = (continent) => {
    setOpenContinents((prev) => ({ ...prev, [continent]: !prev[continent] }));
  };

  const trackerStats = useMemo(() => {
    return countryList.map((c) => {
      const total = getTotalRegions(c);
      const v = getVisitedCount(c.id, userId);
      return {
        ...c,
        total,
        visited: v,
        pct: total > 0 ? Math.round((v / total) * 100) : 0,
      };
    });
  }, [userId]);

  useEffect(() => {
    function handleEasterEggToggle(e) {
      if (e.detail === 'greater-israel') {
        setGreaterIsraelEnabled(isGreaterIsraelEnabled());
      }
    }
    window.addEventListener('easter-egg-toggle', handleEasterEggToggle);
    return () => window.removeEventListener('easter-egg-toggle', handleEasterEggToggle);
  }, []);

  const handleDisableEasterEgg = () => {
    if (!greaterIsraelEnabled) return;
    toggleGreaterIsrael();
    window.dispatchEvent(new CustomEvent('easter-egg-toggle', { detail: 'greater-israel' }));
  };

  return (
    <aside className={`sidebar world-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <button className="avatar-preview-btn" onClick={() => setShowAvatar(true)} title="Customize avatar" aria-label="Customize avatar">
            <AvatarCanvas config={avatarConfig} size={40} />
          </button>
          <div className="sidebar-title-group">
            <h1 className="sidebar-title">
              <img src="/logo-sidebar-sm.png" alt="Right World Tracker" className="sidebar-logo" />
              Right World Tracker
            </h1>
            <p className="sidebar-subtitle">Your world. Your journey.</p>
          </div>
          <div className="header-actions">
            {!isMobile && onOpenFriends && (
              <button className="header-icon-btn friends-header-btn" onClick={onOpenFriends} title="Friends" aria-label="Friends">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {friendsPendingCount > 0 && (
                  <span className="friends-badge">{friendsPendingCount}</span>
                )}
              </button>
            )}
            {!isMobile && (
              <button className="header-icon-btn" onClick={() => setShowStats(true)} title="Statistics" aria-label="Statistics">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>
            )}
            {!isMobile && (
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
              </button>
            )}
            {!isMobile && isAdmin && (
              <button className="header-icon-btn" onClick={() => setShowAdmin(true)} title="Admin Panel" aria-label="Admin Panel">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="world-sidebar-content">
      <AuthButton />

      {/* World Stats Summary */}
      <div className="world-stats-summary">
        <div className="world-stats-row">
          <div className="world-stat-item">
            <span className="world-stat-num">{visitedCount}</span>
            <span className="world-stat-label">/ {totalCountries} countries</span>
          </div>
          <div className="world-stat-item">
            <span className="world-stat-num">{continentsVisited}</span>
            <span className="world-stat-label">/ {INHABITED_CONTINENTS.length} continents</span>
          </div>
        </div>
        <div className="world-progress-bar">
          <div
            className="world-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="world-progress-pct">{pct}% of the world</p>
      </div>

      {greaterIsraelEnabled && (
        <div className="world-easter-egg-toggle">
          <button className="world-easter-egg-btn" onClick={handleDisableEasterEgg}>
            Disable secret mode
          </button>
        </div>
      )}

      {/* Search */}
      <div className="world-search-container">
        <input
          type="text"
          className="world-search-input"
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="world-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>

      {/* Search Results */}
      {filteredCountries && (
        <div className="world-search-results">
          {filteredCountries.length === 0 && (
            <p className="world-no-results">No countries found</p>
          )}
          <ul className="world-country-list">
            {filteredCountries.map((c) => (
              <li key={c.id} className="world-country-item">
                <label className={`canton-label ${visited.has(c.id) ? 'visited' : ''}`}
                  style={visited.has(c.id) ? { '--visit-bg': '#c9a84c18', '--visit-bg-hover': '#c9a84c28', '--visit-color': '#c9a84c' } : {}}
                >
                  <input
                    type="checkbox"
                    checked={visited.has(c.id)}
                    onChange={() => onToggle(c.id)}
                    style={{ accentColor: '#c9a84c' }}
                  />
                  <span className="canton-name">{c.name}</span>
                  <span className="world-country-continent">{c.continent}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Achievements />

      {/* Quick Links to Detail Trackers */}
      <div className="world-quick-links">
        <h2 className="list-heading">Region Trackers</h2>
        <p className="world-tracker-hint">Click a tracker to explore regions within that country</p>
        <div className="world-tracker-grid">
          <button
            className="world-tracker-card"
            onClick={() => setShowUnesco(true)}
          >
            <span className="world-tracker-flag">🏛️</span>
            <span className="world-tracker-name">UNESCO Sites</span>
            <div className="world-tracker-bar">
              <div
                className="world-tracker-bar-fill"
                style={{ width: `0%`, background: '#8B4513' }}
              />
            </div>
            <span className="world-tracker-pct">New!</span>
          </button>
          {trackerStats.map((t) => (
            <button
              key={t.id}
              className="world-tracker-card"
              onClick={() => onExploreCountry(t.id)}
            >
              <span className="world-tracker-flag">{t.flag}</span>
              <span className="world-tracker-name">{t.name}</span>
              <div className="world-tracker-bar">
                <div
                  className="world-tracker-bar-fill"
                  style={{ width: `${t.pct}%`, background: t.visitedColor }}
                />
              </div>
              <span className="world-tracker-pct">{t.pct}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Continent Breakdown */}
      {!filteredCountries && (
        <div className="world-continents">
          <h2 className="list-heading">Countries by Continent</h2>
          {Object.entries(continentStats)
            .filter(([name]) => name !== 'Other')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([continent, stats]) => (
              <div key={continent} className="world-continent-group">
                <button
                  className="world-continent-header"
                  onClick={() => toggleContinent(continent)}
                >
                  <span className="world-continent-emoji">
                    {CONTINENT_EMOJI[continent] || '🌐'}
                  </span>
                  <span className="world-continent-name">{continent}</span>
                  <span className="world-continent-count">
                    {stats.visited}/{stats.total}
                  </span>
                  <span className={`overall-chevron ${openContinents[continent] ? 'open' : ''}`}>
                    &#9662;
                  </span>
                </button>
                {openContinents[continent] && (
                  <ul className="world-country-list">
                    {stats.countries
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <li key={c.id} className="world-country-item">
                          <label
                            className={`canton-label ${visited.has(c.id) ? 'visited' : ''}`}
                            style={visited.has(c.id) ? { '--visit-bg': '#c9a84c18', '--visit-bg-hover': '#c9a84c28', '--visit-color': '#c9a84c' } : {}}
                          >
                            <input
                              type="checkbox"
                              checked={visited.has(c.id)}
                              onChange={() => onToggle(c.id)}
                              style={{ accentColor: '#c9a84c' }}
                            />
                            <span className="canton-name">{c.name}</span>
                          </label>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      )}

      </div>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showUnesco && createPortal(
        <UnescoPanel onClose={() => setShowUnesco(false)} />,
        document.body
      )}
      {showAvatar && (
        <AvatarEditor
          config={avatarConfig}
          onSetPart={setAvatarPart}
          onReset={resetAvatar}
          onClose={() => setShowAvatar(false)}
        />
      )}
      {showAdmin && (
        <SwipeableModal onClose={() => setShowAdmin(false)} maxWidth={480}>
          <AdminPanel />
        </SwipeableModal>
      )}
    </aside>
  );
}
