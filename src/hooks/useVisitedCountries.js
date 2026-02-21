import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllVisited, invalidateBulkCache } from '../utils/api';

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadVisitedWorld(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveVisitedWorld(set, userId) {
  localStorage.setItem(storagePrefix(userId) + 'visited-world', JSON.stringify([...set]));
}

// --------------- API helpers ---------------
async function fetchWorldRemote(token) {
  try {
    const res = await fetch('/api/visited-world', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return new Set(data.countries || []);
  } catch { return null; }
}

async function saveWorldRemote(set, token) {
  try {
    const res = await fetch('/api/visited-world', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ countries: [...set] }),
    });
    if (!res.ok) console.error(`saveWorldRemote PUT failed: ${res.status}`);
  } catch (err) { console.error('saveWorldRemote network error:', err); }
}

async function toggleWorldRemote(countryCode, action, token) {
  try {
    const res = await fetch('/api/visited-world', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ country: countryCode, action }),
    });
    if (!res.ok) console.error(`toggleWorldRemote PATCH failed: ${res.status}`);
  } catch (err) { console.error('toggleWorldRemote network error:', err); }
}

export default function useVisitedCountries() {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [visited, setVisited] = useState(() => loadVisitedWorld(userId));
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

  // Debounce state for world PUT
  const debounceTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);

  const DEBOUNCE_MS = 800;

  // When user changes, reload from correct localStorage keys
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadVisitedWorld(userId));
    } else {
      setVisited(new Set());
    }
  }

  // Sync from server when logged in (bulk endpoint)
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchAllVisited(token).then((bulk) => {
      if (cancelled || !bulk) return;
      const remote = new Set(bulk.world || []);
      const local = loadVisitedWorld(userId);
      // Merge: if user had local data before logging in, push it up
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveVisitedWorld(local, userId);
        saveWorldRemote(local, token);
      } else {
        // Server is source of truth
        setVisited(remote);
        saveVisitedWorld(remote, userId);
      }
      prevLoggedIn.current = true;
    });

    return () => { cancelled = true; };
  }, [isLoggedIn, token, userId]);

  // On logout, reset to prevent data leaks
  useEffect(() => {
    if (!isLoggedIn && prevLoggedIn.current) {
      prevLoggedIn.current = false;
      setVisited(new Set());
    }
    if (isLoggedIn) {
      prevLoggedIn.current = true;
    }
  }, [isLoggedIn]);

  // Re-fetch from server when the tab/app becomes visible again
  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const refetch = () => {
      invalidateBulkCache();
      fetchAllVisited(token, true).then((bulk) => {
        if (!bulk) return;
        const remote = new Set(bulk.world || []);
        setVisited(remote);
        saveVisitedWorld(remote, userId);
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
  }, [isLoggedIn, token, userId]);

  // Flush pending debounced save on page close
  useEffect(() => {
    const flush = () => {
      if (pendingSaveRef.current) {
        const { set, tok } = pendingSaveRef.current;
        fetch('/api/visited-world', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ countries: [...set] }),
          keepalive: true,
        });
        pendingSaveRef.current = null;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const toggleCountry = useCallback(
    (countryCode) => {
      setVisited((prev) => {
        const next = new Set(prev);
        if (next.has(countryCode)) {
          next.delete(countryCode);
        } else {
          next.add(countryCode);
        }
        saveVisitedWorld(next, userId);
        if (isLoggedIn && token) {
          // Debounce: batch rapid toggles into a single PUT
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          pendingSaveRef.current = { set: next, tok: token };
          debounceTimerRef.current = setTimeout(() => {
            saveWorldRemote(next, token);
            pendingSaveRef.current = null;
            invalidateBulkCache();
          }, DEBOUNCE_MS);
        }
        return next;
      });
    },
    [userId, isLoggedIn, token]
  );

  const isVisited = useCallback(
    (countryCode) => visited.has(countryCode),
    [visited]
  );

  return { visited, toggleCountry, isVisited };
}
