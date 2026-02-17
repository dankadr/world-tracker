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

export default function useVisitedCountries() {
  const { user, isLoggedIn } = useAuth();
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
        return next;
      });
    },
    [userId]
  );

  const isVisited = useCallback(
    (countryCode) => visited.has(countryCode),
    [visited]
  );

  return { visited, toggleCountry, isVisited };
}
