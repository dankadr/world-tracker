// src/utils/batchQueue.js
// Frontend batching/queueing utility for API requests.
// Collects changes (with auth token) and flushes them as one POST every 2s.

import { invalidateBulkCache } from './api';

const queue = [];
let timer = null;
let isFlushing = false; // prevents concurrent flushes during multi-chunk sends
const BATCH_INTERVAL = 2000; // ms
const BATCH_CHUNK_SIZE = 50; // must match server-side Field(max_length=50)
const QUEUE_STORAGE_KEY = 'swiss-tracker-batch-queue';
const DEFAULT_SYNC_TAG = 'world-tracker-sync';
const LISTENER_CLEANUP_KEY = '__wtBatchQueueCleanup__';

function emitQueueChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('batchqueuechange', {
    detail: { count: queue.length },
  }));
}

function persistQueue() {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore storage errors (quota/private mode)
  }
  emitQueueChange();
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

function setupBrowserListeners() {
  const flushWhenConnected = () => {
    if (!navigator.onLine || queue.length === 0) return;
    void flushBatch();
  };

  const flushOnLeave = () => {
    if (queue.length > 0) flushBatch();
  };

  const flushWhenVisible = () => {
    if (document.visibilityState === 'visible') {
      flushWhenConnected();
    }
  };

  window.addEventListener('online', flushWhenConnected);
  window.addEventListener('pageshow', flushWhenConnected);
  document.addEventListener('visibilitychange', flushWhenVisible);
  window.addEventListener('pagehide', flushOnLeave);
  window.addEventListener('beforeunload', flushOnLeave);

  if (navigator.onLine && queue.length > 0) {
    setTimeout(flushWhenConnected, 0);
  }

  return () => {
    window.removeEventListener('online', flushWhenConnected);
    window.removeEventListener('pageshow', flushWhenConnected);
    document.removeEventListener('visibilitychange', flushWhenVisible);
    window.removeEventListener('pagehide', flushOnLeave);
    window.removeEventListener('beforeunload', flushOnLeave);
  };
}

if (typeof window !== 'undefined') {
  window[LISTENER_CLEANUP_KEY]?.();
  window[LISTENER_CLEANUP_KEY] = setupBrowserListeners();
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
  void requestBackgroundSync();
  if (!timer) {
    timer = setTimeout(flushBatch, BATCH_INTERVAL);
  }
}

export function getQueuedBatchCount() {
  return queue.length;
}

export async function requestBackgroundSync(tag = DEFAULT_SYNC_TAG) {
  if (typeof navigator === 'undefined' || queue.length === 0 || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration?.sync?.register) return false;
    await registration.sync.register(tag);
    return true;
  } catch {
    return false;
  }
}

export async function flushBatch() {
  if (isFlushing) return;
  if (queue.length === 0) {
    timer = null;
    return;
  }

  isFlushing = true;
  const batch = [...queue];
  queue.length = 0;
  timer = null;
  persistQueue();

  const token = batch.find((item) => item.token)?.token;

  try {
    // Send in chunks of ≤BATCH_CHUNK_SIZE to satisfy the server-side validation limit.
    // Invalidate cache after each successful chunk so partial commits are visible.
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
          void requestBackgroundSync();
          return;
        }
      } catch (err) {
        console.error('flushBatch error:', err);
        queue.unshift(...batch.slice(i));
        persistQueue();
        void requestBackgroundSync();
        return;
      }
      // Invalidate bulk cache so next background revalidation picks up server state
      if (token) invalidateBulkCache(token);
    }
  } finally {
    isFlushing = false;
    // Items added by addToBatch() during the flush already scheduled their own timer.
    // Re-queued items from error recovery are left for the next addToBatch() call — no
    // immediate retry to avoid hammering a failing server.
  }
}

export function clearBatch() {
  queue.length = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  persistQueue();
}
