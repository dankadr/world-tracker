// src/utils/batchQueue.js
// Frontend batching/queueing utility for API requests.
// Collects changes (with auth token) and flushes them as one POST every 2s.

import { invalidateBulkCache } from './api';

const queue = [];
let timer = null;
const BATCH_INTERVAL = 2000; // ms

/**
 * Add an action to the outgoing batch.
 * @param {string} action  e.g. 'region_toggle', 'world_toggle', 'wishlist_upsert', 'wishlist_delete'
 * @param {Object} payload  action-specific data
 * @param {string} token    JWT auth token (required for backend auth)
 */
export function addToBatch(action, payload, token) {
  queue.push({ action, payload, token });
  if (!timer) {
    timer = setTimeout(flushBatch, BATCH_INTERVAL);
  }
}

export async function flushBatch() {
  if (queue.length === 0) {
    timer = null;
    return;
  }
  const batch = [...queue];
  queue.length = 0;
  timer = null;

  // Use the first available token in this batch
  const token = batch.find((item) => item.token)?.token;
  const actions = batch.map(({ action, payload }) => ({ action, payload }));

  try {
    await fetch('/api/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ actions }),
    });
    // Invalidate bulk cache so next background revalidation picks up server state
    if (token) invalidateBulkCache(token);
  } catch (err) {
    console.error('flushBatch error:', err);
  }
}

export function clearBatch() {
  queue.length = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
