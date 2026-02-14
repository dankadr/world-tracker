import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const STORAGE_PREFIX = 'swiss-tracker-visited-';

// --------------- localStorage helpers ---------------
function loadLocal(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveLocal(countryId, set) {
  localStorage.setItem(STORAGE_PREFIX + countryId, JSON.stringify([...set]));
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
  } catch {
    // silently fail, localStorage is always the backup
  }
}

// --------------- Hook ---------------
export default function useVisitedRegions(countryId) {
  const { token, isLoggedIn } = useAuth();
  const [visited, setVisited] = useState(() => loadLocal(countryId));
  const [currentCountry, setCurrentCountry] = useState(countryId);
  const prevLoggedIn = useRef(isLoggedIn);

  // When country changes, reload
  if (countryId !== currentCountry) {
    setCurrentCountry(countryId);
    setVisited(loadLocal(countryId));
  }

  // Sync from server when logged in or when country/login changes
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchVisited(countryId, token).then((remote) => {
      if (cancelled || !remote) return;

      // If user just logged in and has local data but remote is empty, push local to remote
      const local = loadLocal(countryId);
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveVisitedRemote(countryId, local, token);
        saveLocal(countryId, local);
      } else {
        // Server is source of truth
        setVisited(remote);
        saveLocal(countryId, remote);
      }
      prevLoggedIn.current = true;
    });

    return () => { cancelled = true; };
  }, [countryId, isLoggedIn, token]);

  // When user logs out, keep showing localStorage data
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

  const reset = useCallback(() => {
    const empty = new Set();
    saveLocal(countryId, empty);
    if (isLoggedIn && token) {
      saveVisitedRemote(countryId, empty, token);
    }
    setVisited(empty);
  }, [countryId, isLoggedIn, token]);

  return { visited, toggle, reset };
}
