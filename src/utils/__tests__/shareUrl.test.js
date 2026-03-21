import { describe, expect, it } from 'vitest';
import { encodeShareData, decodeShareData } from '../shareUrl';

// Simulates a heavy user: world tracker with 195 countries + NYC with 188 neighborhoods
function buildLargePayload() {
  const data = {};
  // 195 two-letter country codes
  const worldVisited = Array.from({ length: 195 }, (_, i) => {
    const code = String.fromCharCode(65 + Math.floor(i / 26)) +
                 String.fromCharCode(65 + (i % 26));
    return code;
  });
  data.world = worldVisited;
  // Simulate a dense region tracker (e.g., NYC neighborhoods)
  data.nyc = Array.from({ length: 188 }, (_, i) => `nyc-neighborhood-${i}`);
  return data;
}

describe('shareUrl', () => {
  it('encodes and decodes a payload round-trip correctly', () => {
    const original = { world: ['US', 'CA', 'MX'], ch: ['ZH', 'BE'] };
    const encoded = encodeShareData(original);
    expect(decodeShareData(encoded)).toEqual(original);
  });

  it('keeps the share URL under 2000 characters for a large payload', () => {
    const payload = buildLargePayload();
    const encoded = encodeShareData(payload);
    const url = `https://example.com/#share=${encoded}`;
    expect(url.length).toBeLessThan(2000);
  });

  it('decodes legacy base64-encoded share data for backwards compatibility', () => {
    const legacy = { world: ['US', 'CA'] };
    const legacyEncoded = btoa(JSON.stringify(legacy));
    expect(decodeShareData(legacyEncoded)).toEqual(legacy);
  });

  it('returns null for invalid encoded data', () => {
    expect(decodeShareData('not-valid-data')).toBeNull();
  });
});
