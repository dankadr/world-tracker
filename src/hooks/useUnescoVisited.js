import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { invalidateBulkCache } from '../utils/api';

const TRACKER_ID = 'unesco';

// --------------- localStorage helpers ---------------
function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadLocal(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + TRACKER_ID);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveLocal(set, userId) {
  localStorage.setItem(storagePrefix(userId) + 'visited-' + TRACKER_ID, JSON.stringify([...set]));
}

// --------------- API helpers ---------------
async function fetchVisitedRemote(token) {
  try {
    const res = await fetch(`/api/visited/${TRACKER_ID}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return new Set(data.regions || []);
  } catch { return null; }
}

async function saveVisitedRemote(set, token) {
  try {
    const res = await fetch(`/api/visited/${TRACKER_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ regions: [...set] }),
    });
    if (!res.ok) console.error(`saveVisitedRemote PUT failed: ${res.status}`);
  } catch (err) { console.error('saveVisitedRemote network error:', err); }
}

async function toggleSiteRemote(siteId, action, token) {
  try {
    const res = await fetch(`/api/visited/${TRACKER_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ region: String(siteId), action }),
    });
    if (!res.ok) console.error(`toggleSiteRemote PATCH failed: ${res.status}`);
  } catch (err) { console.error('toggleSiteRemote network error:', err); }
}

const DEBOUNCE_MS = 800;

export default function useUnescoVisited() {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [visited, setVisited] = useState(() => loadLocal(userId));
  const [currentUserId, setCurrentUserId] = useState(userId);
  const prevLoggedIn = useRef(isLoggedIn);

  // Debounce state
  const debounceTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);

  // When user changes, reload from correct localStorage keys
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    if (userId) {
      setVisited(loadLocal(userId));
    } else {
      setVisited(new Set());
    }
  }

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchVisitedRemote(token).then((remote) => {
      if (cancelled || !remote) return;
      const local = loadLocal(userId);
      // Merge: if user had local data before logging in, push it up
      if (!prevLoggedIn.current && local.size > 0 && remote.size === 0) {
        setVisited(local);
        saveLocal(local, userId);
        saveVisitedRemote(local, token);
      } else {
        // Server is source of truth
        setVisited(remote);
        saveLocal(remote, userId);
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

  // Flush pending debounced save on page close
  useEffect(() => {
    const flush = () => {
      if (pendingSaveRef.current) {
        const { set, tok } = pendingSaveRef.current;
        fetch(`/api/visited/${TRACKER_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ regions: [...set] }),
          keepalive: true,
        });
        pendingSaveRef.current = null;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const toggleSite = useCallback(
    (siteId) => {
      setVisited((prev) => {
        const next = new Set(prev);
        const siteIdStr = String(siteId);
        if (next.has(siteIdStr)) {
          next.delete(siteIdStr);
        } else {
          next.add(siteIdStr);
        }
        saveLocal(next, userId);
        if (isLoggedIn && token) {
          // Debounce: batch rapid toggles into a single PUT
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          pendingSaveRef.current = { set: next, tok: token };
          debounceTimerRef.current = setTimeout(() => {
            saveVisitedRemote(next, token);
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
    (siteId) => visited.has(String(siteId)),
    [visited]
  );

  return { visitedSites: visited, toggleSite, isVisited };
}
