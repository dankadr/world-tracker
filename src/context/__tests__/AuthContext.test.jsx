import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Helper to build a minimal fake JWT with a given exp claim.
// We only need the payload to be base64url-encoded — no real signing.
function makeFakeJwt(payload) {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `header.${encoded}.signature`;
}

const STORAGE_KEY = 'swiss-tracker-auth';

function storeAuth(jwt_token, user = { id: 1, email: 'a@b.com', sub: 'google-1' }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ jwt_token, user }));
}

describe('loadAuth', () => {
  it('returns null when localStorage is empty', async () => {
    const { loadAuth } = await import('../AuthContext.jsx');
    expect(loadAuth()).toBeNull();
  });

  it('returns null for an expired JWT', async () => {
    const expiredToken = makeFakeJwt({ sub: '1', exp: Math.floor(Date.now() / 1000) - 60 });
    storeAuth(expiredToken);
    const { loadAuth } = await import('../AuthContext.jsx');
    expect(loadAuth()).toBeNull();
  });

  it('returns the stored auth for a valid (non-expired) JWT', async () => {
    const validToken = makeFakeJwt({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 });
    storeAuth(validToken);
    const { loadAuth } = await import('../AuthContext.jsx');
    const result = loadAuth();
    expect(result).not.toBeNull();
    expect(result.jwt_token).toBe(validToken);
  });
});

describe('AuthProvider cache readiness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exposes cacheReady=false until warmCache finishes for an existing login', async () => {
    const validToken = makeFakeJwt({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 });
    storeAuth(validToken);

    let resolveWarm;
    const warmPromise = new Promise((resolve) => {
      resolveWarm = resolve;
    });

    vi.doMock('../../utils/crypto', () => ({
      deriveKey: vi.fn().mockResolvedValue('derived-key'),
    }));
    vi.doMock('../../utils/secureStorage', () => ({
      setActiveKey: vi.fn(),
      clearActiveKey: vi.fn(),
      warmCache: vi.fn().mockImplementation(() => warmPromise),
    }));
    vi.doMock('../../utils/syncLocalData', () => ({
      syncLocalDataToServer: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('../../utils/cache', () => ({
      cacheInvalidatePrefix: vi.fn(),
    }));
    vi.doMock('../../utils/batchQueue', () => ({
      clearBatch: vi.fn(),
    }));

    const { AuthProvider, useAuth } = await import('../AuthContext.jsx');

    function Probe() {
      const { cacheReady } = useAuth();
      return <div>{cacheReady ? 'ready' : 'warming'}</div>;
    }

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(screen.getByText('warming')).toBeInTheDocument();

    resolveWarm();

    await waitFor(() => expect(screen.getByText('ready')).toBeInTheDocument());
  });
});
