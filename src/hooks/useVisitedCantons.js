import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { countryList } from '../data/countries';

// --------------- localStorage helpers ---------------
// Keys are scoped per-user so different Google accounts don't share data.
// Logged-in:  swiss-tracker-u{userId}-visited-{countryId}
// Anonymous:  swiss-tracker-visited-{countryId}

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadLocal(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveLocal(countryId, set, userId) {
  localStorage.setItem(storagePrefix(userId) + 'visited-' + countryId, JSON.stringify([...set]));
}

function loadDates(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'dates-' + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveDates(countryId, dates, userId) {
  localStorage.setItem(storagePrefix(userId) + 'dates-' + countryId, JSON.stringify(dates));
}

function loadNotes(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'notes-' + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveNotes(countryId, notes, userId) {
  localStorage.setItem(storagePrefix(userId) + 'notes-' + countryId, JSON.stringify(notes));
}

function loadWishlist(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'wishlist-' + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveWishlist(countryId, set, userId) {
  localStorage.setItem(storagePrefix(userId) + 'wishlist-' + countryId, JSON.stringify([...set]));
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
    await fetch(`/api/visited/${countryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch { /* silently fail */ }
}

// --------------- Hook ---------------
export default function useVisitedRegions(countryId) {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [visited, setVisited] = useState(() => userId ? loadLocal(countryId, userId) : new Set());
  const [dates, setDatesState] = useState(() => userId ? loadDates(countryId, userId) : {});
  const [notes, setNotesState] = useState(() => userId ? loadNotes(countryId, userId) : {});
  const [wishlist, setWishlist] = useState(() => userId ? loadWishlist(countryId, userId) : new Set());
  const [currentCountry, setCurrentCountry] = useState(countryId);
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

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

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchVisited(countryId, token).then((remote) => {
      if (cancelled || !remote) return;
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
        // Server is source of truth
        setVisited(remote.regions);
        setDatesState(remote.dates);
        setNotesState(remote.notes);
        setWishlist(remote.wishlist);
        saveLocal(countryId, remote.regions, userId);
        saveDates(countryId, remote.dates, userId);
        saveNotes(countryId, remote.notes, userId);
        saveWishlist(countryId, remote.wishlist, userId);
      }
      prevLoggedIn.current = true;
    });

    return () => { cancelled = true; };
  }, [countryId, isLoggedIn, token, userId]);

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

  const toggle = useCallback(
    (regionId) => {
      setVisited((prev) => {
        const next = new Set(prev);
        let newDates = datesRef.current;
        let newNotes = notesRef.current;
        if (next.has(regionId)) {
          next.delete(regionId);
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
        }
        saveLocal(countryId, next, userId);
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, next, token, newDates, newNotes, wishlistRef.current);
        }
        return next;
      });
    },
    [countryId, isLoggedIn, token, userId]
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
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, visitedRef.current, token, next, notesRef.current, wishlistRef.current);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, token]
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
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, visitedRef.current, token, datesRef.current, next, wishlistRef.current);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, token]
  );

  const reset = useCallback(() => {
    const empty = new Set();
    const emptyWishlist = new Set();
    saveLocal(countryId, empty, userId);
    saveDates(countryId, {}, userId);
    saveNotes(countryId, {}, userId);
    saveWishlist(countryId, emptyWishlist, userId);
    if (isLoggedIn && token) {
      saveVisitedRemote(countryId, empty, token, {}, {}, emptyWishlist);
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
    setWishlist(emptyWishlist);
  }, [countryId, isLoggedIn, token, userId]);

  const toggleWishlist = useCallback(
    (regionId) => {
      setWishlist((prev) => {
        const next = new Set(prev);
        if (next.has(regionId)) {
          next.delete(regionId);
        } else {
          next.add(regionId);
        }
        saveWishlist(countryId, next, userId);
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, visitedRef.current, token, datesRef.current, notesRef.current, next);
        }
        return next;
      });
    },
    [countryId, userId, isLoggedIn, token]
  );

  const resetAll = useCallback(() => {
    const empty = new Set();
    const emptyWishlist = new Set();
    for (const c of countryList) {
      saveLocal(c.id, empty, userId);
      saveDates(c.id, {}, userId);
      saveNotes(c.id, {}, userId);
      saveWishlist(c.id, emptyWishlist, userId);
      if (isLoggedIn && token) {
        saveVisitedRemote(c.id, empty, token, {}, {}, emptyWishlist);
      }
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
    setWishlist(emptyWishlist);
  }, [isLoggedIn, token, userId]);

  return { visited, toggle, reset, resetAll, dates, setDate, notes, setNote, wishlist, toggleWishlist };
}
