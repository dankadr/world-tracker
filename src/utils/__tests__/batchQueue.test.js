import { beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateBulkCache = vi.fn();
vi.mock('../api.js', () => ({ invalidateBulkCache }));

async function loadQueueModule() {
  vi.resetModules();
  return import('../batchQueue.js');
}

describe('batchQueue persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateBulkCache.mockReset();
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  it('restores queued actions from localStorage and flushes them', async () => {
    localStorage.setItem(
      'swiss-tracker-batch-queue',
      JSON.stringify([{ action: 'world_toggle', payload: { country: 'il', action: 'add' }, token: 'jwt-token' }])
    );
    const { flushBatch } = await loadQueueModule();

    fetch.mockResolvedValue({ ok: true });
    await flushBatch();

    expect(fetch).toHaveBeenCalledWith('/api/batch', expect.objectContaining({
      method: 'POST',
      keepalive: true,
    }));
    expect(invalidateBulkCache).toHaveBeenCalledWith('jwt-token');
    expect(localStorage.getItem('swiss-tracker-batch-queue')).toBe('[]');
  });

  it('requeues batch in localStorage when request fails', async () => {
    const { addToBatch } = await loadQueueModule();

    fetch.mockRejectedValue(new Error('network down'));
    addToBatch('world_toggle', { country: 'il', action: 'add' }, 'jwt-token');
    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    const queued = JSON.parse(localStorage.getItem('swiss-tracker-batch-queue'));
    expect(queued).toEqual([
      { action: 'world_toggle', payload: { country: 'il', action: 'add' }, token: 'jwt-token' },
    ]);
  });
});
