/**
 * Syncs anonymous localStorage data to the server on login.
 *
 * Anonymous data uses keys like:
 *   swiss-tracker-visited-{countryId}
 *   swiss-tracker-dates-{countryId}
 *   swiss-tracker-notes-{countryId}
 *   swiss-tracker-wishlist-{countryId}
 *   swiss-tracker-visited-world
 *
 * On login these are missed because the hooks switch to user-scoped keys
 * (swiss-tracker-u{userId}-...). This function scans for anonymous data,
 * merges it with whatever the server already has, pushes the merged result,
 * then copies it into the user-scoped keys and removes the anonymous keys.
 */

import { invalidateBulkCache } from './api';

const ANON_PREFIX = 'swiss-tracker-';
const USER_PREFIX_RE = /^swiss-tracker-u\d+-/;

// --------------- helpers ---------------

function parseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Scan localStorage for all anonymous (non-user-scoped) tracker keys.
 * Returns a map:
 *   { [countryId]: { visited: [...], dates: {...}, notes: {...}, wishlist: [...] } }
 * plus a `world` entry if present.
 */
function collectAnonymousData() {
  const result = { regions: {}, world: null };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(ANON_PREFIX)) continue;
    // Skip user-scoped keys (swiss-tracker-u123-...)
    if (USER_PREFIX_RE.test(key)) continue;
    // Skip the auth key
    if (key === 'swiss-tracker-auth') continue;

    const suffix = key.slice(ANON_PREFIX.length); // e.g. "visited-ch", "dates-us", "visited-world"

    if (suffix === 'visited-world') {
      const arr = parseJson(localStorage.getItem(key));
      if (Array.isArray(arr) && arr.length > 0) result.world = arr;
      continue;
    }

    const match = suffix.match(/^(visited|dates|notes|wishlist)-(.+)$/);
    if (!match) continue;

    const [, type, countryId] = match;
    const raw = localStorage.getItem(key);
    const parsed = parseJson(raw);
    if (!parsed) continue;

    if (!result.regions[countryId]) {
      result.regions[countryId] = { visited: [], dates: {}, notes: {}, wishlist: [] };
    }

    if (type === 'visited' && Array.isArray(parsed) && parsed.length > 0) {
      result.regions[countryId].visited = parsed;
    } else if (type === 'dates' && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      result.regions[countryId].dates = parsed;
    } else if (type === 'notes' && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      result.regions[countryId].notes = parsed;
    } else if (type === 'wishlist' && Array.isArray(parsed) && parsed.length > 0) {
      result.regions[countryId].wishlist = parsed;
    }
  }

  // Drop country entries that ended up empty
  for (const [cId, data] of Object.entries(result.regions)) {
    if (
      data.visited.length === 0 &&
      Object.keys(data.dates).length === 0 &&
      Object.keys(data.notes).length === 0 &&
      data.wishlist.length === 0
    ) {
      delete result.regions[cId];
    }
  }

  return result;
}

/**
 * Copy values into user-scoped localStorage keys and remove anonymous keys.
 */
function migrateKeys(userId, anonData) {
  const userPrefix = `swiss-tracker-u${userId}-`;

  // Regions
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

  // World
  if (anonData.world && anonData.world.length > 0) {
    localStorage.setItem(userPrefix + 'visited-world', JSON.stringify(anonData.world));
  }

  // Remove anonymous keys
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

// --------------- merge helpers ---------------

function mergeArrays(local, remote) {
  return [...new Set([...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])])];
}

function mergeObjects(local, remote) {
  // local wins for conflicting keys (user's most recent edits)
  return { ...remote, ...local };
}

// --------------- main sync function ---------------

/**
 * Check for anonymous localStorage data and push it to the server,
 * merging with existing remote data.
 *
 * @param {string} token  JWT auth token
 * @param {number|string} userId  User ID for scoping localStorage keys
 * @returns {Promise<boolean>}  true if any data was synced
 */
export async function syncLocalDataToServer(token, userId) {
  if (!token || !userId) return false;

  const anonData = collectAnonymousData();
  const hasRegions = Object.keys(anonData.regions).length > 0;
  const hasWorld = anonData.world && anonData.world.length > 0;

  if (!hasRegions && !hasWorld) return false;

  console.log('[sync] Found anonymous local data, syncing to server…', {
    regions: Object.keys(anonData.regions),
    worldCountries: anonData.world?.length || 0,
  });

  try {
    // Fetch current server state
    let serverData = null;
    try {
      const res = await fetch('/api/visited/all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) serverData = await res.json();
    } catch { /* server unreachable – still save what we can */ }

    const serverRegions = serverData?.regions || {};
    const serverWorld = serverData?.world || [];

    // --- Sync regions ---
    const regionPromises = Object.entries(anonData.regions).map(
      async ([countryId, localData]) => {
        const remote = serverRegions[countryId] || {};
        const merged = {
          regions: mergeArrays(localData.visited, remote.regions || []),
          dates: mergeObjects(localData.dates, remote.dates || {}),
          notes: mergeObjects(localData.notes, remote.notes || {}),
          wishlist: mergeArrays(localData.wishlist, remote.wishlist || []),
        };

        // Update anonymous data object with merged values for localStorage migration
        anonData.regions[countryId].visited = merged.regions;
        anonData.regions[countryId].dates = merged.dates;
        anonData.regions[countryId].notes = merged.notes;
        anonData.regions[countryId].wishlist = merged.wishlist;

        await fetch(`/api/visited/${countryId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(merged),
        });
      }
    );

    // --- Sync world ---
    let worldPromise = Promise.resolve();
    if (hasWorld) {
      const mergedWorld = mergeArrays(anonData.world, serverWorld);
      anonData.world = mergedWorld;
      worldPromise = fetch('/api/visited-world', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ countries: mergedWorld }),
      });
    }

    await Promise.all([...regionPromises, worldPromise]);

    // Migrate to user-scoped keys & clean up anonymous ones
    migrateKeys(userId, anonData);

    // Bust the bulk cache so hooks re-fetch the fresh merged data
    invalidateBulkCache(token);

    console.log('[sync] Anonymous local data synced successfully');
    return true;
  } catch (err) {
    console.error('[sync] Failed to sync anonymous local data:', err);
    return false;
  }
}
