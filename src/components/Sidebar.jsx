import { useState } from 'react';
import { countryList } from '../data/countries';
import { useTheme } from '../context/ThemeContext';
import AuthButton from './AuthButton';
import CitySearch from './CitySearch';
import OverallProgress from './OverallProgress';
import Achievements from './Achievements';
import ShareButton from './ShareButton';
import StatsModal from './StatsModal';
import AvatarCanvas from './AvatarCanvas';
import AvatarEditor from './AvatarEditor';
import useAvatar from '../hooks/useAvatar';

export default function Sidebar({
  country,
  visited,
  onToggle,
  onReset,
  onResetAll,
  onCountryChange,
  readOnly,
  dates,
  onSetDate,
  notes,
  onSetNote,
  customColor,
  onSetColor,
  collapsed,
  wishlist,
  onToggleWishlist,
  searchRef,
  onBackToWorld,
  isMobile,
}) {
  const { dark, toggle: toggleTheme } = useTheme();
  const [editingDate, setEditingDate] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const { config: avatarConfig, setPart: setAvatarPart, resetAvatar } = useAvatar();

  const regionList = country.data.features
    .filter((f) => !f.properties.isBorough)
    .map((f) => ({ id: f.properties.id, name: f.properties.name, borough: f.properties.borough || null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const total = regionList.length;
  const count = visited.size;
  const pct = Math.round((count / total) * 100);

  const showAbbr = regionList.length > 0 && isNaN(regionList[0].id);

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
    const isWishlisted = wishlist?.has(id);
    const dateVal = dates?.[id] || '';
    const noteVal = notes?.[id] || '';
    return (
      <li key={id} className="canton-item">
        <label
          className={`canton-label ${isVisited ? 'visited' : ''} ${isWishlisted && !isVisited ? 'wishlisted' : ''}`}
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
          {!isVisited && !readOnly && (
            <span className="region-actions">
              <button
                className={`wishlist-btn ${isWishlisted ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWishlist(id); }}
                title={isWishlisted ? 'Remove from planned' : 'Add to planned'}
              >
                {isWishlisted ? '★' : '☆'}
              </button>
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
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <button className="avatar-preview-btn" onClick={() => setShowAvatar(true)} title="Customize avatar">
            <AvatarCanvas config={avatarConfig} size={40} />
          </button>
          <div className="sidebar-title-group">
            <h1 className="sidebar-title">
              <img src="/logo.png" alt="" className="sidebar-logo" />
              Travel Tracker
            </h1>
            <p className="sidebar-subtitle">Mark the places you've been</p>
          </div>
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
      </div>

      {onBackToWorld && !readOnly && (
        <button className="back-to-world-btn" onClick={onBackToWorld}>
          <span className="back-to-world-icon">🌍</span>
          <span>Back to World Map</span>
        </button>
      )}

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
        <CitySearch country={country} visited={visited} onToggle={onToggle} searchRef={searchRef} />
      )}

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
          <button className="reset-btn" onClick={() => { if (window.confirm(`Reset all ${country.regionLabel} progress?`)) onReset(); }}>
            Reset {country.regionLabel}
          </button>
        )}
      </div>
      {!readOnly && (
        <div className="sidebar-footer-secondary">
          <button className="reset-all-btn" onClick={() => { if (window.confirm('Reset ALL countries? This cannot be undone.')) onResetAll(); }}>
            Reset Everything
          </button>
        </div>
      )}

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
      {showAvatar && (
        <AvatarEditor
          config={avatarConfig}
          onSetPart={setAvatarPart}
          onReset={resetAvatar}
          onClose={() => setShowAvatar(false)}
        />
      )}
    </aside>
  );
}
