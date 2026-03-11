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
