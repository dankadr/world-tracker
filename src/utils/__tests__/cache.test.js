import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheGet,
  cacheSet,
  cacheGetStale,
  cacheInvalidate,
  cacheInvalidatePrefix,
} from '../cache';

const TTL = 60_000; // 1 minute

describe('cacheSet / cacheGet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  it('returns stored value within TTL', () => {
    cacheSet('key1', { hello: 'world' });
    expect(cacheGet('key1', TTL)).toEqual({ hello: 'world' });
  });

  it('returns null when key is absent', () => {
    expect(cacheGet('missing', TTL)).toBeNull();
  });

  it('returns null after TTL has elapsed', () => {
    cacheSet('key2', 42);
    vi.advanceTimersByTime(TTL + 1);
    expect(cacheGet('key2', TTL)).toBeNull();
  });

  it('removes the key from localStorage after TTL expiry', () => {
    cacheSet('key3', 'data');
    vi.advanceTimersByTime(TTL + 1);
    cacheGet('key3', TTL); // triggers cleanup
    expect(localStorage.getItem('cache:key3')).toBeNull();
  });

  it('returns value at exactly 1ms before TTL boundary', () => {
    cacheSet('boundary', 'value');
    vi.advanceTimersByTime(TTL - 1);
    expect(cacheGet('boundary', TTL)).toBe('value');
  });

  it('still returns value at exactly TTL elapsed (cache uses strict >)', () => {
    cacheSet('exact', 'value');
    vi.advanceTimersByTime(TTL); // diff === TTL, not > TTL
    expect(cacheGet('exact', TTL)).toBe('value');
  });

  it('returns null 1ms past TTL', () => {
    cacheSet('past', 'value');
    vi.advanceTimersByTime(TTL + 1);
    expect(cacheGet('past', TTL)).toBeNull();
  });

  it('stores and retrieves primitive values', () => {
    cacheSet('num', 99);
    cacheSet('bool', true);
    cacheSet('str', 'hello');
    expect(cacheGet('num', TTL)).toBe(99);
    expect(cacheGet('bool', TTL)).toBe(true);
    expect(cacheGet('str', TTL)).toBe('hello');
  });
});

describe('cacheGetStale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  it('returns value regardless of TTL', () => {
    cacheSet('stale1', 'staleValue');
    vi.advanceTimersByTime(TTL * 10); // far past TTL
    expect(cacheGetStale('stale1')).toBe('staleValue');
  });

  it('returns null for missing key', () => {
    expect(cacheGetStale('nonexistent')).toBeNull();
  });
});

describe('cacheInvalidate', () => {
  it('removes a single key', () => {
    cacheSet('remove-me', 'gone');
    cacheSet('keep-me', 'stay');
    cacheInvalidate('remove-me');
    expect(cacheGet('remove-me', TTL)).toBeNull();
    expect(cacheGet('keep-me', TTL)).toBe('stay');
  });

  it('is a no-op for missing key', () => {
    expect(() => cacheInvalidate('does-not-exist')).not.toThrow();
  });
});

describe('cacheInvalidatePrefix', () => {
  it('removes all keys matching the prefix', () => {
    cacheSet('u42:profile', 'Alice');
    cacheSet('u42:settings', { theme: 'dark' });
    cacheSet('u99:profile', 'Bob');
    cacheInvalidatePrefix('u42:');
    expect(cacheGet('u42:profile', TTL)).toBeNull();
    expect(cacheGet('u42:settings', TTL)).toBeNull();
  });

  it('leaves non-matching keys intact', () => {
    cacheSet('u42:data', 'x');
    cacheSet('u99:data', 'y');
    cacheInvalidatePrefix('u42:');
    expect(cacheGet('u99:data', TTL)).toBe('y');
  });

  it('is a no-op when no keys match the prefix', () => {
    cacheSet('u99:data', 'safe');
    expect(() => cacheInvalidatePrefix('u00:')).not.toThrow();
    expect(cacheGet('u99:data', TTL)).toBe('safe');
  });
});
