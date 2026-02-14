import { useState } from 'react';
import { countryList } from '../data/countries';
import { useTheme } from '../context/ThemeContext';
import AuthButton from './AuthButton';
import CitySearch from './CitySearch';
import OverallProgress from './OverallProgress';
import Achievements from './Achievements';
import ShareButton from './ShareButton';

export default function Sidebar({
  country,
  visited,
  onToggle,
  onReset,
  onCountryChange,
  readOnly,
  dates,
  onSetDate,
}) {
  const { dark, toggle: toggleTheme } = useTheme();
  const [editingDate, setEditingDate] = useState(null);

  const regionList = country.data.features
    .map((f) => ({ id: f.properties.id, name: f.properties.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = regionList.length;
  const count = visited.size;
  const pct = Math.round((count / total) * 100);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <h1 className="sidebar-title">
            <img src="/logo.png" alt="" className="sidebar-logo" />
            Travel Tracker
          </h1>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
        <p className="sidebar-subtitle">Mark the places you've been</p>
      </div>

      {!readOnly && <AuthButton />}

      <OverallProgress />

      <nav className="country-tabs">
        {countryList.map((c) => (
          <button
            key={c.id}
            className={`country-tab ${c.id === country.id ? 'active' : ''}`}
            onClick={() => onCountryChange(c.id)}
            title={c.name}
          >
            <span className="tab-flag">{c.flag}</span>
            <span className="tab-name">{c.name}</span>
          </button>
        ))}
      </nav>

      {!readOnly && (
        <CitySearch country={country} visited={visited} onToggle={onToggle} />
      )}

      <div className="stats-card" style={{ '--accent': country.visitedColor }}>
        <div className="stats-numbers">
          <span className="stats-count">{count}</span>
          <span className="stats-separator">/</span>
          <span className="stats-total">{total}</span>
        </div>
        <p className="stats-label">{country.regionLabel.toLowerCase()} visited</p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${country.visitedColor}, ${country.visitedHover})`,
            }}
          />
        </div>
        <p className="stats-pct" style={{ color: country.visitedColor }}>
          {pct}%
        </p>
      </div>

      {!readOnly && <Achievements />}

      <div className="canton-list">
        <h2 className="list-heading">All {country.regionLabel}</h2>
        <ul>
          {regionList.map(({ id, name }) => {
            const isVisited = visited.has(id);
            const dateVal = dates?.[id] || '';
            return (
              <li key={id} className="canton-item">
                <label
                  className={`canton-label ${isVisited ? 'visited' : ''}`}
                  style={isVisited ? { '--visit-bg': country.visitedColor + '18', '--visit-bg-hover': country.visitedColor + '28', '--visit-color': country.visitedHover } : {}}
                >
                  <input
                    type="checkbox"
                    checked={isVisited}
                    onChange={() => !readOnly && onToggle(id)}
                    disabled={readOnly}
                    style={{ accentColor: country.visitedColor }}
                  />
                  <span className="canton-abbr">{id}</span>
                  <span className="canton-name">{name}</span>
                  {isVisited && !readOnly && (
                    editingDate === id ? (
                      <input
                        type="month"
                        className="date-input"
                        value={dateVal}
                        onChange={(e) => {
                          onSetDate(id, e.target.value);
                        }}
                        onBlur={() => setEditingDate(null)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="date-tag"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingDate(id);
                        }}
                      >
                        {dateVal || '+ date'}
                      </span>
                    )
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="sidebar-footer">
        {!readOnly && <ShareButton />}
        {!readOnly && (
          <button className="reset-btn" onClick={onReset}>
            Reset {country.regionLabel}
          </button>
        )}
      </div>
    </aside>
  );
}
