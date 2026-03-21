import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

function isJwtExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true; // malformed token — treat as expired
  }
}

export function loadAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.jwt_token && data.user) {
        if (isJwtExpired(data.jwt_token)) return null;
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

  // Auto-logout when any API call receives a 401 (expired/invalid token).
  // api.js dispatches 'auth:expired' on every 401 response.
  useEffect(() => {
    const handleExpired = () => {
      if (!loadAuth()) return; // already logged out
      clearActiveKey();
      clearBatch();
      setAuth(null);
      saveAuth(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  // On mount, if already logged in, check for any leftover anonymous data
  useEffect(() => {
    if (auth?.jwt_token && auth?.user?.id && auth?.user?.sub) {
      (async () => {
        try {
          const key = await deriveKey(auth.user.sub);
          setActiveKey(key);
          await warmCache(auth.user.id);
        } catch (e) {
          console.error('[auth] key derivation failed on mount:', e);
        }
        syncLocalDataToServer(auth.jwt_token, auth.user.id).catch(() => {});
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      setAuth(data);
      saveAuth(data);

      // Derive encryption key and warm the cache BEFORE syncing
      if (data.jwt_token && data.user?.id && data.user?.sub) {
        try {
          const key = await deriveKey(data.user.sub);
          setActiveKey(key);
          await warmCache(data.user.id);
        } catch (e) {
          console.error('[auth] key derivation failed on login:', e);
        }
        syncLocalDataToServer(data.jwt_token, data.user.id).catch(() => {});
      }
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
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
