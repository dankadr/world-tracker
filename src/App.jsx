import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RegionMap from './components/SwissMap';
import Sidebar from './components/Sidebar';
import ExportButton from './components/ExportButton';
import Confetti from './components/Confetti';
import AnimatedNumber from './components/AnimatedNumber';
import Onboarding from './components/Onboarding';
import useVisitedRegions from './hooks/useVisitedCantons';
import useCustomColors from './hooks/useCustomColors';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
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

const MILESTONES = [25, 50, 75, 100];

export default function App() {
  const [countryId, setCountryId] = useState('ch');
  const [shareData, setShareData] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { applyColors, setColor, colors } = useCustomColors();
  const { toggle: toggleTheme } = useTheme();
  const searchRef = useRef(null);

  const rawCountry = countries[countryId];
  const country = applyColors(rawCountry);
  const { visited, toggle, reset, resetAll, dates, setDate, notes, setNote, wishlist, toggleWishlist } = useVisitedRegions(countryId);

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
  const wishlistCount = isShareMode ? 0 : wishlist.size;

  const prevPct = useRef(pct);
  const prevCountryRef = useRef(countryId);
  useEffect(() => {
    const prev = prevPct.current;
    const countryChanged = prevCountryRef.current !== countryId;
    prevPct.current = pct;
    prevCountryRef.current = countryId;
    if (countryChanged || prev === pct) return;
    for (const m of MILESTONES) {
      if (prev < m && pct >= m) {
        setShowConfetti(true);
        break;
      }
    }
  }, [pct, countryId]);

  const closeModals = useCallback(() => {}, []);

  useKeyboardShortcuts({
    toggleTheme,
    countryId,
    setCountryId,
    searchRef,
    closeModals,
  });

  return (
    <div className="app">
      {!isShareMode && <AchievementToasts />}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <Onboarding />
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
        collapsed={sidebarCollapsed}
        wishlist={isShareMode ? new Set() : wishlist}
        onToggleWishlist={isShareMode ? () => {} : toggleWishlist}
        searchRef={searchRef}
      />
      <main className="map-container">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((c) => !c)}
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? '\u25B6' : '\u25C0'}
        </button>
        <RegionMap
          country={country}
          visited={displayVisited}
          onToggle={handleToggle}
          wishlist={isShareMode ? new Set() : wishlist}
          dates={isShareMode ? {} : dates}
          notes={isShareMode ? {} : notes}
        />
        {!isShareMode && <ExportButton country={country} />}

        <div className="floating-stats" style={{ '--accent': country.visitedColor }}>
          <div className="stats-card-header">
            <div className="stats-numbers">
              <span className="stats-count"><AnimatedNumber value={count} /></span>
              <span className="stats-separator">/</span>
              <span className="stats-total"><AnimatedNumber value={total} /></span>
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
          {wishlistCount > 0 && (
            <p className="stats-wishlist-count">{wishlistCount} planned</p>
          )}
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
            <AnimatedNumber value={pct} suffix="%" />
          </p>
        </div>
      </main>
    </div>
  );
}
