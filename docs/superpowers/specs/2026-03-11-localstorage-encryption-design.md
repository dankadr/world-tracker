# localStorage Encryption Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Encrypt all user travel data before it is written to localStorage and before it is synced to the server. The server (and its operator) should store ciphertext — not readable JSON. A database breach alone should not expose user data. Anonymous users (no Google account) are out of scope; their data never reaches the server.

## Algorithm

- **Cipher:** AES-256-GCM (authenticated encryption — detects tampering)
- **Key derivation:** PBKDF2, SHA-256, 100 000 iterations
- **Key material:** `user.sub` (permanent Google user ID) + fixed salt `"rightworld-v1"`
- **IV:** 12-byte random, prepended to ciphertext, re-generated on every write
- **Output format:** base64-encoded `[IV (12 bytes) | ciphertext]`
- **API:** Browser-native `window.crypto.subtle` — zero new npm dependencies

## What Gets Encrypted

| Storage key pattern | Encrypted? |
|---|---|
| `swiss-tracker-u{id}-visited-{country}` | Yes |
| `swiss-tracker-u{id}-dates-{country}` | Yes |
| `swiss-tracker-u{id}-notes-{country}` | Yes |
| `swiss-tracker-u{id}-wishlist-{country}` | Yes |
| `swiss-tracker-u{id}-visited-world` | Yes |
| `swiss-tracker-u{id}-avatar` | Yes |
| `swiss-tracker-auth` | No (JWT, not user data) |
| `cache:*` | No (transient, server-derived) |
| `onboarding-dismissed` | No (non-sensitive setting) |

Rule: encrypt any key matching `^swiss-tracker` that does not contain `-auth`.
Anonymous keys (no `u{id}` segment) are also excluded — anonymous users are out of scope.

## Architecture

### `src/utils/crypto.js` (new)

Single responsibility: key derivation and AES-GCM encrypt/decrypt.

- `deriveKey(sub: string): Promise<CryptoKey>` — PBKDF2 derivation, result cached in a module-level `Map<sub, CryptoKey>` so derivation only runs once per session.
- `encrypt(key: CryptoKey, plaintext: string): Promise<string>` — encrypts to base64.
- `decrypt(key: CryptoKey, ciphertext: string): Promise<string>` — decrypts from base64. Throws on failure (caller handles migration fallback).

### `src/utils/secureStorage.js` (new)

Drop-in async wrapper around `localStorage`. Holds a module-level `activeKey: CryptoKey | null`.

- `setActiveKey(key: CryptoKey): void` — called on login.
- `clearActiveKey(): void` — called on logout.
- `secureStorage.getItem(key: string): Promise<string | null>` — reads raw value; if `activeKey` is set and key matches the encrypt pattern, attempts decrypt; on decrypt failure returns raw value (transparent migration of pre-encryption plaintext).
- `secureStorage.setItem(key: string, value: string): Promise<void>` — encrypts if `activeKey` is set and key matches pattern; otherwise plain write.
- `secureStorage.removeItem(key: string): void` — plain passthrough.

### `src/context/AuthContext.jsx` (modified)

On login (after `user.sub` is available): call `deriveKey(user.sub)` → `setActiveKey(key)`.
On logout: call `clearActiveKey()`.
No other auth logic changes.

### Hook migrations (modified — ~6 files)

Every hook that reads/writes travel data swaps direct `localStorage` calls for `secureStorage`. Because `secureStorage.getItem` is async, reads that previously used synchronous lazy state initializers (`useState(() => JSON.parse(localStorage.getItem(...)))`) move into a `useEffect`. Writes already happen inside effects or callbacks, so those are a straightforward substitution.

Affected hooks:
- `src/hooks/useVisitedCountries.js`
- `src/hooks/useWishlist.js`
- `src/hooks/useAvatar.js`
- `src/hooks/useVisitedCantons.js` (and similar sub-tracker hooks)
- Any hook that directly calls `localStorage` for travel data

Stats utilities (`allTimeStats.js`, `yearStats.js`) and achievement checks read localStorage synchronously. These will be updated to use `secureStorage` as well, making their exported functions async.

### Migration of existing plaintext data

No explicit migration loop. On first login after the feature ships:
1. `secureStorage.getItem` reads the existing plaintext value.
2. Decryption fails → fallback returns the raw plaintext.
3. The hook parses it normally and sets state.
4. On next write (any state update), `secureStorage.setItem` writes it back encrypted.

This means data is migrated key-by-key as it is naturally accessed and updated. No one-time migration pass is needed.

## Sequence: Login Flow

```
User clicks "Sign in with Google"
  → AuthContext.login(googleToken)
  → POST /auth/google → { jwt_token, user: { id, sub, ... } }
  → deriveKey(user.sub)           [~100ms, one-time]
  → setActiveKey(derivedKey)
  → syncLocalDataToServer(token, userId)   [existing, now reads via secureStorage]
```

## Sequence: Data Write

```
User marks a region visited
  → hook calls secureStorage.setItem("swiss-tracker-u123-visited-ch", "[\"ch-ag\"]")
  → shouldEncrypt() → true
  → encrypt(activeKey, "[\"ch-ag\"]") → "base64blob..."
  → localStorage.setItem("swiss-tracker-u123-visited-ch", "base64blob...")
  → API sync sends the same base64blob to the server
```

## Sequence: Data Read

```
App mounts, hook useEffect fires
  → secureStorage.getItem("swiss-tracker-u123-visited-ch")
  → localStorage.getItem → "base64blob..."
  → decrypt(activeKey, "base64blob...") → "[\"ch-ag\"]"
  → JSON.parse → ["ch-ag"]
  → setState(["ch-ag"])
```

## Error Handling

- Decrypt failure (corrupt data, wrong key, pre-encryption plaintext): return raw value and log a warning. This ensures the app never hard-crashes due to a bad decrypt.
- Key derivation failure (Web Crypto unavailable): fall back to unencrypted storage and log an error. The app remains functional.
- `activeKey` not set (anonymous user or derivation failed): all reads/writes are plain passthrough.

## Non-goals

- Zero-knowledge encryption (the operator could in principle derive the same key from `sub` + source code — this is accepted)
- Encrypting the auth JWT
- Encrypting anonymous user data
- Key rotation or re-encryption on sub change
