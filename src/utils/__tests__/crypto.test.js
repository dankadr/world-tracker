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
