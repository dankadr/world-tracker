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

  it('requeues batch when server responds with a non-2xx status (e.g. 422)', async () => {
    const { addToBatch } = await loadQueueModule();

    fetch.mockResolvedValue({ ok: false, status: 422 });
    addToBatch('world_toggle', { country: 'il', action: 'add' }, 'jwt-token');
    vi.advanceTimersByTime(2000);
    await vi.runAllTimersAsync();

    const queued = JSON.parse(localStorage.getItem('swiss-tracker-batch-queue'));
    expect(queued).toEqual([
      { action: 'world_toggle', payload: { country: 'il', action: 'add' }, token: 'jwt-token' },
    ]);
    expect(invalidateBulkCache).not.toHaveBeenCalled();
  });

  it('splits >50 actions into multiple fetch calls', async () => {
    const { flushBatch, addToBatch } = await loadQueueModule();

    fetch.mockResolvedValue({ ok: true });
    for (let i = 0; i < 75; i++) {
      addToBatch('world_toggle', { country: 'de', action: 'add' }, 'jwt-token');
    }
    vi.clearAllTimers();
    await flushBatch();

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetch.mock.calls[1][1].body);
    expect(firstBody.actions).toHaveLength(50);
    expect(secondBody.actions).toHaveLength(25);
    expect(invalidateBulkCache).toHaveBeenCalledTimes(2);
  });

  it('requeues only the failed chunk onward and invalidates cache for successful chunks', async () => {
    const { flushBatch, addToBatch } = await loadQueueModule();

    // First chunk succeeds, second fails
    fetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    for (let i = 0; i < 75; i++) {
      addToBatch('world_toggle', { country: 'de', action: 'add' }, 'jwt-token');
    }
    vi.clearAllTimers();
    await flushBatch();

    const queued = JSON.parse(localStorage.getItem('swiss-tracker-batch-queue'));
    // Only the 25 items from the failed second chunk should be re-queued
    expect(queued).toHaveLength(25);
    // Cache invalidated after the first successful chunk
    expect(invalidateBulkCache).toHaveBeenCalledTimes(1);
  });

  it('does not start a second flush if one is already in flight', async () => {
    const { flushBatch, addToBatch } = await loadQueueModule();

    let resolveFetch;
    fetch.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    addToBatch('world_toggle', { country: 'de', action: 'add' }, 'jwt-token');
    vi.clearAllTimers();

    const first = flushBatch();
    const second = flushBatch(); // called while first is awaiting fetch
    resolveFetch({ ok: true });

    await Promise.all([first, second]);

    // Only one fetch should have been made
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
