// Debounce utility
export function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
// src/utils/batchQueue.js
// Frontend batching/queueing utility for API requests
// Collects changes and sends them in batches to the backend

const queue = [];
let timer = null;
const BATCH_INTERVAL = 2000; // ms

export function addToBatch(action, payload) {
  queue.push({ action, payload });
  if (!timer) {
    timer = setTimeout(flushBatch, BATCH_INTERVAL);
  }
}

export function flushBatch() {
  if (queue.length === 0) {
    timer = null;
    return;
  }
  const batch = [...queue];
  queue.length = 0;
  timer = null;
  // Send batch to backend (pseudo-code)
  fetch('/api/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actions: batch }),
  });
}

export function clearBatch() {
  queue.length = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
