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

// --------------- API helpers ---------------
async function fetchVisited(countryId, token) {
  const res = await fetch(`/api/visited/${countryId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return new Set(data.regions || []);
}

async function saveVisitedRemote(countryId, set, token) {
  try {
    await fetch(`/api/visited/${countryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ regions: [...set] }),
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
  const [currentCountry, setCurrentCountry] = useState(countryId);
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

  // When country or user changes, reload from the correct localStorage keys
  if (countryId !== currentCountry || userId !== currentUserId) {
    setCurrentCountry(countryId);
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadLocal(countryId, userId));
      setDatesState(loadDates(countryId, userId));
      setNotesState(loadNotes(countryId, userId));
    } else {
      setVisited(new Set());
      setDatesState({});
      setNotesState({});
    }
  }

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchVisited(countryId, token).then((remote) => {
      if (cancelled || !remote) return;
      const local = loadLocal(countryId, userId);
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveVisitedRemote(countryId, local, token);
        saveLocal(countryId, local, userId);
      } else {
        setVisited(remote);
        saveLocal(countryId, remote, userId);
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
    }
  }, [isLoggedIn]);

  const toggle = useCallback(
    (regionId) => {
      setVisited((prev) => {
        const next = new Set(prev);
        if (next.has(regionId)) {
          next.delete(regionId);
          setDatesState((d) => {
            const nd = { ...d };
            delete nd[regionId];
            saveDates(countryId, nd, userId);
            return nd;
          });
          setNotesState((n) => {
            const nn = { ...n };
            delete nn[regionId];
            saveNotes(countryId, nn, userId);
            return nn;
          });
        } else {
          next.add(regionId);
        }
        saveLocal(countryId, next, userId);
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, next, token);
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
        return next;
      });
    },
    [countryId, userId]
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
        return next;
      });
    },
    [countryId, userId]
  );

  const reset = useCallback(() => {
    const empty = new Set();
    saveLocal(countryId, empty, userId);
    saveDates(countryId, {}, userId);
    saveNotes(countryId, {}, userId);
    if (isLoggedIn && token) {
      saveVisitedRemote(countryId, empty, token);
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
  }, [countryId, isLoggedIn, token, userId]);

  const resetAll = useCallback(() => {
    const empty = new Set();
    for (const c of countryList) {
      saveLocal(c.id, empty, userId);
      saveDates(c.id, {}, userId);
      saveNotes(c.id, {}, userId);
      if (isLoggedIn && token) {
        saveVisitedRemote(c.id, empty, token);
      }
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
  }, [isLoggedIn, token, userId]);

  return { visited, toggle, reset, resetAll, dates, setDate, notes, setNote };
}
