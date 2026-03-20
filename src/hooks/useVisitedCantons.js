import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { countryList } from '../data/countries';
import { fetchAllVisited, invalidateBulkCache, deleteAllVisited } from '../utils/api';
import { cacheGet, cacheGetStale } from '../utils/cache';
import { addToBatch } from '../utils/batchQueue';
import { emitVisitedChange } from '../utils/events';
import { secureStorage } from '../utils/secureStorage';

const VISITED_TTL = 5 * 60 * 1000;

// --------------- localStorage helpers ---------------
// Keys are scoped per-user so different Google accounts don't share data.
// Logged-in:  swiss-tracker-u{userId}-visited-{countryId}
// Anonymous:  swiss-tracker-visited-{countryId}

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadLocal(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveLocal(countryId, set, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'visited-' + countryId, JSON.stringify([...set]));
}

function loadDates(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'dates-' + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveDates(countryId, dates, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'dates-' + countryId, JSON.stringify(dates));
}

function loadNotes(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'notes-' + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveNotes(countryId, notes, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'notes-' + countryId, JSON.stringify(notes));
}

function loadWishlist(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'wishlist-' + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveWishlist(countryId, set, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'wishlist-' + countryId, JSON.stringify([...set]));
}

// --------------- API helpers ---------------
async function fetchVisited(countryId, token) {
  const res = await fetch(`/api/visited/${countryId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    regions: new Set(data.regions || []),
    dates: data.dates || {},
    notes: data.notes || {},
    wishlist: new Set(data.wishlist || []),
  };
}

async function saveVisitedRemote(countryId, set, token, dates, notes, wishlist) {
  try {
    const body = { regions: [...set] };
    if (dates !== undefined) body.dates = dates;
    if (notes !== undefined) body.notes = notes;
    if (wishlist !== undefined) body.wishlist = [...wishlist];
    const res = await fetch(`/api/visited/${countryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`saveVisitedRemote PUT failed: ${res.status}`);
  } catch (err) { console.error('saveVisitedRemote network error:', err); }
}


async function toggleWishlistRemote(countryId, regionId, action, token) {
  try {
    const res = await fetch(`/api/visited/${countryId}/wishlist`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ region: regionId, action }),
    });
    if (!res.ok) console.error(`toggleWishlistRemote PATCH failed: ${res.status}`);
  } catch (err) { console.error('toggleWishlistRemote network error:', err); }
}

// --------------- Debounce helper ---------------
const DEBOUNCE_MS = 800;

// --------------- Hook ---------------
/**
 * Try to extract region data from the stale bulk cache for instant rendering.
 * Falls back to per-country localStorage if no bulk cache exists.
 */
function initFromCache(countryId, token, userId) {
  if (token) {
    const cKey = `visited-all:${token.slice(-16)}`;
    const bulk = cacheGetStale(cKey);
    if (bulk) {
      const cd = bulk.regions?.[countryId];
      return {
        visited: new Set(cd?.regions || []),
        dates: cd?.dates || {},
        notes: cd?.notes || {},
        wishlist: new Set(cd?.wishlist || []),
      };
    }
  }
  // Fall back to per-country localStorage
  if (userId) {
    return {
      visited: loadLocal(countryId, userId),
      dates: loadDates(countryId, userId),
      notes: loadNotes(countryId, userId),
      wishlist: loadWishlist(countryId, userId),
    };
  }
  return { visited: new Set(), dates: {}, notes: {}, wishlist: new Set() };
}

export default function useVisitedRegions(countryId) {
  const { token, isLoggedIn, user, isSyncingLocalData } = useAuth();
  const userId = user?.id || null;
  const initial = initFromCache(countryId, token, userId);
  const [visited, setVisited] = useState(() => initial.visited);
  const [dates, setDatesState] = useState(() => initial.dates);
  const [notes, setNotesState] = useState(() => initial.notes);
  const [wishlist, setWishlist] = useState(() => initial.wishlist);
  const [isLoading, setIsLoading] = useState(() => (initial.visited.size === 0 && isLoggedIn) || isSyncingLocalData);
  const [currentCountry, setCurrentCountry] = useState(countryId);
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

  // Debounce state for saveVisitedRemote
  const debounceTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);

  // Refs for stable access inside callbacks / state updaters
  const visitedRef = useRef(visited);
  const datesRef = useRef(dates);
  const notesRef = useRef(notes);
  const wishlistRef = useRef(wishlist);
  visitedRef.current = visited;
  datesRef.current = dates;
  notesRef.current = notes;
  wishlistRef.current = wishlist;

  // When country or user changes, reload from the correct localStorage keys
  if (countryId !== currentCountry || userId !== currentUserId) {
    setCurrentCountry(countryId);
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadLocal(countryId, userId));
      setDatesState(loadDates(countryId, userId));
      setNotesState(loadNotes(countryId, userId));
      setWishlist(loadWishlist(countryId, userId));
    } else {
      setVisited(new Set());
      setDatesState({});
      setNotesState({});
      setWishlist(new Set());
    }
  }

  useEffect(() => {
    // Use visitedRef.current (the actual current visited state after the render-time
    // reset) rather than initFromCache. initFromCache reads the stale bulk cache which
    // can contain data for the new country even though visited was just reset to empty
    // by loadLocal (which returns empty on fresh devices where memCache isn't populated).
    // Using the stale cache size would set isLoading=false while visited is still empty,
    // causing Leaflet to mount with blank data before the sync effect corrects it.
    setIsLoading(isSyncingLocalData || (visitedRef.current.size === 0 && isLoggedIn));
  }, [countryId, isLoggedIn, isSyncingLocalData, token, userId]);

  // Debounced save: batches rapid PUT calls into a single request
  const debouncedSaveRemote = useCallback(
    (cId, set, tok, d, n, w) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      pendingSaveRef.current = { cId, set, tok, d, n, w };
      debounceTimerRef.current = setTimeout(() => {
        saveVisitedRemote(cId, set, tok, d, n, w);
        pendingSaveRef.current = null;
        invalidateBulkCache(tok);
      }, DEBOUNCE_MS);
    },
    []
  );

  // Flush pending debounced save on page close
  useEffect(() => {
    const flush = () => {
      if (pendingSaveRef.current) {
        const { cId, set, tok, d, n, w } = pendingSaveRef.current;
        // Use keepalive so the request outlives the page
        const body = { regions: [...set] };
        if (d !== undefined) body.dates = d;
        if (n !== undefined) body.notes = n;
        if (w !== undefined) body.wishlist = [...w];
        fetch(`/api/visited/${cId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify(body),
          keepalive: true,
        });
        pendingSaveRef.current = null;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  // Sync from server when logged in (bulk endpoint) — background only
  useEffect(() => {
    if (!isLoggedIn || !token || isSyncingLocalData) return;
    let cancelled = false;

    fetchAllVisited(token).then((bulk) => {
      if (cancelled || !bulk) return;
      const countryData = bulk.regions[countryId];
      const remote = countryData
        ? {
            regions: new Set(countryData.regions || []),
            dates: countryData.dates || {},
            notes: countryData.notes || {},
            wishlist: new Set(countryData.wishlist || []),
          }
        : { regions: new Set(), dates: {}, notes: {}, wishlist: new Set() };

      const local = loadLocal(countryId, userId);
      if (!prevLoggedIn.current && local.size > 0 && remote.regions.size === 0) {
        // First login: push local data up to the server
        const localDates = loadDates(countryId, userId);
        const localNotes = loadNotes(countryId, userId);
        const localWishlist = loadWishlist(countryId, userId);
        setVisited(local);
        setDatesState(localDates);
        setNotesState(localNotes);
        setWishlist(localWishlist);
        saveVisitedRemote(countryId, local, token, localDates, localNotes, localWishlist);
      } else {
        // Update state only if data actually changed (prevents flash)
        const prevRegions = visitedRef.current;
        const remoteArr = [...remote.regions].sort();
        const localArr = [...prevRegions].sort();
        if (JSON.stringify(remoteArr) !== JSON.stringify(localArr)) {
          setVisited(remote.regions);
        }
        if (JSON.stringify(remote.dates) !== JSON.stringify(datesRef.current)) {
          setDatesState(remote.dates);
        }
        if (JSON.stringify(remote.notes) !== JSON.stringify(notesRef.current)) {
          setNotesState(remote.notes);
        }
        const remoteWL = [...remote.wishlist].sort();
        const localWL = [...wishlistRef.current].sort();
        if (JSON.stringify(remoteWL) !== JSON.stringify(localWL)) {
          setWishlist(remote.wishlist);
        }
        saveLocal(countryId, remote.regions, userId);
        saveDates(countryId, remote.dates, userId);
        saveNotes(countryId, remote.notes, userId);
        saveWishlist(countryId, remote.wishlist, userId);
      }
      prevLoggedIn.current = true;
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [countryId, isLoggedIn, isSyncingLocalData, token, userId]);

  // On logout, reset to empty so no data leaks between users
  useEffect(() => {
    if (!isLoggedIn && prevLoggedIn.current) {
      prevLoggedIn.current = false;
      setVisited(new Set());
      setDatesState({});
      setNotesState({});
      setWishlist(new Set());
    }
  }, [isLoggedIn]);

  // Re-fetch from server when the tab/app becomes visible again
  useEffect(() => {
    if (!isLoggedIn || !token || isSyncingLocalData) return;

    const refetch = () => {
      // Only refetch if cache has expired — avoids a DB read on every tab switch
      const cKey = `visited-all:${token.slice(-16)}`;
      if (cacheGet(cKey, VISITED_TTL)) return;

      invalidateBulkCache(token);
      fetchAllVisited(token, true).then((bulk) => {
        if (!bulk) return;
        const countryData = bulk.regions[countryId];
        const remote = countryData
          ? {
              regions: new Set(countryData.regions || []),
              dates: countryData.dates || {},
              notes: countryData.notes || {},
              wishlist: new Set(countryData.wishlist || []),
            }
          : { regions: new Set(), dates: {}, notes: {}, wishlist: new Set() };
        setVisited(remote.regions);
        setDatesState(remote.dates);
        setNotesState(remote.notes);
        setWishlist(remote.wishlist);
        saveLocal(countryId, remote.regions, userId);
        saveDates(countryId, remote.dates, userId);
        saveNotes(countryId, remote.notes, userId);
        saveWishlist(countryId, remote.wishlist, userId);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refetch();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', refetch);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', refetch);
    };
  }, [countryId, isLoggedIn, isSyncingLocalData, token, userId]);

  const toggle = useCallback(
    (regionId) => {
      setVisited((prev) => {
        const next = new Set(prev);
        let action;
        let newDates = datesRef.current;
        let newNotes = notesRef.current;
        if (next.has(regionId)) {
          next.delete(regionId);
          action = 'remove';
          newDates = { ...newDates };
          delete newDates[regionId];
          setDatesState(newDates);
          saveDates(countryId, newDates, userId);
          newNotes = { ...newNotes };
          delete newNotes[regionId];
          setNotesState(newNotes);
          saveNotes(countryId, newNotes, userId);
        } else {
          next.add(regionId);
          action = 'add';
        }
        saveLocal(countryId, next, userId);
        if (isLoggedIn && token && !isSyncingLocalData) {
          addToBatch('region_toggle', { country_id: countryId, region: regionId, action }, token);
        }
        emitVisitedChange();
        return next;
      });
    },
    [countryId, isLoggedIn, isSyncingLocalData, token, userId]
  );

  const setDate = useCallback(
    (regionId, dateStr) => {
      setDatesState((prev) => {
        const next = { ...prev };
        if (dateStr) {
          next[regionId] = dateStr;
        } else {
          delete next[regionId];
        }
        saveDates(countryId, next, userId);
        if (isLoggedIn && token && !isSyncingLocalData) {
          debouncedSaveRemote(countryId, visitedRef.current, token, next, notesRef.current, wishlistRef.current);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, isSyncingLocalData, token, debouncedSaveRemote]
  );

  const setNote = useCallback(
    (regionId, noteStr) => {
      setNotesState((prev) => {
        const next = { ...prev };
        if (noteStr && noteStr.trim()) {
          next[regionId] = noteStr.trim();
        } else {
          delete next[regionId];
        }
        saveNotes(countryId, next, userId);
        if (isLoggedIn && token && !isSyncingLocalData) {
          debouncedSaveRemote(countryId, visitedRef.current, token, datesRef.current, next, wishlistRef.current);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, isSyncingLocalData, token, debouncedSaveRemote]
  );

  const reset = useCallback(() => {
    const empty = new Set();
    const emptyWishlist = new Set();
    saveLocal(countryId, empty, userId);
    saveDates(countryId, {}, userId);
    saveNotes(countryId, {}, userId);
    saveWishlist(countryId, emptyWishlist, userId);
    if (isLoggedIn && token && !isSyncingLocalData) {
      saveVisitedRemote(countryId, empty, token, {}, {}, emptyWishlist);
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
    setWishlist(emptyWishlist);
    emitVisitedChange();
  }, [countryId, isLoggedIn, isSyncingLocalData, token, userId]);

  const toggleWishlist = useCallback(
    (regionId) => {
      setWishlist((prev) => {
        const next = new Set(prev);
        let action;
        if (next.has(regionId)) {
          next.delete(regionId);
          action = 'remove';
        } else {
          next.add(regionId);
          action = 'add';
        }
        saveWishlist(countryId, next, userId);
        if (isLoggedIn && token && !isSyncingLocalData) {
          toggleWishlistRemote(countryId, regionId, action, token);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, isSyncingLocalData, token]
  );

  const resetAll = useCallback(() => {
    const empty = new Set();
    const emptyWishlist = new Set();
    for (const c of countryList) {
      saveLocal(c.id, empty, userId);
      saveDates(c.id, {}, userId);
      saveNotes(c.id, {}, userId);
      saveWishlist(c.id, emptyWishlist, userId);
    }
    if (isLoggedIn && token && !isSyncingLocalData) {
      deleteAllVisited(token);
      invalidateBulkCache(token);
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
    setWishlist(emptyWishlist);
    emitVisitedChange();
  }, [isLoggedIn, isSyncingLocalData, token, userId]);

  return { visited, toggle, reset, resetAll, dates, setDate, notes, setNote, wishlist, toggleWishlist, isLoading };
}
