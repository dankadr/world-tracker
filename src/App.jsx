import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ActionSheetProvider } from './context/ActionSheetContext';
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
import StatsModal from './components/StatsModal';
import FriendsPanel from './components/FriendsPanel';
import ComparisonStats from './components/ComparisonStats';
import './components/ComparisonView.css';
import XpNotification from './components/XpNotification';
import BucketListPanel from './components/BucketListPanel';
import MapSkeleton from './components/MapSkeleton';
import { useFriends } from './context/FriendsContext';
import { useFriendsData } from './hooks/useFriendsData';
import useVisitedRegions from './hooks/useVisitedCantons';
import useVisitedCountries from './hooks/useVisitedCountries';
import useWishlist from './hooks/useWishlist';
import useCustomColors from './hooks/useCustomColors';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useDeviceType from './hooks/useDeviceType';
import useXp, { XpProvider } from './hooks/useXp';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import getAchievements from './data/achievements';
import countries from './data/countries';
import { countryList } from './data/countries';
import worldData from './data/world.json';
import './xp-styles.css';
import SwipeableModal from './components/SwipeableModal';
import BottomTabBar from './components/BottomTabBar';
import NavigationStack from './components/NavigationStack';
import GamesPanel from './components/GamesPanel';
import SocialScreen from './components/SocialScreen';
import ProfileScreen from './components/ProfileScreen';
import ExploreScreen from './components/ExploreScreen';
import AdminPanel from './components/AdminPanel';
import OfflineIndicator from './components/OfflineIndicator';
import InstallPrompt from './components/InstallPrompt';
import { useNavigation } from './context/NavigationContext';
import { emitVisitedChange } from './utils/events';
import { secureStorage } from './utils/secureStorage';
import { ADMIN_EMAIL } from './utils/adminConfig';
import { haptics } from './utils/haptics';
import useComparisonMode from './hooks/useComparisonMode';
import useShareMode from './hooks/useShareMode';
import {
  createAchievementBaseline,
  getCrossedMilestone,
  getNewlyUnlockedIds,
  markMilestoneShown,
  parseStoredIdList,
} from './utils/progressCelebrations';


function AchievementToasts() {
  const { user, cacheReady } = useAuth();
  const userId = user?.id || null;
  const seenKey = userId ? `swiss-tracker-u${userId}-achievements-seen` : 'swiss-tracker-achievements-seen';
  const [toasts, setToasts] = useState([]);
  const prevUnlocked = useRef(null);
  const { grantXpOnce, revokeXpIfGranted, XP_RULES: xpRules } = useXp();

  const checkAchievements = useCallback(() => {
    const achievements = getAchievements(userId);
    const currentUnlocked = achievements.filter((a) => a.check()).map((a) => a.id);
    const seen = parseStoredIdList(secureStorage.getItemSync(seenKey));

    if (prevUnlocked.current === null) {
      // If both seen and currentUnlocked are empty, data hasn't loaded yet.
      // Don't set an empty baseline — wait for the next visitedchange after data arrives.
      if (seen.length === 0 && currentUnlocked.length === 0) return;
      prevUnlocked.current = createAchievementBaseline(seen, currentUnlocked);
      if (seen.length === 0) {
        secureStorage.setItem(seenKey, JSON.stringify(currentUnlocked)); // fire-and-forget
      }
      return;
    }

    const newlyUnlocked = getNewlyUnlockedIds(prevUnlocked.current, currentUnlocked);
    if (newlyUnlocked.length > 0) {
      haptics.achievementUnlock();
      const newToasts = newlyUnlocked.map((id) => {
        const a = achievements.find((x) => x.id === id);
        // Grant XP once per achievement (keyed by achievement id — never double-awarded)
        grantXpOnce(`achievement:${id}`, xpRules.UNLOCK_ACHIEVEMENT, 'unlock_achievement');
        return { id, icon: a?.icon || '', title: a?.title || '', desc: a?.desc || '', ts: Date.now() + Math.random() };
      });
      setToasts((prev) => [...prev, ...newToasts]);
    }

    // Revoke XP only for achievements that were actually granted before.
    const lostIds = [...prevUnlocked.current].filter((id) => !currentUnlocked.includes(id));
    lostIds.forEach((id) => {
      revokeXpIfGranted(`achievement:${id}`, xpRules.UNLOCK_ACHIEVEMENT, 'lose_achievement');
    });

    // Always sync prevUnlocked & seen with the current state so that
    // achievements lost after unmarking a region/country are removed.
    // This lets them re-trigger a toast if re-earned later.
    prevUnlocked.current = new Set(currentUnlocked);
    secureStorage.setItem(seenKey, JSON.stringify(currentUnlocked)); // fire-and-forget
  }, [seenKey, userId, grantXpOnce, revokeXpIfGranted, xpRules]);

  useEffect(() => {
    prevUnlocked.current = null;
    setToasts([]);
  }, [seenKey]);

  useEffect(() => {
    if (userId && !cacheReady) return;
    checkAchievements();
    window.addEventListener('visitedchange', checkAchievements);
    return () => window.removeEventListener('visitedchange', checkAchievements);
  }, [checkAchievements, cacheReady, userId]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4500);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container" aria-live="assertive" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.ts} className="toast-achievement" role="alert">
          <span className="toast-icon">{t.icon}</span>
          <div className="toast-text">
            <span className="toast-label">Achievement Unlocked!</span>
            <span className="toast-title">{t.title}</span>
            <span className="toast-desc">{t.desc}</span>
          </div>
          <button className="toast-close" onClick={() => setToasts((prev) => prev.filter((x) => x.ts !== t.ts))} aria-label="Dismiss notification">&times;</button>
        </div>
      ))}
    </div>,
    document.body
  );
}

const MILESTONES = [25, 50, 75, 100];

export default function App() {
  const [view, setView] = useState('world'); // 'world' | 'detail'
  const isWorldView = view === 'world';
  const [countryId, setCountryId] = useState('ch');
  const { isShareMode, exitShareMode, getSharedVisited } = useShareMode({ setView, setCountryId });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEasterEggPrompt, setShowEasterEggPrompt] = useState(false);
  const { applyColors, setColor, colors } = useCustomColors();
  const { toggle: toggleTheme } = useTheme();
  const searchRef = useRef(null);
  const { token, isLoggedIn, user, isSyncingLocalData } = useAuth();
  const userId = user?.id || null;
  const { isMobile, isTablet, isTouch, isPortrait } = useDeviceType();
  const { activeTab, switchTab, push, pop } = useNavigation();

  const rawCountry = countries[countryId];
  const country = applyColors(rawCountry);
  const { visited, toggle, reset, resetAll, dates, setDate, notes, setNote, wishlist, toggleWishlist, isLoading: regionsLoading } = useVisitedRegions(countryId);
  const { visited: worldVisited, toggleCountry: toggleWorldCountry, isLoading: worldLoading } = useVisitedCountries();
  const isDataLoading = regionsLoading || worldLoading || isSyncingLocalData;
  const { grantXpOnce, revokeXpIfGranted, XP_RULES: xpRules } = useXp();
  const {
    items: bucketListItems,
    addToWishlist,
    updateItem: updateBucketItem,
    removeFromWishlist,
    isInWishlist,
  } = useWishlist();
  const [showBucketList, setShowBucketList] = useState(false);
  const [pendingBucketVisit, setPendingBucketVisit] = useState(null);
  const worldWishlist = useMemo(
    () => new Set(bucketListItems.filter((i) => i.tracker_id === 'world').map((i) => i.region_id)),
    [bucketListItems]
  );
  const regionWishlist = useMemo(
    () => new Set(bucketListItems.filter((i) => i.tracker_id === countryId).map((i) => i.region_id)),
    [bucketListItems, countryId]
  );

  // XP-granting wrappers
  const handleToggleRegion = useCallback((regionId) => {
    const wasVisited = visited.has(regionId);
    haptics.visitToggle(wasVisited);
    toggle(regionId);
    if (!wasVisited) {
      grantXpOnce(`region:${countryId}:${regionId}`, xpRules.VISIT_REGION, 'visit_region', countryId);
      grantXpOnce(`first_tracker:${countryId}`, xpRules.FIRST_TRACKER_VISIT, 'first_tracker_visit', countryId);
    } else {
      revokeXpIfGranted(`region:${countryId}:${regionId}`, xpRules.VISIT_REGION, 'unvisit_region', countryId);
      // If this was the last region before unmark, revoke first-tracker bonus.
      if (visited.size === 1) {
        revokeXpIfGranted(`first_tracker:${countryId}`, xpRules.FIRST_TRACKER_VISIT, 'unvisit_first_tracker', countryId);
      }
    }
    emitVisitedChange();
  }, [toggle, visited, grantXpOnce, revokeXpIfGranted, xpRules, countryId]);

  const handleToggleWishlist = useCallback((regionId) => {
    const wasWishlisted = regionWishlist.has(regionId);
    if (wasWishlisted && isInWishlist(countryId, regionId)) {
      removeFromWishlist(countryId, regionId);
    }
  }, [regionWishlist, isInWishlist, removeFromWishlist, countryId]);

  const wishlistStorageKey = useCallback((trackerId) => {
    return `${userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-'}wishlist-${trackerId}`;
  }, [userId]);

  const removeLegacyWishlistEntry = useCallback((trackerId, regionId) => {
    try {
      const key = wishlistStorageKey(trackerId);
      const raw = secureStorage.getItemSync(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const next = arr.filter((id) => id !== regionId);
          secureStorage.setItem(key, JSON.stringify(next));
        }
      }
    } catch { /* ignore */ }

    if (isLoggedIn && token) {
      fetch(`/api/visited/${trackerId}/wishlist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ region: regionId, action: 'remove' }),
      }).catch(() => {});
    }
  }, [wishlistStorageKey, isLoggedIn, token]);

  const handleDeleteBucketItem = useCallback((trackerId, regionId) => {
    removeFromWishlist(trackerId, regionId);
    if (trackerId === 'world') return;
    if (trackerId === countryId) {
      if (wishlist.has(regionId)) handleToggleWishlist(regionId);
      return;
    }
    removeLegacyWishlistEntry(trackerId, regionId);
  }, [removeFromWishlist, countryId, wishlist, handleToggleWishlist, removeLegacyWishlistEntry]);

  const handleAddToBucketList = useCallback((trackerId, regionId, opts) => {
    addToWishlist(trackerId, regionId, opts);
  }, [addToWishlist]);

  const handleMarkVisitedBucketList = useCallback((trackerId, regionId) => {
    if (trackerId === 'world') {
      toggleWorldCountry(regionId);
      removeFromWishlist(trackerId, regionId);
      return;
    }

    if (trackerId === countryId) {
      if (!visited.has(regionId)) {
        handleToggleRegion(regionId);
      }
      if (wishlist.has(regionId)) {
        handleToggleWishlist(regionId);
      }
      removeFromWishlist(trackerId, regionId);
      return;
    }

    setPendingBucketVisit({ trackerId, regionId });
    setCountryId(trackerId);
    setView('detail');
    if (isMobile) {
      pop();
    } else {
      setShowBucketList(false);
    }
  }, [countryId, handleToggleRegion, handleToggleWishlist, removeFromWishlist, toggleWorldCountry, visited, wishlist, isMobile, pop]);

  useEffect(() => {
    if (!pendingBucketVisit) return;
    if (pendingBucketVisit.trackerId !== countryId) return;

    const { regionId, trackerId } = pendingBucketVisit;
    if (!visited.has(regionId)) {
      handleToggleRegion(regionId);
    }
    if (wishlist.has(regionId)) {
      handleToggleWishlist(regionId);
    }
    removeFromWishlist(trackerId, regionId);
    setPendingBucketVisit(null);
  }, [pendingBucketVisit, countryId, visited, wishlist, handleToggleRegion, handleToggleWishlist, removeFromWishlist]);

  const handleToggleWorldCountry = useCallback((countryCode) => {
    const wasVisited = worldVisited.has(countryCode);
    haptics.visitToggle(wasVisited);
    toggleWorldCountry(countryCode);
    if (!wasVisited) {
      grantXpOnce(`world:${countryCode}`, xpRules.VISIT_COUNTRY, 'visit_country', 'world');
    } else {
      revokeXpIfGranted(`world:${countryCode}`, xpRules.VISIT_COUNTRY, 'unvisit_country', 'world');
    }
    emitVisitedChange();
  }, [toggleWorldCountry, worldVisited, grantXpOnce, revokeXpIfGranted, xpRules]);

  // Friends state
  const { friends, pendingCount } = useFriends();
  const { friendOverlayData, loadOverlayData, loadFriendVisited, clearCache } = useFriendsData();
  const [showFriends, setShowFriends] = useState(false);
  const [friendsActive, setFriendsActive] = useState(false);
  const {
    comparisonFriend,
    showComparisonStats,
    openComparisonStats,
    closeComparisonStats,
    doCompare,
    exitComparison: handleExitComparison,
  } = useComparisonMode({ countryId, loadFriendVisited });

  // Load/clear friend overlay data when toggled
  useEffect(() => {
    if (friendsActive && friends.length > 0) {
      loadOverlayData(friends);
    } else if (!friendsActive) {
      clearCache();
    }
  }, [friendsActive, friends]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFriendsToggle = useCallback((active) => {
    setFriendsActive(active);
  }, []);

  const handleOpenFriends = useCallback(() => {
    if (isMobile) {
      switchTab('social');
    } else {
      setShowFriends(true);
    }
  }, [isMobile, switchTab]);

  const handleCloseFriends = useCallback(() => {
    if (isMobile) {
      switchTab('map');
    } else {
      setShowFriends(false);
    }
  }, [isMobile, switchTab]);
  const handleCloseBucketList = useCallback(() => setShowBucketList(false), []);
  const handleCloseComparisonStats = closeComparisonStats;

  // Comparison handlers
  const handleCompare = useCallback(async (friend) => {
    if (!friend) {
      handleExitComparison();
      return;
    }
    const loaded = await doCompare(friend);
    if (!loaded) return;

    if (isMobile) {
      switchTab('map');
    } else {
      setShowFriends(false);
    }
  }, [doCompare, handleExitComparison, isMobile, switchTab]);

  const handleExploreCountry = useCallback((id) => {
    setCountryId(id);
    setView('detail');
  }, []);

  const handleBackToWorld = useCallback(() => {
    setView('world');
  }, []);

  const handleOpenStats = useCallback(() => {
    if (isMobile && !isShareMode) {
      push('stats');
      return;
    }
    setPeekStatsOpen(true);
  }, [isMobile, isShareMode, push]);
  const handleOpenBucketList = useCallback(() => {
    if (isMobile && !isShareMode) {
      push('bucketList', {
        items: bucketListItems,
        onUpdate: updateBucketItem,
        onDelete: handleDeleteBucketItem,
        onMarkVisited: handleMarkVisitedBucketList,
      });
      return;
    }
    setShowBucketList(true);
  }, [isMobile, isShareMode, push, bucketListItems, updateBucketItem, handleDeleteBucketItem, handleMarkVisitedBucketList]);
  const handleOpenComparisonStats = useCallback(() => {
    if (!comparisonFriend) return;
    if (isMobile && !isShareMode) {
      push('comparisonStats', {
        myVisited: isWorldView ? worldVisited : visited,
        friendVisited: isWorldView ? comparisonFriend.visited : new Set(comparisonFriend.visitedRegions || []),
        total: isWorldView ? worldData.features.length : country.data.features.filter((f) => !f.properties.isBorough).length,
        friendName: comparisonFriend.name,
        friendPicture: comparisonFriend.picture,
        regionLabel: isWorldView ? 'Countries' : country.regionLabel,
      });
      return;
    }
    openComparisonStats();
  }, [comparisonFriend, isMobile, isShareMode, push, isWorldView, worldVisited, visited, country, openComparisonStats]);
  const sharedVisited = getSharedVisited(countryId);

  const displayVisited = isShareMode ? (sharedVisited || new Set()) : visited;
  const handleToggle = isShareMode ? () => {} : handleToggleRegion;

  const regionList = country.data.features.filter((f) => !f.properties.isBorough);
  const total = regionList.length;
  const count = displayVisited.size;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const wishlistCount = isShareMode ? 0 : regionWishlist.size;

  const prevPct = useRef(pct);
  const prevCountryRef = useRef(countryId);
  const confettiKey = useMemo(
    () => (userId ? `swiss-tracker-u${userId}-confetti-milestones` : 'swiss-tracker-confetti-milestones'),
    [userId]
  );
  const shownMilestonesRef = useRef(new Set());
  const prevIsLoadingRef = useRef(isDataLoading);

  useEffect(() => {
    shownMilestonesRef.current = new Set(parseStoredIdList(secureStorage.getItemSync(confettiKey)));
  }, [confettiKey]);

  // Snap prevPct when data finishes loading so the 0→actual% jump after server
  // sync doesn't cross a milestone threshold. Must run before the milestone effect.
  useEffect(() => {
    if (prevIsLoadingRef.current && !isDataLoading) {
      prevPct.current = pct;
      prevCountryRef.current = countryId;
    }
    prevIsLoadingRef.current = isDataLoading;
  }, [isDataLoading, pct, countryId]);
  useEffect(() => {
    const prev = prevPct.current;
    const countryChanged = prevCountryRef.current !== countryId;
    prevPct.current = pct;
    prevCountryRef.current = countryId;
    if (countryChanged || prev === pct) return;

    const crossedMilestone = getCrossedMilestone(prev, pct, MILESTONES);
    if (!crossedMilestone) return;

    const nextMilestoneState = markMilestoneShown(shownMilestonesRef.current, countryId, crossedMilestone);
    shownMilestonesRef.current = nextMilestoneState.shownMilestones;
    if (nextMilestoneState.shouldFire) {
      secureStorage.setItem(confettiKey, JSON.stringify([...nextMilestoneState.shownMilestones])); // fire-and-forget
      setShowConfetti(true);
    }
  }, [pct, countryId, confettiKey]);

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

  const [sheetExpandTo, setSheetExpandTo] = useState(null);
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

  const handleSearchFocus = useCallback(() => {
    if (isMobile) setSheetExpandTo(50);
  }, [isMobile]);

  const handleSheetSnap = useCallback((snapVal) => {
    // Reset expandTo after snap completes so it can be triggered again
    setSheetExpandTo(null);
  }, []);

  // Pill button handlers for bottom sheet peek
  const handlePeekSearch = useCallback(() => {
    setSheetExpandTo(50);
    // Focus the search input after sheet expands
    setTimeout(() => searchRef.current?.focus(), 400);
  }, [searchRef]);

  const [peekStatsOpen, setPeekStatsOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);

  return (
    <ActionSheetProvider>
    <div className={`app ${isMobile ? 'is-mobile' : ''} ${isTablet && isTouch ? 'touch-tablet' : ''} ${isTablet && isPortrait ? 'tablet-portrait' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineIndicator />
      {!isShareMode && <InstallPrompt />}
      {!isShareMode && <AchievementToasts />}
      {!isShareMode && <XpNotification />}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <EasterEggPrompt isOpen={showEasterEggPrompt} onClose={() => setShowEasterEggPrompt(false)} />
      <Onboarding />
      {isShareMode && (
        <div className="share-banner">
          Viewing shared progress &mdash;
          <button className="share-banner-btn" onClick={exitShareMode}>Exit</button>
        </div>
      )}

      {isDataLoading ? (
        <main id="main-content" className="map-container">
          <MapSkeleton />
        </main>
      ) : isWorldView ? (
        <>
          {isMobile ? (
            activeTab === 'map' && (
              <MobileBottomSheet
                expandTo={sheetExpandTo}
                onSnapChange={handleSheetSnap}
                peekContent={
                  <div className="sheet-peek-header">
                    <div className="sheet-peek-info">
                      <span className="sheet-peek-icon">🌍</span>
                      <div className="sheet-peek-text">
                        <span className="sheet-peek-title">{worldVisited.size} / {worldData.features.length} countries</span>
                        <span className="sheet-peek-subtitle">{Math.round((worldVisited.size / worldData.features.length) * 100)}% of the world</span>
                      </div>
                    </div>
                    <div className="sheet-peek-progress">
                      <div
                        className="sheet-peek-progress-fill"
                        style={{
                          width: `${Math.round((worldVisited.size / worldData.features.length) * 100)}%`,
                          background: 'linear-gradient(90deg, #c9a84c, #d4b866)',
                        }}
                      />
                    </div>
                    <div className="sheet-peek-pills">
                      <button className="sheet-pill" onClick={(e) => { e.stopPropagation(); handlePeekSearch(); }}>🔍 Search</button>
                      <button className="sheet-pill" onClick={(e) => { e.stopPropagation(); handleOpenStats(); }}>📊 Stats</button>
                      <button className="sheet-pill" onClick={(e) => { e.stopPropagation(); push('games', { worldVisited }); }}>🎮 Games</button>
                    </div>
                  </div>
                }
              >
                <WorldSidebar
                  visited={worldVisited}
                  onToggle={handleToggleWorldCountry}
                  onExploreCountry={handleExploreCountry}
                  collapsed={false}
                  onOpenFriends={handleOpenFriends}
                  friendsPendingCount={pendingCount}
                  isMobile={isMobile}
                  onResetAll={resetAll}
                  onShowOnboarding={() => {
                    localStorage.removeItem('onboarding-dismissed');
                    window.location.reload();
                  }}
                />
              </MobileBottomSheet>
            )
          ) : (
            <WorldSidebar
              visited={worldVisited}
              onToggle={handleToggleWorldCountry}
              onExploreCountry={handleExploreCountry}
              collapsed={sidebarCollapsed}
              onOpenFriends={handleOpenFriends}
              friendsPendingCount={pendingCount}
              isMobile={isMobile}
              onResetAll={resetAll}
              onShowOnboarding={() => {
                localStorage.removeItem('onboarding-dismissed');
                window.location.reload();
              }}
            />
          )}
          <main
            id="main-content"
            className="map-container"
            onTouchStart={handleLongPressStart}
            onTouchMove={handleLongPressMove}
            onTouchEnd={clearLongPress}
            onTouchCancel={clearLongPress}
          >
            {!isMobile && (
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed((c) => !c)}
                title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                <span aria-hidden="true">{sidebarCollapsed ? '\u25B6' : '\u25C0'}</span>
              </button>
            )}
            <WorldMap
              visited={worldVisited}
              onToggle={handleToggleWorldCountry}
              friendsActive={friendsActive}
              onFriendsToggle={handleFriendsToggle}
              friendOverlayData={friendOverlayData}
              comparisonFriend={comparisonFriend}
              onExitComparison={handleExitComparison}
              wishlist={worldWishlist}
              comparisonMode={!!comparisonFriend}
            />
            {!isMobile && (
              <div className="floating-stats world-floating-stats" style={{ '--accent': '#d4b866' }}>
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
                      background: 'linear-gradient(90deg, #c9a84c, #d4b866)',
                    }}
                  />
                </div>
                <p className="stats-pct" style={{ color: '#d4b866' }}>
                  <AnimatedNumber value={Math.round((worldVisited.size / worldData.features.length) * 100)} suffix="%" />
                </p>
              </div>
            )}
            {!isShareMode && !isMobile && (
              <div className="map-action-buttons">
                <button className="map-action-btn" onClick={() => setGamesOpen(true)} title="Geography Games" aria-label="Open geography games" data-testid="open-geography-games">
                  🎮
                </button>
              </div>
            )}
            {comparisonFriend && (
              <button className="comparison-stats-trigger" onClick={handleOpenComparisonStats}>
                📊 Compare Stats
              </button>
            )}
          </main>
        </>
      ) : (
        <>
          {isMobile ? (
            activeTab === 'map' && (
            <MobileBottomSheet
              expandTo={sheetExpandTo}
              onSnapChange={handleSheetSnap}
              peekContent={
                <div className="sheet-peek-header">
                  <div className="sheet-peek-info">
                    <span className="sheet-peek-icon">{country.flag}</span>
                    <div className="sheet-peek-text">
                      <span className="sheet-peek-title">{count} / {total} {country.regionLabel.toLowerCase()}</span>
                      <span className="sheet-peek-subtitle" style={{ color: country.visitedColor }}>{pct}% visited{wishlistCount > 0 ? ` · ${wishlistCount} planned` : ''}</span>
                    </div>
                  </div>
                  <div className="sheet-peek-progress">
                    <div
                      className="sheet-peek-progress-fill"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${country.visitedColor}, ${country.visitedHover})`,
                      }}
                    />
                  </div>
                  <div className="sheet-peek-pills">
                    <button className="sheet-pill" onClick={(e) => { e.stopPropagation(); handlePeekSearch(); }}>🔍 Search</button>
                    <button className="sheet-pill" onClick={(e) => { e.stopPropagation(); handleOpenStats(); }}>📊 Stats</button>
                  </div>
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
                onToggleWishlist={isShareMode ? () => {} : handleToggleWishlist}
                onOpenBucketList={isShareMode ? null : handleOpenBucketList}
                bucketListItems={isShareMode ? [] : bucketListItems}
                onAddToBucketList={isShareMode ? null : handleAddToBucketList}
                searchRef={searchRef}
                onBackToWorld={handleBackToWorld}
                onSearchFocus={handleSearchFocus}
                onOpenFriends={handleOpenFriends}
                friendsPendingCount={pendingCount}
                isMobile={isMobile}
                onShowOnboarding={() => {
                  localStorage.removeItem('onboarding-dismissed');
                  window.location.reload();
                }}
              />
            </MobileBottomSheet>
            )
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
              onToggleWishlist={isShareMode ? () => {} : handleToggleWishlist}
              onOpenBucketList={isShareMode ? null : handleOpenBucketList}
              bucketListItems={isShareMode ? [] : bucketListItems}
              onAddToBucketList={isShareMode ? null : handleAddToBucketList}
              searchRef={searchRef}
              onBackToWorld={handleBackToWorld}
              onOpenFriends={handleOpenFriends}
              friendsPendingCount={pendingCount}
              isMobile={isMobile}
              onShowOnboarding={() => {
                localStorage.removeItem('onboarding-dismissed');
                window.location.reload();
              }}
            />
          )}
          <main id="main-content" className="map-container">
            {!isMobile && (
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed((c) => !c)}
                title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                <span aria-hidden="true">{sidebarCollapsed ? '\u25B6' : '\u25C0'}</span>
              </button>
            )}
            <RegionMap
              country={country}
              visited={displayVisited}
              onToggle={handleToggle}
              wishlist={isShareMode ? new Set() : regionWishlist}
              dates={isShareMode ? {} : dates}
              notes={isShareMode ? {} : notes}
              friendsActive={friendsActive}
              onFriendsToggle={handleFriendsToggle}
              friendOverlayData={friendOverlayData}
              comparisonFriend={comparisonFriend}
              onExitComparison={handleExitComparison}
              comparisonMode={!!comparisonFriend}
            />
            {!isShareMode && !isMobile && <ExportButton country={country} />}
            {!isMobile && !isShareMode && (
              <div className="map-action-buttons">
                <button className="map-action-btn" onClick={() => setGamesOpen(true)} title="Geography Games" aria-label="Open geography games" data-testid="open-geography-games">
                  🎮
                </button>
              </div>
            )}
            {isMobile && !isShareMode && (
              <div className="map-controls-cluster">
                <ExportButton country={country} />
                <button
                  className="map-action-btn"
                  onClick={() => push('games', { worldVisited })}
                  title="Geography Games"
                  aria-label="Open geography games"
                  data-testid="open-geography-games"
                >
                  🎮
                </button>
              </div>
            )}

            {!isMobile && (
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
            )}
            {comparisonFriend && (
              <button className="comparison-stats-trigger" onClick={handleOpenComparisonStats}>
                📊 Compare Stats
              </button>
            )}
          </main>
        </>
      )}
      {peekStatsOpen && (!isMobile || isShareMode) && <StatsModal onClose={() => setPeekStatsOpen(false)} />}

      {/* Mobile tab screens — full-screen overlays over the map */}
      {isMobile && !isShareMode && activeTab === 'social' && (
        <SocialScreen onCompare={handleCompare} comparisonFriendId={comparisonFriend?.id} />
      )}
      {isMobile && !isShareMode && activeTab === 'explore' && (
        <ExploreScreen
          worldVisited={worldVisited}
          onToggleWorld={handleToggleWorldCountry}
          onExploreCountry={handleExploreCountry}
          onOpenWorld={handleBackToWorld}
        />
      )}
      {isMobile && !isShareMode && activeTab === 'profile' && (
        <ProfileScreen onReset={reset} onResetAll={resetAll} />
      )}
      {isMobile && !isShareMode && activeTab === 'admin' && (
        <div className="tab-screen">
          <AdminPanel />
        </div>
      )}

      {/* Pushed screens — rendered on top of whatever tab is active */}
      {isMobile && !isShareMode && <NavigationStack />}

      {!isMobile && gamesOpen && (
        <div className="tab-screen" style={{ zIndex: 1300 }}>
          <GamesPanel worldVisited={worldVisited} onClose={() => setGamesOpen(false)} />
        </div>
      )}

      {/* Desktop-only Friends modal (mobile uses Social tab) */}
      {!isMobile && showFriends && (
        <SwipeableModal
          onClose={handleCloseFriends}
          className="friends-modal"
          height="70vh"
        >
          <FriendsPanel onClose={handleCloseFriends} onCompare={handleCompare} comparisonFriendId={comparisonFriend?.id} />
        </SwipeableModal>
      )}

      {/* Bottom tab bar (mobile only, not in share mode) */}
      {isMobile && !isShareMode && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={switchTab}
          socialBadge={pendingCount}
          isAdmin={user?.email === ADMIN_EMAIL}
        />
      )}

      {!isMobile && showBucketList && (
        <SwipeableModal
          onClose={handleCloseBucketList}
          className="bucket-panel-modal"
          maxWidth={620}
          height="80vh"
        >
          <BucketListPanel
            items={bucketListItems}
            onUpdate={updateBucketItem}
            onDelete={handleDeleteBucketItem}
            onMarkVisited={handleMarkVisitedBucketList}
            onClose={handleCloseBucketList}
          />
        </SwipeableModal>
      )}
      {!isMobile && showComparisonStats && comparisonFriend && (
        <SwipeableModal onClose={handleCloseComparisonStats} height="90vh">
          <ComparisonStats
            myVisited={isWorldView ? worldVisited : visited}
            friendVisited={isWorldView ? comparisonFriend.visited : new Set(comparisonFriend.visitedRegions || [])}
            total={isWorldView ? worldData.features.length : country.data.features.filter((f) => !f.properties.isBorough).length}
            friendName={comparisonFriend.name}
            friendPicture={comparisonFriend.picture}
            regionLabel={isWorldView ? 'Countries' : country.regionLabel}
            onClose={handleCloseComparisonStats}
          />
        </SwipeableModal>
      )}
      <Analytics />
      <SpeedInsights />
    </div>
    </ActionSheetProvider>
  );
}
