# localStorage AES-256-GCM Encryption Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt all user-scoped localStorage data with AES-256-GCM before writing to disk and before syncing to the server, so the server stores only ciphertext.

**Architecture:** Two new utilities — `crypto.js` (PBKDF2 key derivation + AES-GCM encrypt/decrypt) and `secureStorage.js` (drop-in localStorage wrapper with sync-readable in-memory cache). On login, `AuthContext` derives the user's key and pre-warms the in-memory cache by decrypting all existing localStorage values before the rest of the app initialises. All hooks replace direct `localStorage` calls with `secureStorage` equivalents. Stats/achievement utilities replace `localStorage.getItem` with `secureStorage.getItemSync`, which reads from the pre-warmed cache synchronously — no async refactor needed in those files.

**Tech Stack:** Browser `window.crypto.subtle` (Web Crypto API), React 18, vitest

---

## File Map

| Action | File | Role |
|--------|------|------|
| Create | `src/utils/crypto.js` | PBKDF2 key derivation, AES-GCM encrypt/decrypt |
| Create | `src/utils/secureStorage.js` | Async wrapper + sync cache + warmCache |
| Create | `src/utils/__tests__/crypto.test.js` | Tests for crypto.js |
| Create | `src/utils/__tests__/secureStorage.test.js` | Tests for secureStorage.js |
| Modify | `src/context/AuthContext.jsx` | Derive key + warm cache on login and on mount |
| Modify | `src/hooks/useVisitedCantons.js` | All 8 localStorage calls → secureStorage |
| Modify | `src/hooks/useVisitedCountries.js` | All 2 localStorage calls → secureStorage |
| Modify | `src/hooks/useWishlist.js` | All 3 localStorage calls → secureStorage |
| Modify | `src/hooks/useAvatar.js` | All 2 localStorage calls → secureStorage |
| Modify | `src/hooks/useUnescoVisited.js` | All 2 localStorage calls → secureStorage |
| Modify | `src/hooks/useXp.jsx` | User-scoped localStorage calls → secureStorage |
| Modify | `src/utils/syncLocalData.js` | `migrateKeys` → async, uses secureStorage.setItem |
| Modify | `src/utils/achievementProgress.js` | getItem → secureStorage.getItemSync |
| Modify | `src/utils/achievementDetail.js` | getItem → secureStorage.getItemSync |
| Modify | `src/data/achievements.js` | getItem → secureStorage.getItemSync |
| Modify | `src/utils/allTimeStats.js` | getItem → secureStorage.getItemSync |
| Modify | `src/utils/yearStats.js` | getItem → secureStorage.getItemSync |
| Modify | `src/components/StatsModal.jsx` | getItem → secureStorage.getItemSync |
| Modify | `src/components/OverallProgress.jsx` | getItem → secureStorage.getItemSync |
| Modify | `src/components/WorldSidebar.jsx` | getItem → secureStorage.getItemSync |
| Modify | `src/App.jsx` | User-scoped achievement-seen + confetti keys |

**Not changed:** `AuthContext` auth key, `ThemeContext`, `cache.js`, `easterEggs.js`, `Onboarding.jsx`, `useCustomColors.js` — all non-user-scoped.

---

## Chunk 1: Core crypto infrastructure

### Task 1: Create `src/utils/crypto.js`

**Files:**
- Create: `src/utils/crypto.js`
- Create: `src/utils/__tests__/crypto.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/__tests__/crypto.test.js
import { describe, it, expect } from 'vitest';
import { deriveKey, encrypt, decrypt } from '../crypto.js';

describe('crypto', () => {
  it('deriveKey returns a CryptoKey', async () => {
    const key = await deriveKey('test-sub-123');
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('deriveKey caches — same sub returns same key object', async () => {
    const k1 = await deriveKey('same-sub');
    const k2 = await deriveKey('same-sub');
    expect(k1).toBe(k2); // reference equality — cache hit
  });

  it('different subs produce different keys', async () => {
    const k1 = await deriveKey('sub-alice');
    const k2 = await deriveKey('sub-bob');
    expect(k1).not.toBe(k2);
  });

  it('encrypt returns a non-empty string', async () => {
    const key = await deriveKey('enc-sub');
    const result = await encrypt(key, 'hello world');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(20);
  });

  it('encrypt + decrypt round-trips correctly', async () => {
    const key = await deriveKey('roundtrip-sub');
    const plaintext = JSON.stringify({ regions: ['ch-ag', 'ch-zh'] });
    const ciphertext = await encrypt(key, plaintext);
    const recovered = await decrypt(key, ciphertext);
    expect(recovered).toBe(plaintext);
  });

  it('each encrypt call produces different ciphertext (random IV)', async () => {
    const key = await deriveKey('iv-sub');
    const c1 = await encrypt(key, 'same plaintext');
    const c2 = await encrypt(key, 'same plaintext');
    expect(c1).not.toBe(c2);
  });

  it('decrypt throws on tampered ciphertext', async () => {
    const key = await deriveKey('tamper-sub');
    const ciphertext = await encrypt(key, 'data');
    const tampered = ciphertext.slice(0, -4) + 'XXXX';
    await expect(decrypt(key, tampered)).rejects.toThrow();
  });

  it('output uses URL-safe base64 (no +, /, = chars)', async () => {
    const key = await deriveKey('b64url-sub');
    for (let i = 0; i < 20; i++) {
      const c = await encrypt(key, 'test data for b64 check');
      expect(c).not.toMatch(/[+/=]/);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- crypto.test.js
```
Expected: `Error: Failed to resolve import "../crypto.js"`

- [ ] **Step 3: Implement `src/utils/crypto.js`**

```js
// src/utils/crypto.js

const SALT = new TextEncoder().encode('rightworld-v1');
const KEY_CACHE = new Map(); // sub → CryptoKey

// --------------- base64url helpers ---------------

function toBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function fromBase64url(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// --------------- public API ---------------

/**
 * Derive a CryptoKey from a Google user sub using PBKDF2.
 * Result is cached per sub so derivation only runs once per session.
 */
export async function deriveKey(sub) {
  if (KEY_CACHE.has(sub)) return KEY_CACHE.get(sub);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sub),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  KEY_CACHE.set(sub, key);
  return key;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns URL-safe base64 of [IV (12 bytes) | ciphertext].
 */
export async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return toBase64url(combined.buffer);
}

/**
 * Decrypt a base64url string produced by encrypt().
 * Throws if the ciphertext is tampered or the key is wrong.
 */
export async function decrypt(key, encoded) {
  const combined = new Uint8Array(fromBase64url(encoded));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npm run test -- crypto.test.js
```
Expected: `8 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils/crypto.js src/utils/__tests__/crypto.test.js
git commit -m "feat(crypto): add AES-256-GCM key derivation and encrypt/decrypt"
```

---

### Task 2: Create `src/utils/secureStorage.js`

**Files:**
- Create: `src/utils/secureStorage.js`
- Create: `src/utils/__tests__/secureStorage.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/__tests__/secureStorage.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { deriveKey } from '../crypto.js';
import {
  setActiveKey,
  clearActiveKey,
  warmCache,
  secureStorage,
} from '../secureStorage.js';

beforeEach(() => {
  localStorage.clear();
  clearActiveKey();
});

describe('secureStorage — no active key (anonymous)', () => {
  it('getItem returns raw localStorage value', async () => {
    localStorage.setItem('swiss-tracker-u1-test', 'hello');
    // no key set — should passthrough
    const result = await secureStorage.getItem('swiss-tracker-u1-test');
    expect(result).toBe('hello');
  });

  it('setItem writes plain text', async () => {
    await secureStorage.setItem('swiss-tracker-u1-test', 'plain');
    expect(localStorage.getItem('swiss-tracker-u1-test')).toBe('plain');
  });

  it('getItemSync returns raw value for non-encrypted keys', () => {
    localStorage.setItem('swiss-tracker-auth', '{"jwt":"abc"}');
    expect(secureStorage.getItemSync('swiss-tracker-auth')).toBe('{"jwt":"abc"}');
  });
});

describe('secureStorage — with active key (logged in)', () => {
  async function login(sub = 'test-sub') {
    const key = await deriveKey(sub);
    setActiveKey(key);
    return key;
  }

  it('setItem writes ciphertext, getItem decrypts it', async () => {
    await login();
    const value = JSON.stringify(['ch-ag', 'ch-zh']);
    await secureStorage.setItem('swiss-tracker-u1-visited-ch', value);

    const raw = localStorage.getItem('swiss-tracker-u1-visited-ch');
    expect(raw).not.toBe(value); // ciphertext ≠ plaintext

    const decrypted = await secureStorage.getItem('swiss-tracker-u1-visited-ch');
    expect(decrypted).toBe(value);
  });

  it('getItemSync returns plaintext from cache after setItem', async () => {
    await login();
    await secureStorage.setItem('swiss-tracker-u1-visited-ch', '["ch-ag"]');
    expect(secureStorage.getItemSync('swiss-tracker-u1-visited-ch')).toBe('["ch-ag"]');
  });

  it('getItemSync returns null for encrypted key not yet in cache', async () => {
    await login();
    localStorage.setItem('swiss-tracker-u1-some-key', 'encrypted-blob-not-in-cache');
    expect(secureStorage.getItemSync('swiss-tracker-u1-some-key')).toBeNull();
  });

  it('getItemSync falls through to localStorage for non-encrypted keys', async () => {
    await login();
    localStorage.setItem('swiss-tracker-auth', '{"jwt":"abc"}');
    expect(secureStorage.getItemSync('swiss-tracker-auth')).toBe('{"jwt":"abc"}');
  });

  it('removeItem clears both cache and localStorage', async () => {
    await login();
    await secureStorage.setItem('swiss-tracker-u1-visited-ch', '["ch-ag"]');
    secureStorage.removeItem('swiss-tracker-u1-visited-ch');
    expect(localStorage.getItem('swiss-tracker-u1-visited-ch')).toBeNull();
    expect(secureStorage.getItemSync('swiss-tracker-u1-visited-ch')).toBeNull();
  });

  it('clearActiveKey wipes cache', async () => {
    await login();
    await secureStorage.setItem('swiss-tracker-u1-visited-ch', '["ch-ag"]');
    clearActiveKey();
    expect(secureStorage.getItemSync('swiss-tracker-u1-visited-ch')).toBeNull();
  });

  it('decrypt fallback: pre-encryption plaintext is returned as-is', async () => {
    await login();
    // Simulate pre-existing plaintext (before encryption was added)
    localStorage.setItem('swiss-tracker-u1-visited-ch', '["ch-ag"]');
    const result = await secureStorage.getItem('swiss-tracker-u1-visited-ch');
    expect(result).toBe('["ch-ag"]'); // fallback, not a throw
  });

  it('warmCache decrypts all user keys into cache', async () => {
    const key = await login('warm-sub');
    // Write encrypted data directly
    const { encrypt } = await import('../crypto.js');
    const enc = await encrypt(key, '["ch-ag"]');
    localStorage.setItem('swiss-tracker-u99-visited-ch', enc);

    clearActiveKey();
    setActiveKey(key);
    await warmCache(99);

    expect(secureStorage.getItemSync('swiss-tracker-u99-visited-ch')).toBe('["ch-ag"]');
  });
});

describe('shouldEncrypt rule', () => {
  it('encrypts user-scoped keys', async () => {
    const key = await deriveKey('rule-sub');
    setActiveKey(key);
    await secureStorage.setItem('swiss-tracker-u1-visited-ch', 'data');
    const raw = localStorage.getItem('swiss-tracker-u1-visited-ch');
    expect(raw).not.toBe('data'); // encrypted
  });

  it('does NOT encrypt auth key', async () => {
    const key = await deriveKey('rule-sub-2');
    setActiveKey(key);
    await secureStorage.setItem('swiss-tracker-auth', '{"jwt":"tok"}');
    const raw = localStorage.getItem('swiss-tracker-auth');
    expect(raw).toBe('{"jwt":"tok"}'); // plain
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- secureStorage.test.js
```
Expected: `Error: Failed to resolve import "../secureStorage.js"`

- [ ] **Step 3: Implement `src/utils/secureStorage.js`**

```js
// src/utils/secureStorage.js
import { encrypt, decrypt } from './crypto.js';

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
        console.debug('[secureStorage] decrypt fallback for', key);
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
    if (activeKey && shouldEncrypt(key)) return null;
    return localStorage.getItem(key);
  },

  /** Removes from both cache and localStorage. */
  removeItem(key) {
    memCache.delete(key);
    localStorage.removeItem(key);
  },
};
```

- [ ] **Step 4: Run all tests**

```bash
npm run test -- secureStorage.test.js
```
Expected: `12 tests passed`

Also run the full suite to make sure nothing broke:

```bash
npm run test
```
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/secureStorage.js src/utils/__tests__/secureStorage.test.js
git commit -m "feat(secureStorage): add encrypted localStorage wrapper with sync cache"
```

---

### Task 3: Wire `AuthContext.jsx`

**Files:**
- Modify: `src/context/AuthContext.jsx`

The login flow must be: `deriveKey` → `setActiveKey` → `warmCache` → `syncLocalDataToServer`.
The mount effect (already-logged-in on page reload) also needs the same sequence.

- [ ] **Step 1: Add imports at top of AuthContext.jsx**

```js
import { deriveKey } from '../utils/crypto';
import { setActiveKey, clearActiveKey, warmCache } from '../utils/secureStorage';
```

- [ ] **Step 2: Replace the mount `useEffect` (lines 36–40)**

Old:
```js
useEffect(() => {
  if (auth?.jwt_token && auth?.user?.id) {
    syncLocalDataToServer(auth.jwt_token, auth.user.id).catch(() => {});
  }
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

New:
```js
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
```

- [ ] **Step 3: Replace the `login` callback body**

Old (inside `login`):
```js
setAuth(data);
saveAuth(data);

// Sync any anonymous localStorage data to the server
if (data.jwt_token && data.user?.id) {
  syncLocalDataToServer(data.jwt_token, data.user.id).catch(() => {});
}
```

New:
```js
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
```

- [ ] **Step 4: Replace the `logout` callback — add `clearActiveKey()` before clearing auth**

Old:
```js
const logout = useCallback(() => {
  clearBatch();
  const currentToken = auth?.jwt_token;
  if (currentToken) {
    // ... cacheInvalidatePrefix calls ...
  }
  setAuth(null);
  saveAuth(null);
}, [auth]);
```

New — add `clearActiveKey()` as the first line:
```js
const logout = useCallback(() => {
  clearActiveKey(); // wipe encryption key and decrypted data cache
  clearBatch();
  const currentToken = auth?.jwt_token;
  if (currentToken) {
    // ... existing cacheInvalidatePrefix calls unchanged ...
  }
  setAuth(null);
  saveAuth(null);
}, [auth]);
```

- [ ] **Step 5: Build to verify no import errors**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(auth): derive encryption key and warm cache on login/mount"
```

---

## Chunk 2: Hook and sync migrations

### Task 4: Migrate `useVisitedCantons.js`

**Files:**
- Modify: `src/hooks/useVisitedCantons.js`

This is the most complex hook — 8 localStorage call sites across 4 helper functions plus a render-body sync block.

- [ ] **Step 1: Add the import at the top of the file**

Add after the existing imports:
```js
import { secureStorage } from '../utils/secureStorage';
```

- [ ] **Step 2: Replace all 4 read helpers**

Old `loadLocal`:
```js
function loadLocal(countryId, userId) {
  try {
    const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
    ...
```

New:
```js
function loadLocal(countryId, userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
    ...
```

Apply the same change to `loadDates`, `loadNotes`, `loadWishlist` — replace `localStorage.getItem(` with `secureStorage.getItemSync(` in each.

- [ ] **Step 3: Replace all 4 write helpers**

Old `saveLocal`:
```js
function saveLocal(countryId, set, userId) {
  localStorage.setItem(storagePrefix(userId) + 'visited-' + countryId, JSON.stringify([...set]));
}
```

New (fire-and-forget — no await needed since cache is updated synchronously):
```js
function saveLocal(countryId, set, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'visited-' + countryId, JSON.stringify([...set]));
}
```

Apply the same change to `saveDates`, `saveNotes`, `saveWishlist`.

- [ ] **Step 4: Verify the render-body sync block (lines 184–198) still works**

The block calls `loadLocal()`, `loadDates()`, etc. — since those now call `secureStorage.getItemSync()`, which reads from the pre-warmed cache, this block works as-is. No change needed beyond the helper function updates in steps 2–3.

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useVisitedCantons.js
git commit -m "feat(hooks): encrypt region data in useVisitedCantons"
```

---

### Task 5: Migrate remaining hooks

**Files:**
- Modify: `src/hooks/useVisitedCountries.js`
- Modify: `src/hooks/useWishlist.js`
- Modify: `src/hooks/useAvatar.js`
- Modify: `src/hooks/useUnescoVisited.js`
- Modify: `src/hooks/useXp.jsx`

The pattern for each hook is identical to Task 4. Add the import, then:
- `localStorage.getItem(key)` → `secureStorage.getItemSync(key)` (reads)
- `localStorage.setItem(key, val)` → `secureStorage.setItem(key, val)` (writes, fire-and-forget)
- `localStorage.removeItem(key)` → `secureStorage.removeItem(key)` (deletes)

Only replace calls for **user-scoped keys** (keys that contain `storagePrefix(userId)` or match `swiss-tracker-u...`). Do **not** change calls for non-scoped keys.

- [ ] **Step 1: Add import to each of the 5 files**

In each file, add:
```js
import { secureStorage } from '../utils/secureStorage';
```

- [ ] **Step 2: `useVisitedCountries.js` — 2 calls (lines 16 and 26)**

```js
// Line 16 — read
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');

// Line 26 — write
secureStorage.setItem(storagePrefix(userId) + 'visited-world', JSON.stringify([...set]));
```

- [ ] **Step 3: `useWishlist.js` — 3 calls**

The bucket-list read (line 18), legacy migration loop read (line 27), and the write (line 55). Replace each `localStorage.getItem` with `secureStorage.getItemSync` and each `localStorage.setItem` with `secureStorage.setItem`.

- [ ] **Step 4: `useAvatar.js` — 2 calls**

Read (line 11) and write (line 21). Same substitution.

- [ ] **Step 5: `useUnescoVisited.js` — 2 calls**

Read (line 15) and write (line 25). Same substitution.

- [ ] **Step 6: `useXp.jsx` — user-scoped calls only**

Replace all calls that use `storagePrefix(userId)` in their key with `secureStorage` equivalents.
Do NOT change:
- `localStorage.getItem(LEGACY_AWARDED_KEY)` (line 68, legacy non-scoped key)
- `localStorage.removeItem(LEGACY_AWARDED_KEY)` (line 81, legacy removal)

All other calls in this file (xp, xp-log, xp-pending-deltas, xp-granted-keys) use the user prefix and should be replaced.

- [ ] **Step 7: Build**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useVisitedCountries.js src/hooks/useWishlist.js src/hooks/useAvatar.js src/hooks/useUnescoVisited.js src/hooks/useXp.jsx
git commit -m "feat(hooks): encrypt user data in remaining 5 hooks"
```

---

### Task 6: Make `syncLocalData.js` migrateKeys async

**Files:**
- Modify: `src/utils/syncLocalData.js`

`migrateKeys()` writes anonymous data into user-scoped keys. These writes must use `secureStorage.setItem` and must be awaited — if we removed the anonymous keys before the encrypted writes completed, we'd lose data.

- [ ] **Step 1: Add import**

```js
import { secureStorage } from './secureStorage';
```

- [ ] **Step 2: Make `migrateKeys` async and replace `localStorage.setItem` calls**

Old:
```js
function migrateKeys(userId, anonData) {
  const userPrefix = `swiss-tracker-u${userId}-`;
  for (const [countryId, data] of Object.entries(anonData.regions)) {
    if (data.visited.length > 0) {
      localStorage.setItem(userPrefix + 'visited-' + countryId, JSON.stringify(data.visited));
    }
    if (Object.keys(data.dates).length > 0) {
      localStorage.setItem(userPrefix + 'dates-' + countryId, JSON.stringify(data.dates));
    }
    if (Object.keys(data.notes).length > 0) {
      localStorage.setItem(userPrefix + 'notes-' + countryId, JSON.stringify(data.notes));
    }
    if (data.wishlist.length > 0) {
      localStorage.setItem(userPrefix + 'wishlist-' + countryId, JSON.stringify(data.wishlist));
    }
  }
  if (anonData.world && anonData.world.length > 0) {
    localStorage.setItem(userPrefix + 'visited-world', JSON.stringify(anonData.world));
  }
  // Remove anonymous keys
  ...keysToRemove.forEach((k) => localStorage.removeItem(k));
}
```

New:
```js
async function migrateKeys(userId, anonData) {
  const userPrefix = `swiss-tracker-u${userId}-`;
  const writes = [];
  for (const [countryId, data] of Object.entries(anonData.regions)) {
    if (data.visited.length > 0) {
      writes.push(secureStorage.setItem(userPrefix + 'visited-' + countryId, JSON.stringify(data.visited)));
    }
    if (Object.keys(data.dates).length > 0) {
      writes.push(secureStorage.setItem(userPrefix + 'dates-' + countryId, JSON.stringify(data.dates)));
    }
    if (Object.keys(data.notes).length > 0) {
      writes.push(secureStorage.setItem(userPrefix + 'notes-' + countryId, JSON.stringify(data.notes)));
    }
    if (data.wishlist.length > 0) {
      writes.push(secureStorage.setItem(userPrefix + 'wishlist-' + countryId, JSON.stringify(data.wishlist)));
    }
  }
  if (anonData.world && anonData.world.length > 0) {
    writes.push(secureStorage.setItem(userPrefix + 'visited-world', JSON.stringify(anonData.world)));
  }
  await Promise.all(writes); // all encrypted writes complete before removing anon keys

  // Remove anonymous keys (unchanged)
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(ANON_PREFIX)) continue;
    if (USER_PREFIX_RE.test(key)) continue;
    if (key === 'swiss-tracker-auth') continue;
    keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}
```

- [ ] **Step 3: Update the `syncLocalDataToServer` call of `migrateKeys` to await it**

Line 225 currently:
```js
migrateKeys(userId, anonData);
```

New:
```js
await migrateKeys(userId, anonData);
```

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/syncLocalData.js
git commit -m "feat(sync): encrypt migrated data in migrateKeys"
```

---

## Chunk 3: Utility and component migrations

### Task 7: Migrate achievement and stat utilities

**Files:**
- Modify: `src/utils/achievementProgress.js`
- Modify: `src/utils/achievementDetail.js`
- Modify: `src/data/achievements.js`
- Modify: `src/utils/allTimeStats.js`
- Modify: `src/utils/yearStats.js`

All of these call `localStorage.getItem(storagePrefix(userId) + ...)` synchronously. Replace each with `secureStorage.getItemSync(...)`. Since `warmCache` runs at login before these utilities are ever called, the cache is already warm and `getItemSync` returns the correct decrypted value.

- [ ] **Step 1: Add the import to each file**

In each of the 5 files, add:
```js
import { secureStorage } from './secureStorage';
```

(For `src/data/achievements.js`, the import path is `'../utils/secureStorage'`.)

- [ ] **Step 2: Replace all user-scoped `localStorage.getItem` calls**

In **achievementProgress.js** (lines 27, 55):
```js
// Before:
const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
const worldRaw = localStorage.getItem(storagePrefix(userId) + 'visited-world');

// After:
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
const worldRaw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
```

The easter egg check (line 303) uses a non-user-scoped key — leave it as `localStorage.getItem`.

In **achievementDetail.js** (lines 23, 34):
```js
// Before:
const raw = localStorage.getItem(storagePrefix(userId) + 'visited-' + countryId);
const worldRaw = localStorage.getItem(storagePrefix(userId) + 'visited-world');

// After:
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
const worldRaw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
```

In **achievements.js** (lines 18, 46) — user-scoped visited reads only. Line 201 (easter egg) is non-scoped, leave unchanged:
```js
// User-scoped reads only:
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
const worldRaw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
```

In **allTimeStats.js** (lines 37, 61):
```js
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-world');
const regionRaw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + c.id);
```

In **yearStats.js** — replace all `localStorage.getItem` calls that use `storagePrefix(userId)` with `secureStorage.getItemSync`.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | grep -E "error|Error"
```
Expected: no errors

- [ ] **Step 4: Run the test suite**

```bash
npm run test
```
Expected: all tests pass (achievement/stat tests use localStorage directly in setup — that's fine, the mocked data is unencrypted and `getItemSync` falls through to localStorage when no activeKey is set).

- [ ] **Step 5: Commit**

```bash
git add src/utils/achievementProgress.js src/utils/achievementDetail.js src/data/achievements.js src/utils/allTimeStats.js src/utils/yearStats.js
git commit -m "feat(utils): read encrypted data via secureStorage.getItemSync in stat/achievement utils"
```

---

### Task 8: Migrate components that read localStorage directly

**Files:**
- Modify: `src/components/StatsModal.jsx`
- Modify: `src/components/OverallProgress.jsx`
- Modify: `src/components/WorldSidebar.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Add import to each component**

```js
import { secureStorage } from '../utils/secureStorage';
```

- [ ] **Step 2: `StatsModal.jsx` — 3 reads (lines 25, 38, 147)**

Replace each `localStorage.getItem(storagePrefix(userId) + ...)` with `secureStorage.getItemSync(...)`.

- [ ] **Step 3: `OverallProgress.jsx` — 1 read (line 11)**

```js
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
```

- [ ] **Step 4: `WorldSidebar.jsx` — 1 read (line 35)**

```js
const raw = secureStorage.getItemSync(storagePrefix(userId) + 'visited-' + countryId);
```

- [ ] **Step 5: `App.jsx` — achievement-seen and confetti milestone keys**

`App.jsx` reads and writes two user-scoped keys: `swiss-tracker-u{userId}-achievements-seen` and `swiss-tracker-u{userId}-confetti-milestones`.

For reads (lines 73, 452) — replace `localStorage.getItem(seenKey)` with `secureStorage.getItemSync(seenKey)`, and `localStorage.getItem(confettiKey)` with `secureStorage.getItemSync(confettiKey)`.

For writes (lines 81, 107, 459) — replace `localStorage.setItem(seenKey, ...)` with `secureStorage.setItem(seenKey, ...)` (fire-and-forget, no await).

Non-user-scoped legacy wishlist reads (lines 215, 220) — leave as `localStorage` since these are anonymous legacy migration paths.

- [ ] **Step 6: Build and test**

```bash
npm run build 2>&1 | grep -E "error|Error"
npm run test
```
Expected: no build errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/StatsModal.jsx src/components/OverallProgress.jsx src/components/WorldSidebar.jsx src/App.jsx
git commit -m "feat(components): read encrypted user data via secureStorage in components"
```

---

## Chunk 4: Verification

### Task 9: Manual QA + push

- [ ] **Step 1: Run the full test suite one final time**

```bash
npm run test
```
Expected: all tests pass.

- [ ] **Step 2: Start dev server and test the login flow manually**

```bash
npm run dev
```

Open browser DevTools → Application → Local Storage.

**QA checklist:**
- [ ] Sign in with Google
- [ ] Mark a region as visited in any tracker
- [ ] In DevTools, verify the `swiss-tracker-u{id}-visited-{country}` key contains a base64url string (not a JSON array)
- [ ] Verify `swiss-tracker-auth` is still plain JSON (not encrypted)
- [ ] Reload the page — data should still load correctly (cache warmed from encrypted localStorage)
- [ ] Open Profile → Achievements → verify badges render correctly (not all 0)
- [ ] Open Stats Modal — verify country/region counts are correct
- [ ] Sign out → verify localStorage keys for visited data still exist (encrypted) but the app shows empty state
- [ ] Sign back in — verify data reappears correctly (re-decrypted on login)

- [ ] **Step 3: Build for production**

```bash
npm run build 2>&1 | tail -8
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Push and open PR**

```bash
git push origin HEAD
```
