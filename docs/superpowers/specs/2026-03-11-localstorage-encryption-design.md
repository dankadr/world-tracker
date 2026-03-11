# localStorage Encryption Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Encrypt all user travel data before it is written to localStorage and before it is synced to the server. The server (and its operator) should store ciphertext — not readable JSON. A DB breach alone should not make data trivially readable without additional source-code knowledge and per-user computation. Anonymous users (no Google account) are out of scope; their data never reaches the server.

## Security Model (honest assessment)

The key is derived from `user.sub` + a fixed app salt. The backend stores `user.sub` in the users table. This means an attacker with full DB access has both ciphertext and the key input. However, they would additionally need:

1. The source code to know the derivation algorithm and salt
2. 100 000 PBKDF2 iterations of computation per user

This is meaningfully harder than reading plaintext, and satisfies the stated goal (level C: not plain text, noticeably harder for an attacker). It is **not** zero-knowledge encryption. This is explicitly accepted.

## Algorithm

- **Cipher:** AES-256-GCM (authenticated encryption — detects tampering)
- **Key derivation:** PBKDF2, SHA-256, 100 000 iterations
- **Key material:** `user.sub` + fixed salt `"rightworld-v1"`
- **IV:** 12-byte random per write, prepended to ciphertext
- **Output format:** URL-safe base64 (no `+`, `/`, `=` padding) of `[IV (12 bytes) | ciphertext]`
- **API:** Browser-native `window.crypto.subtle` — zero new npm dependencies

## What Gets Encrypted

| Storage key pattern | Encrypted? |
|---|---|
| `swiss-tracker-u{id}-visited-{country}` | Yes |
| `swiss-tracker-u{id}-dates-{country}` | Yes |
| `swiss-tracker-u{id}-notes-{country}` | Yes |
| `swiss-tracker-u{id}-wishlist-{country}` | Yes (legacy key, read during migration) |
| `swiss-tracker-u{id}-bucket-list` | Yes (current wishlist key) |
| `swiss-tracker-u{id}-visited-world` | Yes |
| `swiss-tracker-u{id}-avatar` | Yes |
| `swiss-tracker-auth` | No (JWT, not user data) |
| `cache:*` | No (transient, server-derived) |
| `onboarding-dismissed` | No (non-sensitive setting) |
| `swiss-tracker-visited-*` (no userId) | No (anonymous, out of scope) |

Rule: encrypt any key matching `^swiss-tracker-u\d` (user-scoped keys only).

## Architecture

### `src/utils/crypto.js` (new)

Single responsibility: key derivation and AES-GCM encrypt/decrypt.

- `deriveKey(sub: string): Promise<CryptoKey>` — PBKDF2 derivation. Result cached in a module-level `Map<sub, CryptoKey>` so derivation only runs once per session.
- `encrypt(key: CryptoKey, plaintext: string): Promise<string>` — encrypts to URL-safe base64.
- `decrypt(key: CryptoKey, ciphertext: string): Promise<string>` — decrypts. Throws on auth tag mismatch or bad input (caller handles fallback).

### `src/utils/secureStorage.js` (new)

Drop-in async wrapper around `localStorage`. Holds a module-level `activeKey: CryptoKey | null`.

- `setActiveKey(key: CryptoKey): void` — called on login, after key derivation completes.
- `clearActiveKey(): void` — called on logout.
- `secureStorage.getItem(key: string): Promise<string | null>` — reads raw value; if `activeKey` is set and key matches the encrypt pattern, attempts decrypt; on failure (corrupt data, pre-encryption plaintext) returns raw value and logs at `debug` level (not `warn` — fallback is expected during migration window).
- `secureStorage.setItem(key: string, value: string): Promise<void>` — encrypts if `activeKey` is set and key matches pattern; otherwise plain write.
- `secureStorage.removeItem(key: string): void` — plain passthrough (no encryption needed for deletes).

### `src/context/AuthContext.jsx` (modified)

The login function must be refactored to enforce strict ordering:

```
1. POST /auth/google → { jwt_token, user }
2. saveAuth(jwt_token, user)           ← existing
3. await deriveKey(user.sub)           ← NEW, must complete before step 4
4. setActiveKey(derivedCryptoKey)      ← NEW
5. syncLocalDataToServer(token, userId) ← existing, now runs after key is active
```

Step 3 must be awaited before step 5. If derivation fails, log the error and proceed without encryption (app stays functional).

On logout: call `clearActiveKey()` before clearing auth state.

### `src/utils/syncLocalData.js` (modified)

`collectAnonymousData()` reads anonymous (unscoped) keys — these are never encrypted, so no change needed there.

`migrateKeys()` writes data into user-scoped keys. These writes must go through `secureStorage.setItem` so migrated data is immediately encrypted. Replace direct `localStorage.setItem` calls with `await secureStorage.setItem` in this function.

### Hook migrations

Every hook that directly calls `localStorage` for user-scoped travel data must be updated. Exhaustive list:

| File | Change needed |
|---|---|
| `src/hooks/useVisitedCountries.js` | `localStorage` → `secureStorage`; render-body sync read → `useEffect` |
| `src/hooks/useVisitedCantons.js` (exports `useVisitedRegions`) | `localStorage` → `secureStorage`; all 10+ call sites, including render-body reads |
| `src/hooks/useWishlist.js` | `localStorage` → `secureStorage` |
| `src/hooks/useAvatar.js` | `localStorage` → `secureStorage` |
| `src/hooks/useXp.js` | `localStorage` → `secureStorage` if it reads user-scoped keys |
| `src/hooks/useUnescoVisited.js` | `localStorage` → `secureStorage` |

**Render-body synchronous read pattern** (found in `useVisitedCountries` and `useVisitedRegions`): these hooks currently read localStorage synchronously in the render body (outside `useEffect`) to detect country/userId changes. Migration approach: convert to a `useEffect` with the same deps array; set a loading flag while the async read is in flight; return empty data during loading. The loading state is already implicit in these hooks (they return `[]` before data loads from the server).

### Stats utilities and achievement checks

`allTimeStats.js`, `yearStats.js`, and `achievementProgress.js` call `localStorage.getItem()` synchronously and are called from both hooks and other utilities. Making them fully async has a large ripple effect (achievement `check()` functions are sync today).

**Approach:** These utilities are called from within hooks that will already have async-loaded the data. Rather than making them async, pass the already-decrypted data as parameters where feasible, or read from the hook's in-memory state. As a pragmatic minimum: the hooks call these utilities only after their own `useEffect` reads have completed, so the data in localStorage will have been re-encrypted by then — but the utilities will fail to decrypt it since they bypass `secureStorage`.

**Concrete resolution:** Export async variants of the utility functions that use `secureStorage.getItem` internally. Call these async variants from the hooks' `useEffect` blocks. The synchronous originals can remain for any non-hook callers (e.g. direct calls during YearInReview rendering) until those callers are also migrated.

Files to update: `src/utils/allTimeStats.js`, `src/utils/yearStats.js`, `src/utils/achievementProgress.js`, `src/utils/achievementDetail.js`.

### Migration of existing plaintext data

No explicit migration loop. On first login after the feature ships:
1. `secureStorage.getItem` reads the existing plaintext value.
2. Decryption fails → fallback returns the raw plaintext (logged at `debug` level).
3. The hook parses it normally and sets state.
4. On next write (any state update), `secureStorage.setItem` writes it back encrypted.

Data is migrated key-by-key as it is naturally accessed and written. The `debug` log spam is expected and intentional during the migration window; it self-resolves once each key is written.

## Sequence: Login Flow

```
User signs in with Google
  → AuthContext.login(googleToken)
  → POST /auth/google → { jwt_token, user }
  → saveAuth(jwt_token, user)
  → key = await deriveKey(user.sub)     [~100ms, one-time, cached]
  → setActiveKey(key)
  → await warmCache(user.id)            [decrypt all existing user keys into memCache]
  → await syncLocalDataToServer(...)    [reads anonymous plaintext, writes user-scoped encrypted]
```

## Sequence: Data Write

```
User marks a region visited
  → hook calls: await secureStorage.setItem("swiss-tracker-u123-visited-ch", "[\"ch-ag\"]")
  → shouldEncrypt("swiss-tracker-u123-visited-ch") → true
  → encrypt(activeKey, "[\"ch-ag\"]") → "base64url..."
  → localStorage.setItem("swiss-tracker-u123-visited-ch", "base64url...")
  → API sync sends the same base64url blob to the server (server stores ciphertext)
```

## Sequence: Data Read

```
App mounts, hook useEffect fires
  → raw = await secureStorage.getItem("swiss-tracker-u123-visited-ch")
  → localStorage.getItem → "base64url..."
  → decrypt(activeKey, "base64url...") → "[\"ch-ag\"]"
  → JSON.parse → ["ch-ag"]
  → setState(["ch-ag"])
```

## Error Handling

- **Decrypt failure** (corrupt data, wrong key, pre-encryption plaintext): return raw value, log at `debug` level. App never crashes due to a bad decrypt.
- **Key derivation failure** (Web Crypto unavailable): fall back to unencrypted storage, log error at `warn` level. App remains functional.
- **`activeKey` not set** (anonymous user, derivation not yet complete, or failure): all reads/writes are plain passthrough.
- **`deriveKey` called before `setActiveKey`:** impossible by construction — `setActiveKey` is called inside `login()` synchronously after `await deriveKey()` resolves.

## Non-goals

- Zero-knowledge encryption (operator can derive keys from `sub` + source — accepted)
- Encrypting the auth JWT
- Encrypting anonymous user data
- Key rotation or re-encryption
- Protecting data from an attacker who has both DB access and the application source code
