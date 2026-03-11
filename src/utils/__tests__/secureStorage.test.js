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
