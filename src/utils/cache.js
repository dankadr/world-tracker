// src/utils/cache.js

const PREFIX = 'cache:';

/**
 * Get a cached value if it exists and hasn't expired.
 * @param {string} key
 * @param {number} ttlMs  max age in milliseconds
 * @returns {*} cached value, or null if missing/expired
 */
export function cacheGet(key, ttlMs) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/**
 * Store a value in the cache with the current timestamp.
 * @param {string} key
 * @param {*} value  must be JSON-serialisable
 */
export function cacheSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, ts: Date.now() }));
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

/**
 * Remove one cache entry.
 * @param {string} key
 */
export function cacheInvalidate(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch { /* ignore */ }
}

/**
 * Remove all cache entries whose key starts with `prefix`.
 * Used on logout to wipe a user's cached data.
 * @param {string} prefix  e.g. 'u42:'
 */
export function cacheInvalidatePrefix(prefix) {
  try {
    const fullPrefix = PREFIX + prefix;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(fullPrefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
