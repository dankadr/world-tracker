// src/utils/secureStorage.js
import { encrypt, decrypt } from './crypto.js';
import { logger } from './logger.js';

let activeKey = null;
const memCache = new Map(); // key → plaintext string | null

/**
 * Returns true for user-scoped travel data keys that should be encrypted.
 * Pattern: swiss-tracker-u{digits}-...
 * Excludes: swiss-tracker-auth, cache:*, swiss-tracker-theme, etc.
 */
function shouldEncrypt(key) {
  return /^swiss-tracker-u\d/.test(key);
}

/** Call after deriveKey() completes on login. */
export function setActiveKey(key) {
  activeKey = key;
}

/** Call on logout — wipes the in-memory cache and drops the key. */
export function clearActiveKey() {
  activeKey = null;
  memCache.clear();
}

/**
 * Pre-warm the cache by decrypting all localStorage keys for a given userId.
 * Call this at login BEFORE the rest of the app initialises so that
 * synchronous reads via getItemSync() return plaintext from cache.
 */
export async function warmCache(userId) {
  const prefix = `swiss-tracker-u${userId}-`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  await Promise.all(keys.map((k) => secureStorage.getItem(k)));
}

export const secureStorage = {
  /**
   * Async read. Decrypts if activeKey is set and key matches encrypt pattern.
   * Falls back to raw value on decrypt failure (handles pre-encryption plaintext).
   * Populates memCache so subsequent getItemSync() calls return immediately.
   */
  async getItem(key) {
    if (memCache.has(key)) return memCache.get(key);

    const raw = localStorage.getItem(key);
    if (raw === null) {
      memCache.set(key, null);
      return null;
    }

    if (activeKey && shouldEncrypt(key)) {
      try {
        const plaintext = await decrypt(activeKey, raw);
        memCache.set(key, plaintext);
        return plaintext;
      } catch {
        // Pre-encryption plaintext or corrupt data — return as-is
        logger.debug('[secureStorage] decrypt fallback for', key);
        memCache.set(key, raw);
        return raw;
      }
    }

    return raw;
  },

  /**
   * Async write. Encrypts if activeKey is set and key matches encrypt pattern.
   * Updates memCache synchronously so getItemSync() is immediately consistent.
   */
  async setItem(key, value) {
    memCache.set(key, value);
    if (activeKey && shouldEncrypt(key)) {
      const encrypted = await encrypt(activeKey, value);
      localStorage.setItem(key, encrypted);
    } else {
      localStorage.setItem(key, value);
    }
  },

  /**
   * Synchronous read from the in-memory cache.
   * Returns null for encrypted keys not yet in cache (before warmCache).
   * Falls through to localStorage for non-encrypted keys (anonymous users, settings).
   */
  getItemSync(key) {
    if (memCache.has(key)) return memCache.get(key);
    if (shouldEncrypt(key)) return null;
    return localStorage.getItem(key);
  },

  /** Removes from both cache and localStorage. */
  removeItem(key) {
    memCache.delete(key);
    localStorage.removeItem(key);
  },
};
