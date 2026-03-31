import { useState, useMemo, useRef, useEffect } from 'react';
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
import LevelBadge from './LevelBadge';
import { useActionSheet } from '../context/ActionSheetContext';
import AddToBucketListModal from './AddToBucketListModal';
import SettingsPanel from './SettingsPanel';
import useAvatar from '../hooks/useAvatar';
import { useAuth } from '../context/AuthContext';
import { ADMIN_EMAIL } from '../utils/adminConfig';
import SwipeableModal from './SwipeableModal';
import AdminPanel from './AdminPanel';

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
  onSearchFocus,
  onOpenFriends,
  friendsPendingCount,
  onOpenBucketList,
  bucketListItems,
  onAddToBucketList,
  isMobile,
  onShowOnboarding,
}) {
  const { dark, toggle: toggleTheme } = useTheme();
  const { user } = useAuth();
  const { showActionSheet } = useActionSheet();
  const [editingDate, setEditingDate] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [bucketListModal, setBucketListModal] = useState(null); // { regionId, name }
  const [showSettings, setShowSettings] = useState(false);
  const { config: avatarConfig, setPart: setAvatarPart, resetAvatar } = useAvatar();

  const tabsRef = useRef(null);

  // Redirect vertical wheel events to horizontal scroll on the tab strip.
  // Uses addEventListener (not onWheel) so we can pass { passive: false } and
  // call preventDefault — required for Chrome to honour it.
  // Trackpad guard: if the user is already scrolling horizontally, let it through.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Compute bucket list set for this country
  const bucketListSet = useMemo(
    () => new Set(bucketListItems.filter((i) => i.tracker_id === country.id).map((i) => i.region_id)),
    [bucketListItems, country.id]
  );

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
    const isWishlisted = bucketListSet?.has(id);
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isWishlisted) {
                    onToggleWishlist(id);
                  } else if (onAddToBucketList) {
                    setBucketListModal({ regionId: id, name });
                  } else {
                    onToggleWishlist(id);
                  }
                }}
                title={isWishlisted ? 'Remove from bucket list' : 'Add to bucket list'}
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
          <button className="avatar-preview-btn" onClick={() => setShowAvatar(true)} title="Customize avatar" aria-label="Customize avatar">
            <AvatarCanvas config={avatarConfig} size={40} />
            <div className="avatar-level-badge-wrap">
              <LevelBadge size={20} />
            </div>
          </button>
          <div className="sidebar-title-group">
            <h1 className="sidebar-title">
              <img src="/logo-sidebar-sm.png" alt="Right World Tracker" className="sidebar-logo" />
              Right World Tracker
            </h1>
            <p className="sidebar-subtitle">Your world. Your journey.</p>
          </div>
          <div className="header-actions">
            {!isMobile && !readOnly && onOpenFriends && (
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
            {!readOnly && onOpenBucketList && (
              <button className="header-icon-btn bucket-header-btn" onClick={onOpenBucketList} title="Bucket List" aria-label="Bucket List">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 17v5" />
                  <path d="M6 4v4l3 3v5l6-3V8l3-4z" />
                </svg>
                {bucketListItems?.length > 0 && (
                  <span className="friends-badge">{bucketListItems.length}</span>
                )}
              </button>
            )}
            {!isMobile && !readOnly && (
              <button className="header-icon-btn" onClick={() => setShowStats(true)} title="Statistics" aria-label="Statistics">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>
            )}
            {!isMobile && !readOnly && (
              <button
                className="header-icon-btn"
                onClick={() => setShowSettingsModal(true)}
                title="Settings"
                aria-label="Open settings"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4.6H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.4.58.92.6 1.46V11a1.65 1.65 0 0 0 1 1.51H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
          </div>
        </div>
      </div>

      {onBackToWorld && !readOnly && (
        <button className="back-to-world-btn" onClick={onBackToWorld}>
          <span className="back-to-world-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
            </svg>
          </span>
          <span>Back to World Map</span>
        </button>
      )}

      {!readOnly && <AuthButton />}

      <OverallProgress />

      <nav className="country-tabs" ref={tabsRef}>
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
        <CitySearch country={country} visited={visited} onToggle={onToggle} searchRef={searchRef} onSearchFocus={onSearchFocus} />
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

      {!isMobile && !readOnly && (
        <div className="sidebar-settings-footer">
          <button
            className={`sidebar-settings-toggle${showSettings ? ' is-open' : ''}`}
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
            aria-controls="sidebar-settings-panel"
            type="button"
          >
            <span className="sidebar-settings-toggle-label"><span aria-hidden="true">⚙</span> Settings</span>
            <span className="sidebar-settings-toggle-arrow" aria-hidden="true">{showSettings ? '▲' : '▼'}</span>
          </button>
          {showSettings && (
            <div id="sidebar-settings-panel">
              <SettingsPanel
                onReset={() => showActionSheet({
                  title: 'Reset Progress',
                  message: `Reset all ${country.regionLabel} progress?`,
                  actions: [{ label: 'Reset', destructive: true, onPress: onReset }],
                })}
                onResetAll={() => showActionSheet({
                  title: 'Reset All Countries',
                  message: 'Reset ALL countries? This cannot be undone.',
                  actions: [{ label: 'Reset All', destructive: true, onPress: onResetAll }],
                })}
                onShowOnboarding={onShowOnboarding}
                onOpenAdmin={isAdmin ? () => setShowAdmin(true) : undefined}
              />
            </div>
          )}
        </div>
      )}

      <div className="sidebar-footer">
        {!readOnly && <ShareButton />}
      </div>
      {showAdmin && (
        <SwipeableModal onClose={() => setShowAdmin(false)} maxWidth={480}>
          <AdminPanel />
        </SwipeableModal>
      )}
      {showSettingsModal && (
        <SwipeableModal onClose={() => setShowSettingsModal(false)} maxWidth={480}>
          <SettingsPanel
            onReset={() => showActionSheet({
              title: 'Reset Progress',
              message: `Reset all ${country.regionLabel} progress?`,
              actions: [{ label: 'Reset', destructive: true, onPress: onReset }],
            })}
            onResetAll={() => showActionSheet({
              title: 'Reset All Countries',
              message: 'Reset ALL countries? This cannot be undone.',
              actions: [{ label: 'Reset All', destructive: true, onPress: onResetAll }],
            })}
            onShowOnboarding={onShowOnboarding}
            onOpenAdmin={isAdmin ? () => setShowAdmin(true) : undefined}
          />
        </SwipeableModal>
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
      <AddToBucketListModal
        isOpen={!!bucketListModal}
        onClose={() => setBucketListModal(null)}
        onAdd={(trackerId, regionId, opts) => {
          if (onAddToBucketList) {
            onAddToBucketList(trackerId, regionId, opts);
          }
          setBucketListModal(null);
        }}
        regionName={bucketListModal?.name || ''}
        trackerId={country.id}
        regionId={bucketListModal?.regionId || ''}
        trackerFlag={country.flag}
      />
    </aside>
  );
}
