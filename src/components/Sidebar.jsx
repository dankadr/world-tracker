import { useState } from 'react';
import { countryList } from '../data/countries';
import { useTheme } from '../context/ThemeContext';
import AuthButton from './AuthButton';
import CitySearch from './CitySearch';
import OverallProgress from './OverallProgress';
import Achievements from './Achievements';
import ShareButton from './ShareButton';
import StatsModal from './StatsModal';

export default function Sidebar({
  country,
  visited,
  onToggle,
  onReset,
  onCountryChange,
  readOnly,
  dates,
  onSetDate,
  notes,
  onSetNote,
  customColor,
  onSetColor,
}) {
  const { dark, toggle: toggleTheme } = useTheme();
  const [editingDate, setEditingDate] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const regionList = country.data.features
    .filter((f) => !f.properties.isBorough)
    .map((f) => ({ id: f.properties.id, name: f.properties.name, borough: f.properties.borough || null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = regionList.length;
  const count = visited.size;
  const pct = Math.round((count / total) * 100);

  // Hide the abbreviation column when IDs are just numbers (e.g., NYC)
  const showAbbr = regionList.length > 0 && isNaN(regionList[0].id);

  // Group by borough if any region has one (NYC)
  const hasBoroughs = regionList.some((r) => r.borough);
  const groupedRegions = hasBoroughs
    ? regionList.reduce((acc, r) => {
        const key = r.borough || 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {})
    : null;

  const renderRegionItem = ({ id, name }) => {
    const isVisited = visited.has(id);
    const dateVal = dates?.[id] || '';
    const noteVal = notes?.[id] || '';
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
          {showAbbr && <span className="canton-abbr">{id}</span>}
          <span className="canton-name">{name}</span>
          {isVisited && !readOnly && (
            <span className="region-actions">
              {editingDate === id ? (
                <input
                  type="month"
                  className="date-input"
                  value={dateVal}
                  onChange={(e) => onSetDate(id, e.target.value)}
                  onBlur={() => setEditingDate(null)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="date-tag"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingDate(id); }}
                >
                  {dateVal || '+ date'}
                </span>
              )}
              <span
                className="note-icon"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingNote(editingNote === id ? null : id); }}
                title={noteVal || 'Add note'}
              >
                {noteVal ? '📝' : '💬'}
              </span>
            </span>
          )}
        </label>
        {editingNote === id && isVisited && !readOnly && (
          <div className="note-editor">
            <textarea
              className="note-textarea"
              placeholder="Add a trip note..."
              value={noteVal}
              onChange={(e) => onSetNote(id, e.target.value)}
              rows={2}
            />
          </div>
        )}
        {noteVal && editingNote !== id && isVisited && (
          <div className="note-preview" onClick={() => setEditingNote(id)}>
            {noteVal}
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <h1 className="sidebar-title">
            <img src="/logo.png" alt="" className="sidebar-logo" />
            Travel Tracker
          </h1>
          <div className="header-actions">
            {!readOnly && (
              <button className="header-icon-btn" onClick={() => setShowStats(true)} title="Statistics">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>
            )}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
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
        <div className="stats-card-header">
          <div className="stats-numbers">
            <span className="stats-count">{count}</span>
            <span className="stats-separator">/</span>
            <span className="stats-total">{total}</span>
          </div>
          {!readOnly && (
            <label className="color-picker-label" title="Custom color">
              <input
                type="color"
                className="color-picker"
                value={customColor || country.visitedColor}
                onChange={(e) => onSetColor(e.target.value)}
              />
              <span
                className="color-dot"
                style={{ background: country.visitedColor }}
              />
            </label>
          )}
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
        {hasBoroughs ? (
          Object.entries(groupedRegions).sort(([a], [b]) => a.localeCompare(b)).map(([borough, items]) => {
            const boroVisited = items.filter((r) => visited.has(r.id)).length;
            return (
              <div key={borough} className="borough-group">
                <h3 className="borough-heading">
                  {borough}
                  <span className="borough-count">{boroVisited}/{items.length}</span>
                </h3>
                <ul>{items.map((r) => renderRegionItem(r))}</ul>
              </div>
            );
          })
        ) : (
          <ul>{regionList.map((r) => renderRegionItem(r))}</ul>
        )}
      </div>

      <div className="sidebar-footer">
        {!readOnly && <ShareButton />}
        {!readOnly && (
          <button className="reset-btn" onClick={onReset}>
            Reset {country.regionLabel}
          </button>
        )}
      </div>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </aside>
  );
}
