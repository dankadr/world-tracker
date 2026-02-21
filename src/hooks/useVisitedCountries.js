import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

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
    await fetch('/api/visited-world', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ countries: [...set] }),
    });
  } catch { /* silently fail */ }
}

export default function useVisitedCountries() {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [visited, setVisited] = useState(() => loadVisitedWorld(userId));
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

  // When user changes, reload from correct localStorage keys
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadVisitedWorld(userId));
    } else {
      setVisited(new Set());
    }
  }

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchWorldRemote(token).then((remote) => {
      if (cancelled || !remote) return;
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
          saveWorldRemote(next, token);
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
