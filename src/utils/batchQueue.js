// src/utils/batchQueue.js
// Frontend batching/queueing utility for API requests.
// Collects changes (with auth token) and flushes them as one POST every 2s.

import { invalidateBulkCache } from './api';

const queue = [];
let timer = null;
const BATCH_INTERVAL = 2000; // ms
const BATCH_CHUNK_SIZE = 50; // must match server-side Field(max_length=50)
const QUEUE_STORAGE_KEY = 'swiss-tracker-batch-queue';

function persistQueue() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors (quota/private mode)
  }
}

function restoreQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return;
    for (const item of saved) {
      if (item?.action && item?.payload) {
        queue.push(item);
      }
    }
    persistQueue();
  } catch {
    // ignore malformed data
  }
}

restoreQueue();

if (typeof window !== 'undefined') {
  const flushOnLeave = () => {
    if (queue.length > 0) flushBatch();
  };
  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('beforeunload', flushOnLeave);
}

/**
 * Add an action to the outgoing batch.
 * @param {string} action  e.g. 'region_toggle', 'world_toggle', 'wishlist_upsert', 'wishlist_delete'
 * @param {Object} payload  action-specific data
 * @param {string} token    JWT auth token (required for backend auth)
 */
export function addToBatch(action, payload, token) {
  queue.push({ action, payload, token });
  persistQueue();
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
  persistQueue();

  // Use the first available token in this batch
  const token = batch.find((item) => item.token)?.token;

  // Send in chunks of ≤BATCH_CHUNK_SIZE to satisfy the server-side validation limit.
  // Re-queue only from the failed chunk onward — already-committed chunks stay committed
  // (actions like region_toggle are not idempotent so we must not re-send them).
  for (let i = 0; i < batch.length; i += BATCH_CHUNK_SIZE) {
    const chunk = batch.slice(i, i + BATCH_CHUNK_SIZE);
    const actions = chunk.map(({ action, payload }) => ({ action, payload }));
    try {
      const res = await fetch('/api/batch', {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ actions }),
      });
      if (!res.ok) {
        console.error('flushBatch error:', res.status);
        queue.unshift(...batch.slice(i));
        persistQueue();
        return;
      }
    } catch (err) {
      console.error('flushBatch error:', err);
      queue.unshift(...batch.slice(i));
      persistQueue();
      return;
    }
  }

  // Invalidate bulk cache so next background revalidation picks up server state
  if (token) invalidateBulkCache(token);
}

export function clearBatch() {
  queue.length = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  persistQueue();
}
