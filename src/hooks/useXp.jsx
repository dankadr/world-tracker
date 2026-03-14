import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { XP_RULES, levelFromXp } from '../utils/xpSystem';
import { secureStorage } from '../utils/secureStorage';
import { haptics } from '../utils/haptics';

const LEGACY_AWARDED_KEY = 'swiss-tracker-xp-awarded';

// --------------- localStorage helpers ---------------
function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadXp(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'xp');
    if (raw) return parseInt(raw, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

function saveXp(userId, xp) {
  secureStorage.setItem(storagePrefix(userId) + 'xp', String(xp));
}

function loadXpLog(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'xp-log');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveXpLog(userId, log) {
  // Keep only last 200 entries locally
  const trimmed = log.slice(-200);
  secureStorage.setItem(storagePrefix(userId) + 'xp-log', JSON.stringify(trimmed));
}

function loadPendingDeltas(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'xp-pending-deltas');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function savePendingDeltas(userId, deltas) {
  // Keep only last 200 pending entries
  const trimmed = deltas.slice(-200);
  secureStorage.setItem(storagePrefix(userId) + 'xp-pending-deltas', JSON.stringify(trimmed));
}

function loadGrantedKeys(userId) {
  const keys = new Set();

  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'xp-granted-keys');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach((k) => keys.add(k));
    }
  } catch { /* ignore */ }

  let hadLegacy = false;
  try {
    const legacyRaw = localStorage.getItem(LEGACY_AWARDED_KEY);
    if (legacyRaw) {
      hadLegacy = true;
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) parsed.forEach((k) => keys.add(k));
    }
  } catch { /* ignore */ }

  if (hadLegacy) {
    try {
      secureStorage.setItem(storagePrefix(userId) + 'xp-granted-keys', JSON.stringify([...keys]));
    } catch { /* ignore */ }
    try {
      localStorage.removeItem(LEGACY_AWARDED_KEY);
    } catch { /* ignore */ }
  }

  return keys;
}

function saveGrantedKeys(userId, keys) {
  secureStorage.setItem(storagePrefix(userId) + 'xp-granted-keys', JSON.stringify([...keys]));
}

// --------------- API helpers ---------------
async function fetchXpRemote(token) {
  try {
    const res = await fetch('/api/user/xp', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function addXpRemote(token, amount, reason, trackerId = null) {
  try {
    const body = { amount, reason };
    if (trackerId) body.tracker_id = trackerId;
    const res = await fetch('/api/user/xp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// --------------- XP Context ---------------
const XpContext = createContext(null);

export function XpProvider({ children }) {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [totalXp, setTotalXp] = useState(() => loadXp(userId));
  const [currentUserId, setCurrentUserId] = useState(userId);
  const [notifications, setNotifications] = useState([]);
  const prevLevelRef = useRef(null);
  const grantedKeysRef = useRef(loadGrantedKeys(userId));
  const pendingDeltasRef = useRef(loadPendingDeltas(userId));
  const isFlushingRef = useRef(false);

  // When user changes, reload user-scoped local state.
  useEffect(() => {
    if (userId === currentUserId) return;
    setCurrentUserId(userId);
    setTotalXp(loadXp(userId));
    grantedKeysRef.current = loadGrantedKeys(userId);
    pendingDeltasRef.current = loadPendingDeltas(userId);
  }, [userId, currentUserId]);

  const enqueuePendingDelta = useCallback((delta) => {
    pendingDeltasRef.current = [...pendingDeltasRef.current, delta];
    savePendingDeltas(userId, pendingDeltasRef.current);
  }, [userId]);

  const flushPendingDeltas = useCallback(async (authToken = token) => {
    if (!isLoggedIn || !authToken) return;
    if (isFlushingRef.current) return;
    if (pendingDeltasRef.current.length === 0) return;

    isFlushingRef.current = true;
    try {
      const queue = [...pendingDeltasRef.current];
      let remaining = [];

      for (let i = 0; i < queue.length; i += 1) {
        const d = queue[i];
        const res = await addXpRemote(authToken, d.amount, d.reason, d.trackerId || null);
        if (!res) {
          remaining = queue.slice(i);
          break;
        }
        setTotalXp(res.total_xp);
        saveXp(userId, res.total_xp);
      }

      pendingDeltasRef.current = remaining;
      savePendingDeltas(userId, remaining);
    } finally {
      isFlushingRef.current = false;
    }
  }, [isLoggedIn, token, userId]);

  // Sync from server when logged in.
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    const run = async () => {
      const data = await fetchXpRemote(token);
      if (cancelled || !data) return;

      const serverXp = data.total_xp || 0;
      const localXp = loadXp(userId);
      const hasPending = pendingDeltasRef.current.length > 0;

      if (hasPending) {
        // Keep local optimistic value while replay is pending.
        setTotalXp(localXp);
        saveXp(userId, localXp);
        await flushPendingDeltas(token);
        if (cancelled) return;

        if (pendingDeltasRef.current.length === 0) {
          const refreshed = await fetchXpRemote(token);
          if (refreshed && !cancelled) {
            setTotalXp(refreshed.total_xp || 0);
            saveXp(userId, refreshed.total_xp || 0);
          }
        }
        return;
      }

      // If local has more (guest -> login migration), push local up.
      if (localXp > serverXp && localXp > 0) {
        const diff = localXp - serverXp;
        const res = await addXpRemote(token, diff, 'migration');
        if (cancelled) return;

        if (res) {
          setTotalXp(res.total_xp);
          saveXp(userId, res.total_xp);
        } else {
          enqueuePendingDelta({ amount: diff, reason: 'migration', trackerId: null, ts: Date.now() });
          setTotalXp(localXp);
          saveXp(userId, localXp);
          await flushPendingDeltas(token);
        }
        return;
      }

      setTotalXp(serverXp);
      saveXp(userId, serverXp);
    };

    run();

    return () => { cancelled = true; };
  }, [isLoggedIn, token, userId, enqueuePendingDelta, flushPendingDeltas]);

  // Initialize prevLevel
  useEffect(() => {
    if (prevLevelRef.current === null) {
      prevLevelRef.current = levelFromXp(totalXp).level;
    }
  }, [totalXp]);

  const addXp = useCallback((amount, reason, trackerId = null) => {
    if (amount <= 0) return;

    const oldLevel = levelFromXp(totalXp).level;

    setTotalXp((prev) => {
      const next = prev + amount;
      saveXp(userId, next);

      // Log locally
      const log = loadXpLog(userId);
      log.push({ amount, reason, trackerId, ts: Date.now() });
      saveXpLog(userId, log);

      return next;
    });

    const newTotal = totalXp + amount;
    const newLevel = levelFromXp(newTotal).level;
    const didLevelUp = newLevel > oldLevel;

    if (didLevelUp) {
      haptics.levelUp();
    }

    // Show XP notification
    const notifId = Date.now() + Math.random();
    setNotifications((prev) => [...prev, {
      id: notifId,
      amount,
      reason,
      levelUp: didLevelUp ? newLevel : null,
    }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    }, 2500);

    if (isLoggedIn && token) {
      const delta = { amount, reason, trackerId, ts: Date.now() };
      addXpRemote(token, amount, reason, trackerId).then((res) => {
        if (res) {
          setTotalXp(res.total_xp);
          saveXp(userId, res.total_xp);
          flushPendingDeltas(token);
          return;
        }
        enqueuePendingDelta(delta);
      }).catch(() => enqueuePendingDelta(delta));
    }
  }, [totalXp, userId, isLoggedIn, token, enqueuePendingDelta, flushPendingDeltas]);

  const removeXp = useCallback((amount, reason, trackerId = null) => {
    if (amount <= 0) return;

    setTotalXp((prev) => {
      const next = Math.max(0, prev - amount);
      saveXp(userId, next);

      // Log locally with negative amount for audit
      const log = loadXpLog(userId);
      log.push({ amount: -amount, reason, trackerId, ts: Date.now() });
      saveXpLog(userId, log);

      return next;
    });

    if (isLoggedIn && token) {
      const delta = { amount: -amount, reason, trackerId, ts: Date.now() };
      addXpRemote(token, -amount, reason, trackerId).then((res) => {
        if (res) {
          setTotalXp(res.total_xp);
          saveXp(userId, res.total_xp);
          flushPendingDeltas(token);
          return;
        }
        enqueuePendingDelta(delta);
      }).catch(() => enqueuePendingDelta(delta));
    }
  }, [userId, isLoggedIn, token, enqueuePendingDelta, flushPendingDeltas]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Grant XP exactly once per unique key (per user). Safe to call on every toggle.
  const grantXpOnce = useCallback((key, amount, reason, trackerId = null) => {
    if (grantedKeysRef.current.has(key)) return false;
    grantedKeysRef.current.add(key);
    saveGrantedKeys(userId, grantedKeysRef.current);
    addXp(amount, reason, trackerId);
    return true;
  }, [userId, addXp]);

  // Revoke XP only if the keyed grant exists.
  const revokeXpIfGranted = useCallback((key, amount, reason, trackerId = null) => {
    if (!grantedKeysRef.current.has(key)) return false;
    grantedKeysRef.current.delete(key);
    saveGrantedKeys(userId, grantedKeysRef.current);
    removeXp(amount, reason, trackerId);
    return true;
  }, [userId, removeXp]);

  const levelInfo = levelFromXp(totalXp);

  const value = {
    totalXp,
    level: levelInfo.level,
    currentXp: levelInfo.currentXp,
    nextLevelXp: levelInfo.nextLevelXp,
    addXp,
    removeXp,
    grantXpOnce,
    revokeXpIfGranted,
    notifications,
    dismissNotification,
    XP_RULES,
  };

  return (
    <XpContext.Provider value={value}>
      {children}
    </XpContext.Provider>
  );
}

export default function useXp() {
  const ctx = useContext(XpContext);
  if (!ctx) {
    // Fallback for when used outside provider (shouldn't happen but be safe)
    return {
      totalXp: 0,
      level: 1,
      currentXp: 0,
      nextLevelXp: 50,
      addXp: () => {},
      removeXp: () => {},
      grantXpOnce: () => false,
      revokeXpIfGranted: () => false,
      notifications: [],
      dismissNotification: () => {},
      XP_RULES,
    };
  }
  return ctx;
}
