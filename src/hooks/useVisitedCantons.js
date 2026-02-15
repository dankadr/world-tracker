import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const STORAGE_PREFIX = 'swiss-tracker-visited-';
const DATES_PREFIX = 'swiss-tracker-dates-';
const NOTES_PREFIX = 'swiss-tracker-notes-';

// --------------- localStorage helpers ---------------
function loadLocal(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveLocal(countryId, set) {
  localStorage.setItem(STORAGE_PREFIX + countryId, JSON.stringify([...set]));
}

function loadDates(countryId) {
  try {
    const raw = localStorage.getItem(DATES_PREFIX + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveDates(countryId, dates) {
  localStorage.setItem(DATES_PREFIX + countryId, JSON.stringify(dates));
}

function loadNotes(countryId) {
  try {
    const raw = localStorage.getItem(NOTES_PREFIX + countryId);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveNotes(countryId, notes) {
  localStorage.setItem(NOTES_PREFIX + countryId, JSON.stringify(notes));
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
  const { token, isLoggedIn } = useAuth();
  const [visited, setVisited] = useState(() => loadLocal(countryId));
  const [dates, setDatesState] = useState(() => loadDates(countryId));
  const [notes, setNotesState] = useState(() => loadNotes(countryId));
  const [currentCountry, setCurrentCountry] = useState(countryId);
  const prevLoggedIn = useRef(isLoggedIn);

  // When country changes, reload
  if (countryId !== currentCountry) {
    setCurrentCountry(countryId);
    setVisited(loadLocal(countryId));
    setDatesState(loadDates(countryId));
    setNotesState(loadNotes(countryId));
  }

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchVisited(countryId, token).then((remote) => {
      if (cancelled || !remote) return;
      const local = loadLocal(countryId);
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveVisitedRemote(countryId, local, token);
        saveLocal(countryId, local);
      } else {
        setVisited(remote);
        saveLocal(countryId, remote);
      }
      prevLoggedIn.current = true;
    });

    return () => { cancelled = true; };
  }, [countryId, isLoggedIn, token]);

  useEffect(() => {
    if (!isLoggedIn && prevLoggedIn.current) {
      prevLoggedIn.current = false;
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
            saveDates(countryId, nd);
            return nd;
          });
          setNotesState((n) => {
            const nn = { ...n };
            delete nn[regionId];
            saveNotes(countryId, nn);
            return nn;
          });
        } else {
          next.add(regionId);
        }
        saveLocal(countryId, next);
        if (isLoggedIn && token) {
          saveVisitedRemote(countryId, next, token);
        }
        return next;
      });
    },
    [countryId, isLoggedIn, token]
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
        saveDates(countryId, next);
        return next;
      });
    },
    [countryId]
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
        saveNotes(countryId, next);
        return next;
      });
    },
    [countryId]
  );

  const reset = useCallback(() => {
    const empty = new Set();
    saveLocal(countryId, empty);
    saveDates(countryId, {});
    saveNotes(countryId, {});
    if (isLoggedIn && token) {
      saveVisitedRemote(countryId, empty, token);
    }
    setVisited(empty);
    setDatesState({});
    setNotesState({});
  }, [countryId, isLoggedIn, token]);

  return { visited, toggle, reset, dates, setDate, notes, setNote };
}
