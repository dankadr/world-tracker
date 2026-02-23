import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { XP_RULES, levelFromXp } from '../utils/xpSystem';

// --------------- localStorage helpers ---------------
function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadXp(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'xp');
    if (raw) return parseInt(raw, 10) || 0;
  } catch { /* ignore */ }
  return 0;
}

function saveXp(userId, xp) {
  localStorage.setItem(storagePrefix(userId) + 'xp', String(xp));
}

function loadXpLog(userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'xp-log');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveXpLog(userId, log) {
  // Keep only last 200 entries locally
  const trimmed = log.slice(-200);
  localStorage.setItem(storagePrefix(userId) + 'xp-log', JSON.stringify(trimmed));
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

  // When user changes, reload XP
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    setTotalXp(loadXp(userId));
  }

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;

    fetchXpRemote(token).then((data) => {
      if (cancelled || !data) return;
      const serverXp = data.total_xp || 0;
      const localXp = loadXp(userId);
      // If local has more (guest → login migration), push local up
      if (localXp > serverXp && localXp > 0) {
        const diff = localXp - serverXp;
        addXpRemote(token, diff, 'migration').then((res) => {
          if (res) {
            setTotalXp(res.total_xp);
            saveXp(userId, res.total_xp);
          }
        });
      } else {
        setTotalXp(serverXp);
        saveXp(userId, serverXp);
      }
    });

    return () => { cancelled = true; };
  }, [isLoggedIn, token, userId]);

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

    // Check for level up (use state after update)
    const newTotal = totalXp + amount;
    const newLevel = levelFromXp(newTotal).level;

    // Show XP notification
    const notifId = Date.now() + Math.random();
    setNotifications((prev) => [...prev, {
      id: notifId,
      amount,
      reason,
      levelUp: newLevel > oldLevel ? newLevel : null,
    }]);

    // Auto-dismiss after 2.5s
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    }, 2500);

    // Sync to server
    if (isLoggedIn && token) {
      addXpRemote(token, amount, reason, trackerId);
    }
  }, [totalXp, userId, isLoggedIn, token]);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const levelInfo = levelFromXp(totalXp);

  const value = {
    totalXp,
    level: levelInfo.level,
    currentXp: levelInfo.currentXp,
    nextLevelXp: levelInfo.nextLevelXp,
    addXp,
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
      notifications: [],
      dismissNotification: () => {},
      XP_RULES,
    };
  }
  return ctx;
}
