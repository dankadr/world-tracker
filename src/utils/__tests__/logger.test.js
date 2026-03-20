import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls console.log in dev mode', async () => {
    vi.stubEnv('DEV', true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('../logger.js');
    logger.log('test message');
    expect(spy).toHaveBeenCalledWith('test message');
    spy.mockRestore();
  });

  it('does not call console.log in production mode', async () => {
    vi.stubEnv('DEV', false);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('../logger.js');
    logger.log('test message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('always calls console.error regardless of mode', async () => {
    vi.stubEnv('DEV', false);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger.js');
    logger.error('error message');
    expect(spy).toHaveBeenCalledWith('error message');
    spy.mockRestore();
  });
});
