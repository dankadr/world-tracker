import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchAllVisited, invalidateBulkCache } from '../utils/api';
import { cacheGet, cacheGetStale } from '../utils/cache';
import { addToBatch } from '../utils/batchQueue';
import { emitVisitedChange } from '../utils/events';
import { secureStorage } from '../utils/secureStorage';

const VISITED_TTL = 5 * 60 * 1000;

function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadVisitedWorld(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveVisitedWorld(set, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'visited-world', JSON.stringify([...set]));
}

// --------------- API helpers ---------------
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

/**
 * Try to extract world data from the stale bulk cache for instant rendering.
 * Falls back to per-user localStorage if no bulk cache exists.
 */
function initWorldFromCache(token, userId) {
  if (token) {
    const cKey = `visited-all:${token.slice(-16)}`;
    const bulk = cacheGetStale(cKey);
    if (bulk) {
      return new Set(bulk.world || []);
    }
  }
  return loadVisitedWorld(userId);
}

export default function useVisitedCountries() {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [visited, setVisited] = useState(() => initWorldFromCache(token, userId));
  const [isLoading, setIsLoading] = useState(() => initWorldFromCache(token, userId).size === 0 && isLoggedIn);
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);
  const visitedRef = useRef(visited);
  visitedRef.current = visited;

  // When user changes, reload from correct localStorage keys
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadVisitedWorld(userId));
    } else {
      setVisited(new Set());
    }
  }

  // Sync from server when logged in (bulk endpoint) — background only
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    // Cover the fresh-login case: isLoading was initialized false when the user
    // wasn't yet authenticated, so flip it to true while the fetch is in-flight.
    if (visitedRef.current.size === 0) setIsLoading(true);

    fetchAllVisited(token).then((bulk) => {
      if (cancelled) return;
      if (!bulk) { setIsLoading(false); return; }
      const remote = new Set(bulk.world || []);
      const local = loadVisitedWorld(userId);
      // Merge: if user had local data before logging in, push it up
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveVisitedWorld(local, userId);
        saveWorldRemote(local, token);
      } else {
        // Update state only if data actually changed (prevents flash)
        const remoteArr = [...remote].sort();
        const localArr = [...visitedRef.current].sort();
        if (JSON.stringify(remoteArr) !== JSON.stringify(localArr)) {
          setVisited(remote);
        }
        saveVisitedWorld(remote, userId);
      }
      prevLoggedIn.current = true;
      setIsLoading(false);
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
      // Only refetch if cache has expired — avoids a DB read on every tab switch
      const cKey = `visited-all:${token.slice(-16)}`;
      if (cacheGet(cKey, VISITED_TTL)) return;

      invalidateBulkCache(token);
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

  const toggleCountry = useCallback(
    (countryCode) => {
      setVisited((prev) => {
        const next = new Set(prev);
        const action = next.has(countryCode) ? 'remove' : 'add';
        if (action === 'remove') {
          next.delete(countryCode);
        } else {
          next.add(countryCode);
        }
        saveVisitedWorld(next, userId);
        if (isLoggedIn && token) {
          addToBatch('world_toggle', { country: countryCode, action }, token);
        }
        emitVisitedChange();
        return next;
      });
    },
    [userId, isLoggedIn, token]
  );

  const isVisited = useCallback(
    (countryCode) => visited.has(countryCode),
    [visited]
  );

  return { visited, toggleCountry, isVisited, isLoading };
}
