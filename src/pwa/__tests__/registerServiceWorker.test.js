import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../registerServiceWorker';

describe('registerServiceWorker', () => {
  it('does nothing outside production mode or without service worker support', async () => {
    const cleanup = await registerServiceWorker({ enabled: false, serviceWorker: null });
    expect(cleanup).toBeTypeOf('function');
  });

  it('wires service worker messages to queue flushing when registration succeeds', async () => {
    const flushQueue = vi.fn();
    const messageListeners = new Set();
    const registration = {
      scope: '/',
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      update: vi.fn(),
    };
    const serviceWorker = {
      register: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
      addEventListener: vi.fn((type, handler) => {
        if (type === 'message') messageListeners.add(handler);
      }),
      removeEventListener: vi.fn((type, handler) => {
        if (type === 'message') messageListeners.delete(handler);
      }),
    };

    const cleanup = await registerServiceWorker({
      enabled: true,
      serviceWorker,
      flushQueue,
      requestQueueSync: vi.fn(),
    });

    for (const handler of messageListeners) {
      handler({ data: { type: 'FLUSH_BATCH_QUEUE' } });
    }

    expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(flushQueue).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
