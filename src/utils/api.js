/**
 * Shared API utilities for visited data.
 *
 * Provides a bulk-fetch function that loads all visited regions + world data
 * in a single request, with an in-memory cache so multiple hooks share one
 * network call per page load.
 */

import { cacheGet, cacheSet, cacheInvalidate } from './cache';

// Dispatch a global event so AuthContext can auto-logout on 401.
function notifyIfExpired(res) {
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  return res;
}

const VISITED_TTL = 5 * 60 * 1000; // 5 minutes

function visitedCacheKey(token) {
  // Use last 16 chars of token as scope — tokens are user-specific
  return `visited-all:${token.slice(-16)}`;
}

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
  const cKey = visitedCacheKey(token);

  // Check persistent cache first (survives page refresh)
  if (!force) {
    const persisted = cacheGet(cKey, VISITED_TTL);
    if (persisted) {
      _bulkCache = persisted;
      _bulkToken = token;
      return persisted;
    }
  }

  // Fall back to in-memory deduplication
  if (!force && _bulkCache && _bulkToken === token) return _bulkCache;
  if (!force && _bulkPromise && _bulkToken === token) return _bulkPromise;

  _bulkToken = token;
  _bulkPromise = fetch('/api/visited/all', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (notifyIfExpired(res).ok ? res.json() : null))
    .then((data) => {
      _bulkCache = data;
      _bulkPromise = null;
      if (data) cacheSet(cKey, data);
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
export function invalidateBulkCache(token) {
  _bulkCache = null;
  _bulkPromise = null;
  if (token) cacheInvalidate(visitedCacheKey(token));
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
    if (!notifyIfExpired(res).ok) console.error(`deleteAllVisited failed: ${res.status}`);
  } catch (err) {
    console.error('deleteAllVisited network error:', err);
  }
}

// ── Friends API ──

export async function fetchMe(token) {
  const res = await fetch('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function lookupFriendCode(token, friendCode) {
  const res = await fetch(`/api/user/${friendCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('User not found');
  return res.json();
}

export async function sendFriendRequest(token, friendCode) {
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ friend_code: friendCode }),
  });
  notifyIfExpired(res);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to send request');
  }
  return res.json();
}

export async function fetchFriendRequests(token) {
  const res = await fetch('/api/friends/requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch requests');
  return res.json();
}

export async function acceptFriendRequest(token, requestId) {
  const res = await fetch(`/api/friends/requests/${requestId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to accept request');
  return res.json();
}

export async function declineFriendRequest(token, requestId) {
  const res = await fetch(`/api/friends/requests/${requestId}/decline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to decline request');
  return res.json();
}

export async function cancelFriendRequest(token, requestId) {
  const res = await fetch(`/api/friends/requests/${requestId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to cancel request');
  return res.json();
}

export async function fetchFriends(token) {
  const res = await fetch('/api/friends', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch friends');
  return res.json();
}

export async function removeFriend(token, friendId) {
  const res = await fetch(`/api/friends/${friendId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to remove friend');
  return res.json();
}

export async function fetchFriendVisited(token, friendId) {
  const res = await fetch(`/api/friends/${friendId}/visited`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch friend data');
  return res.json();
}

export async function fetchLeaderboard(token) {
  const res = await fetch('/api/friends/leaderboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

export async function fetchActivity(token) {
  const res = await fetch('/api/friends/activity', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch activity');
  return res.json();
}

// ── Wishlist / Bucket List API ──

export async function fetchWishlist(token) {
  const res = await fetch('/api/wishlist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch wishlist');
  return res.json();
}

export async function fetchWishlistForTracker(token, trackerId) {
  const res = await fetch(`/api/wishlist/${trackerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch wishlist');
  return res.json();
}

export async function upsertWishlistItem(token, trackerId, regionId, data = {}) {
  const res = await fetch(`/api/wishlist/${trackerId}/${regionId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to save wishlist item');
  return res.json();
}

export async function updateWishlistItem(token, trackerId, regionId, updates) {
  const res = await fetch(`/api/wishlist/${trackerId}/${regionId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to update wishlist item');
  return res.json();
}

export async function deleteWishlistItem(token, trackerId, regionId) {
  const res = await fetch(`/api/wishlist/${trackerId}/${regionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to delete wishlist item');
  return res.json();
}

// ── Challenges API ──

export async function fetchChallenges(token) {
  const res = await fetch('/api/challenges', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch challenges');
  return res.json();
}

export async function createChallenge(token, data) {
  const res = await fetch('/api/challenges', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  notifyIfExpired(res);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create challenge');
  }
  return res.json();
}

export async function fetchChallengeDetail(token, challengeId) {
  const res = await fetch(`/api/challenges/${challengeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to fetch challenge detail');
  return res.json();
}

export async function joinChallenge(token, challengeId) {
  const res = await fetch(`/api/challenges/${challengeId}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  notifyIfExpired(res);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to join challenge');
  }
  return res.json();
}

export async function leaveChallenge(token, challengeId) {
  const res = await fetch(`/api/challenges/${challengeId}/leave`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to leave challenge');
  return res.json();
}

export async function deleteChallenge(token, challengeId) {
  const res = await fetch(`/api/challenges/${challengeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!notifyIfExpired(res).ok) throw new Error('Failed to delete challenge');
  return res.json();
}

export async function triggerEncrypt(token) {
  const res = await fetch('/admin/encrypt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  notifyIfExpired(res);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Encrypt failed');
  }
  return res.json(); // { encrypted: N, skipped: N, errors: N }
}

export async function triggerDecrypt(token) {
  const res = await fetch('/admin/decrypt', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  notifyIfExpired(res);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Decrypt failed');
  }
  return res.json(); // { decrypted: N, skipped: N, errors: N }
}
