import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { syncLocalDataToServer } from '../utils/syncLocalData';
import { cacheInvalidatePrefix } from '../utils/cache';
import { clearBatch } from '../utils/batchQueue';
import { deriveKey } from '../utils/crypto';
import { setActiveKey, clearActiveKey, warmCache } from '../utils/secureStorage';

const AuthContext = createContext(null);

const STORAGE_KEY = 'swiss-tracker-auth';

function decodeJwtEmail(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))?.email || null;
  } catch {
    return null;
  }
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.jwt_token && data.user) {
        // Backfill email from JWT payload if missing (e.g. older cached auth)
        if (!data.user.email) {
          data.user.email = decodeJwtEmail(data.jwt_token);
        }
        return data;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveAuth(data) {
  if (data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadAuth());
  const [loading, setLoading] = useState(false);
  const [isSyncingLocalData, setIsSyncingLocalData] = useState(false);
  const syncRunRef = useRef(0);
  const didRunInitialSyncRef = useRef(false);

  const runLocalDataSync = useCallback(async (token, userId) => {
    if (!token || !userId) return false;

    const runId = ++syncRunRef.current;
    setIsSyncingLocalData(true);
    try {
      return await syncLocalDataToServer(token, userId);
    } finally {
      if (syncRunRef.current === runId) {
        setIsSyncingLocalData(false);
      }
    }
  }, [syncRunRef]);

  // On mount, if already logged in, check for any leftover anonymous data
  useEffect(() => {
    if (didRunInitialSyncRef.current) return;
    didRunInitialSyncRef.current = true;
    if (auth?.jwt_token && auth?.user?.id && auth?.user?.sub) {
      (async () => {
        try {
          const key = await deriveKey(auth.user.sub);
          setActiveKey(key);
          await warmCache(auth.user.id);
        } catch (e) {
          console.error('[auth] key derivation failed on mount:', e);
        }
        await runLocalDataSync(auth.jwt_token, auth.user.id);
      })();
    }
  }, [auth?.jwt_token, auth?.user?.id, auth?.user?.sub, runLocalDataSync]);

  const login = useCallback(async (googleToken) => {
    setLoading(true);
    try {
      const res = await fetch('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Login failed');
      }
      const data = await res.json();

      // Derive encryption key and finish anonymous-data migration before
      // switching the app into authenticated mode.
      if (data.jwt_token && data.user?.id && data.user?.sub) {
        try {
          const key = await deriveKey(data.user.sub);
          setActiveKey(key);
          await warmCache(data.user.id);
        } catch (e) {
          console.error('[auth] key derivation failed on login:', e);
        }
        await runLocalDataSync(data.jwt_token, data.user.id);
      }

      setAuth(data);
      saveAuth(data);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [runLocalDataSync]);

  const logout = useCallback(() => {
    syncRunRef.current += 1;
    setIsSyncingLocalData(false);
    clearActiveKey(); // wipe encryption key and decrypted data cache
    // Drop any queued writes so they don't fire with a stale token after logout
    clearBatch();
    // Clear all cache entries before wiping auth (token still needed for key)
    const currentToken = auth?.jwt_token;
    if (currentToken) {
      cacheInvalidatePrefix(`visited-all:${currentToken.slice(-16)}`);
      cacheInvalidatePrefix(`leaderboard:${currentToken.slice(-16)}`);
      cacheInvalidatePrefix(`activity:${currentToken.slice(-16)}`);
      cacheInvalidatePrefix(`friend-visited:${currentToken.slice(-16)}`);
      cacheInvalidatePrefix(`challenges:${currentToken.slice(-16)}`);
    }
    setAuth(null);
    saveAuth(null);
  }, [auth]);

  const value = {
    user: auth?.user || null,
    token: auth?.jwt_token || null,
    isLoggedIn: !!auth?.jwt_token,
    isSyncingLocalData,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
