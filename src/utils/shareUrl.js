import LZString from 'lz-string';

// Prefix used to distinguish compressed URLs from legacy base64 URLs
const LZ_PREFIX = 'lz1_';

export function encodeShareData(data) {
  return LZ_PREFIX + LZString.compressToEncodedURIComponent(JSON.stringify(data));
}

export function decodeShareData(encoded) {
  try {
    if (encoded.startsWith(LZ_PREFIX)) {
      const compressed = encoded.slice(LZ_PREFIX.length);
      return JSON.parse(LZString.decompressFromEncodedURIComponent(compressed));
    }
    // Legacy: plain base64 JSON
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}
