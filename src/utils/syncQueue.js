/**
 * Offline sync queue — stores API calls that failed due to network unavailability
 * and replays them when the connection is restored.
 */

const QUEUE_KEY = 'rw-sync-queue';

export function queueApiCall(method, url, body, token) {
  const queue = getQueue();
  queue.push({ method, url, body: body ?? null, token, timestamp: Date.now() });
  saveQueue(queue);
}

export async function processQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...(item.token ? { Authorization: `Bearer ${item.token}` } : {}),
        },
        body: item.body != null ? JSON.stringify(item.body) : undefined,
      });
      if (!res.ok) remaining.push(item);
    } catch {
      remaining.push(item); // Keep failed items for retry
    }
  }
  saveQueue(remaining);
}

export function getQueueLength() {
  return getQueue().length;
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Process queue automatically when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', processQueue);
}
