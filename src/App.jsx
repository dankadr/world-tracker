import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RegionMap from './components/SwissMap';
import Sidebar from './components/Sidebar';
import ExportButton from './components/ExportButton';
import useVisitedRegions from './hooks/useVisitedCantons';
import useCustomColors from './hooks/useCustomColors';
import { useAuth } from './context/AuthContext';
import getAchievements from './data/achievements';
import countries from './data/countries';
import { countryList } from './data/countries';

function parseShareHash() {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return null;
    const encoded = hash.slice(7);
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

function AchievementToasts() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const seenKey = userId ? `swiss-tracker-u${userId}-achievements-seen` : 'swiss-tracker-achievements-seen';
  const [toasts, setToasts] = useState([]);
  const prevUnlocked = useRef(null);

  const checkAchievements = useCallback(() => {
    const achievements = getAchievements(userId);
    const currentUnlocked = achievements.filter((a) => a.check()).map((a) => a.id);

    let seen;
    try {
      seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
    } catch {
      seen = [];
    }

    if (prevUnlocked.current === null) {
      prevUnlocked.current = new Set(seen.length > 0 ? seen : currentUnlocked);
      if (seen.length === 0) {
        localStorage.setItem(seenKey, JSON.stringify(currentUnlocked));
      }
      return;
    }

    const newlyUnlocked = currentUnlocked.filter((id) => !prevUnlocked.current.has(id));
    if (newlyUnlocked.length > 0) {
      const newToasts = newlyUnlocked.map((id) => {
        const a = achievements.find((x) => x.id === id);
        return { id, icon: a?.icon || '', title: a?.title || '', desc: a?.desc || '', ts: Date.now() + Math.random() };
      });
      setToasts((prev) => [...prev, ...newToasts]);
      prevUnlocked.current = new Set(currentUnlocked);
      localStorage.setItem(seenKey, JSON.stringify(currentUnlocked));
    }
  }, [seenKey, userId]);

  useEffect(() => {
    checkAchievements();
    const interval = setInterval(checkAchievements, 1000);
    return () => clearInterval(interval);
  }, [checkAchievements]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.ts} className="toast-achievement">
          <span className="toast-icon">{t.icon}</span>
          <div className="toast-text">
            <span className="toast-label">Achievement Unlocked!</span>
            <span className="toast-title">{t.title}</span>
            <span className="toast-desc">{t.desc}</span>
          </div>
          <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((x) => x.ts !== t.ts))}>&times;</button>
        </div>
      ))}
    </div>,
    document.body
  );
}

export default function App() {
  const [countryId, setCountryId] = useState('ch');
  const [shareData, setShareData] = useState(null);
  const { applyColors, setColor, colors } = useCustomColors();

  const rawCountry = countries[countryId];
  const country = applyColors(rawCountry);
  const { visited, toggle, reset, resetAll, dates, setDate, notes, setNote } = useVisitedRegions(countryId);

  // Check for share URL on mount
  useEffect(() => {
    const data = parseShareHash();
    if (data) {
      setShareData(data);
      const firstKey = Object.keys(data).find((k) => countries[k]);
      if (firstKey) setCountryId(firstKey);
    }
  }, []);

  const isShareMode = !!shareData;
  const sharedVisited = isShareMode && shareData[countryId]
    ? new Set(shareData[countryId])
    : null;

  const displayVisited = isShareMode ? (sharedVisited || new Set()) : visited;
  const handleToggle = isShareMode ? () => {} : toggle;

  const exitShareMode = () => {
    setShareData(null);
    window.location.hash = '';
  };

  const regionList = country.data.features.filter((f) => !f.properties.isBorough);
  const total = regionList.length;
  const count = displayVisited.size;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="app">
      {!isShareMode && <AchievementToasts />}
      {isShareMode && (
        <div className="share-banner">
          Viewing shared progress &mdash;
          <button className="share-banner-btn" onClick={exitShareMode}>Exit</button>
        </div>
      )}
      <Sidebar
        country={country}
        visited={displayVisited}
        onToggle={handleToggle}
        onReset={isShareMode ? () => {} : reset}
        onResetAll={isShareMode ? () => {} : resetAll}
        onCountryChange={setCountryId}
        readOnly={isShareMode}
        dates={isShareMode ? {} : dates}
        onSetDate={isShareMode ? () => {} : setDate}
        notes={isShareMode ? {} : notes}
        onSetNote={isShareMode ? () => {} : setNote}
        customColor={colors[countryId] || ''}
        onSetColor={(c) => setColor(countryId, c)}
      />
      <main className="map-container">
        <RegionMap country={country} visited={displayVisited} onToggle={handleToggle} />
        {!isShareMode && <ExportButton country={country} />}

        <div className="floating-stats" style={{ '--accent': country.visitedColor }}>
          <div className="stats-card-header">
            <div className="stats-numbers">
              <span className="stats-count">{count}</span>
              <span className="stats-separator">/</span>
              <span className="stats-total">{total}</span>
            </div>
            {!isShareMode && (
              <label className="color-picker-label" title="Custom color">
                <input
                  type="color"
                  className="color-picker"
                  value={colors[countryId] || country.visitedColor}
                  onChange={(e) => setColor(countryId, e.target.value)}
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
      </main>
    </div>
  );
}
