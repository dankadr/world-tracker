const SW_URL = '/sw.js';
const SYNC_TAG = 'world-tracker-sync';

async function loadBatchQueueModule() {
  return import('../utils/batchQueue');
}

export async function registerServiceWorker({
  enabled = import.meta.env.PROD,
  serviceWorker = typeof navigator !== 'undefined' ? navigator.serviceWorker : null,
  flushQueue = async () => {
    const { flushBatch } = await loadBatchQueueModule();
    return flushBatch();
  },
  requestQueueSync = async () => {
    const { getQueuedBatchCount, requestBackgroundSync } = await loadBatchQueueModule();
    if (getQueuedBatchCount() === 0) return false;
    return requestBackgroundSync(SYNC_TAG);
  },
} = {}) {
  if (!enabled || !Boolean(serviceWorker?.register)) return () => {};

  try {
    const registration = await serviceWorker.register(SW_URL, { scope: '/' });

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'FLUSH_BATCH_QUEUE') {
        void flushQueue();
      }
    };

    const refreshRegistration = () => {
      void registration.update().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRegistration();
      }
    };

    const maybeActivateWaitingWorker = () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    const handleUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          maybeActivateWaitingWorker();
        }
      });
    };

    serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    registration.addEventListener('updatefound', handleUpdateFound);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshRegistration);
    window.addEventListener('online', refreshRegistration);

    void serviceWorker.ready
      .then(() => {
        window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
        return requestQueueSync();
      })
      .catch(() => {});

    maybeActivateWaitingWorker();

    return () => {
      serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      registration.removeEventListener('updatefound', handleUpdateFound);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshRegistration);
      window.removeEventListener('online', refreshRegistration);
    };
  } catch (error) {
    console.error('Failed to register service worker:', error);
    return () => {};
  }
}
