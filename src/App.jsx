import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import RegionMap from './components/SwissMap';
import Sidebar from './components/Sidebar';
import WorldMap from './components/WorldMap';
import WorldSidebar from './components/WorldSidebar';
import ExportButton from './components/ExportButton';
import Confetti from './components/Confetti';
import AnimatedNumber from './components/AnimatedNumber';
import Onboarding from './components/Onboarding';
import MobileBottomSheet from './components/MobileBottomSheet';
import EasterEggPrompt from './components/EasterEggPrompt';
import useVisitedRegions from './hooks/useVisitedCantons';
import useVisitedCountries from './hooks/useVisitedCountries';
import useCustomColors from './hooks/useCustomColors';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useDeviceType from './hooks/useDeviceType';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import getAchievements from './data/achievements';
import countries from './data/countries';
import { countryList } from './data/countries';
import worldData from './data/world.json';

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
  const [view, setView] = useState('world'); // 'world' | 'detail'
  const [countryId, setCountryId] = useState('ch');
  const [shareData, setShareData] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEasterEggPrompt, setShowEasterEggPrompt] = useState(false);
  const { applyColors, setColor, colors } = useCustomColors();
  const { toggle: toggleTheme } = useTheme();
  const searchRef = useRef(null);

  const rawCountry = countries[countryId];
  const country = applyColors(rawCountry);
  const { visited, toggle, reset, resetAll, dates, setDate, notes, setNote, wishlist, toggleWishlist } = useVisitedRegions(countryId);
  const { visited: worldVisited, toggleCountry: toggleWorldCountry } = useVisitedCountries();

  const handleExploreCountry = useCallback((id) => {
    setCountryId(id);
    setView('detail');
  }, []);

  const handleBackToWorld = useCallback(() => {
    setView('world');
  }, []);

  useEffect(() => {
    const data = parseShareHash();
    if (data) {
      setShareData(data);
      setView('detail');
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

  const handleOpenEasterEggPrompt = useCallback(() => {
    setShowEasterEggPrompt(true);
  }, []);

  useKeyboardShortcuts({
    toggleTheme,
    countryId,
    setCountryId,
    searchRef,
    closeModals,
    onOpenEasterEggPrompt: handleOpenEasterEggPrompt,
  });

  const { isMobile } = useDeviceType();
  const isWorldView = view === 'world' && !isShareMode;
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  const handleLongPressStart = useCallback((e) => {
    if (!isMobile || !isWorldView) return;
    if (e.touches && e.touches.length !== 1) return;
    const touch = e.touches ? e.touches[0] : e;
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      setShowEasterEggPrompt(true);
      clearLongPress();
    }, 2000);
  }, [clearLongPress, isMobile, isWorldView]);

  const handleLongPressMove = useCallback((e) => {
    if (!longPressStartRef.current || !e.touches?.length) return;
    const touch = e.touches[0];
    const dx = touch.clientX - longPressStartRef.current.x;
    const dy = touch.clientY - longPressStartRef.current.y;
    if (Math.hypot(dx, dy) > 12) {
      clearLongPress();
    }
  }, [clearLongPress]);

  return (
    <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
      {!isShareMode && <AchievementToasts />}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <EasterEggPrompt isOpen={showEasterEggPrompt} onClose={() => setShowEasterEggPrompt(false)} />
      <Onboarding />
      {isShareMode && (
        <div className="share-banner">
          Viewing shared progress &mdash;
          <button className="share-banner-btn" onClick={exitShareMode}>Exit</button>
        </div>
      )}

      {isWorldView ? (
        <>
          {isMobile ? (
            <MobileBottomSheet
              miniContent={
                <div className="sheet-mini-stats">
                  <span className="sheet-mini-icon">🌍</span>
                  <span className="sheet-mini-text">{worldVisited.size} countries</span>
                  <span className="sheet-mini-expand">TAP TO EXPAND</span>
                </div>
              }
            >
              <WorldSidebar
                visited={worldVisited}
                onToggle={toggleWorldCountry}
                onExploreCountry={handleExploreCountry}
                collapsed={false}
              />
            </MobileBottomSheet>
          ) : (
            <WorldSidebar
              visited={worldVisited}
              onToggle={toggleWorldCountry}
              onExploreCountry={handleExploreCountry}
              collapsed={sidebarCollapsed}
            />
          )}
          <main
            className="map-container"
            onTouchStart={handleLongPressStart}
            onTouchMove={handleLongPressMove}
            onTouchEnd={clearLongPress}
            onTouchCancel={clearLongPress}
          >
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              {sidebarCollapsed ? '\u25B6' : '\u25C0'}
            </button>
            <WorldMap
              visited={worldVisited}
              onToggle={toggleWorldCountry}
              onExploreCountry={handleExploreCountry}
            />
            <div className="floating-stats world-floating-stats" style={{ '--accent': '#2ecc71' }}>
              <div className="stats-card-header">
                <div className="stats-numbers">
                  <span className="stats-count"><AnimatedNumber value={worldVisited.size} /></span>
                  <span className="stats-separator">/</span>
                  <span className="stats-total">{worldData.features.length}</span>
                </div>
              </div>
              <p className="stats-label">countries visited</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.round((worldVisited.size / worldData.features.length) * 100)}%`,
                    background: 'linear-gradient(90deg, #2ecc71, #27ae60)',
                  }}
                />
              </div>
              <p className="stats-pct" style={{ color: '#2ecc71' }}>
                <AnimatedNumber value={Math.round((worldVisited.size / worldData.features.length) * 100)} suffix="%" />
              </p>
            </div>
          </main>
        </>
      ) : (
        <>
          {isMobile ? (
            <MobileBottomSheet
              miniContent={
                <div className="sheet-mini-stats">
                  <span className="sheet-mini-icon">{country.flag}</span>
                  <span className="sheet-mini-text">{count}/{total} {country.regionLabel.toLowerCase()}</span>
                  <span className="sheet-mini-pct" style={{ color: country.visitedColor }}>{pct}%</span>
                  <span className="sheet-mini-expand">TAP TO EXPAND</span>
                </div>
              }
            >
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
                collapsed={false}
                wishlist={isShareMode ? new Set() : wishlist}
                onToggleWishlist={isShareMode ? () => {} : toggleWishlist}
                searchRef={searchRef}
                onBackToWorld={handleBackToWorld}
                isMobile={true}
              />
            </MobileBottomSheet>
          ) : (
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
              onBackToWorld={handleBackToWorld}
            />
          )}
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
        </>
      )}
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
