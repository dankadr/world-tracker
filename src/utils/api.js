/**
 * Shared API utilities for visited data.
 *
 * Provides a bulk-fetch function that loads all visited regions + world data
 * in a single request, with an in-memory cache so multiple hooks share one
 * network call per page load.
 */

let _bulkCache = null;
let _bulkPromise = null;
let _bulkToken = null;

/**
 * Fetch all visited data (regions + world) in one request.
 * Caches the result so multiple hooks share a single network call.
 *
 * @param {string} token  JWT auth token
 * @param {boolean} force  Bypass cache and re-fetch
 * @returns {Promise<{regions: Object, world: string[]}|null>}
 */
export async function fetchAllVisited(token, force = false) {
  if (!force && _bulkCache && _bulkToken === token) return _bulkCache;
  if (!force && _bulkPromise && _bulkToken === token) return _bulkPromise;

  _bulkToken = token;
  _bulkPromise = fetch('/api/visited/all', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      _bulkCache = data;
      _bulkPromise = null;
      return data;
    })
    .catch(() => {
      _bulkPromise = null;
      return null;
    });

  return _bulkPromise;
}

/**
 * Invalidate the bulk cache so the next fetchAllVisited() re-fetches.
 */
export function invalidateBulkCache() {
  _bulkCache = null;
  _bulkPromise = null;
}

/**
 * Delete all visited region data for the authenticated user (used by resetAll).
 *
 * @param {string} token  JWT auth token
 */
export async function deleteAllVisited(token) {
  try {
    const res = await fetch('/api/visited/all', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) console.error(`deleteAllVisited failed: ${res.status}`);
  } catch (err) {
    console.error('deleteAllVisited network error:', err);
  }
}
