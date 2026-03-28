import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, loadAuth, useAuth } from '../AuthContext';

const syncLocalDataToServer = vi.fn();
const deriveKey = vi.fn();
const setActiveKey = vi.fn();
const warmCache = vi.fn();

vi.mock('../../utils/syncLocalData', () => ({
  syncLocalDataToServer: (...args) => syncLocalDataToServer(...args),
}));

vi.mock('../../utils/crypto', () => ({
  deriveKey: (...args) => deriveKey(...args),
}));

vi.mock('../../utils/secureStorage', () => ({
  setActiveKey: (...args) => setActiveKey(...args),
  clearActiveKey: vi.fn(),
  warmCache: (...args) => warmCache(...args),
}));

vi.mock('../../utils/cache', () => ({
  cacheInvalidatePrefix: vi.fn(),
}));

vi.mock('../../utils/batchQueue', () => ({
  clearBatch: vi.fn(),
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function AuthProbe() {
  const { isLoggedIn, isSyncingLocalData, loading, login } = useAuth();

  return (
    <div>
      <div data-testid="logged-in">{String(isLoggedIn)}</div>
      <div data-testid="syncing">{String(isSyncingLocalData)}</div>
      <div data-testid="loading">{String(loading)}</div>
      <button onClick={() => login('google-token')}>Login</button>
    </div>
  );
}

// Helper: build a minimal JWT-shaped token with the given payload
function makeJwt(payload) {
  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

const STORAGE_KEY = 'swiss-tracker-auth';

describe('loadAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(loadAuth()).toBeNull();
  });

  it('returns auth data for a valid, non-expired JWT', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = makeJwt({ sub: 'sub-1', email: 'a@b.com', exp });
    const stored = { jwt_token: token, user: { id: 1, sub: 'sub-1', email: 'a@b.com' } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const result = loadAuth();
    expect(result).not.toBeNull();
    expect(result.user.id).toBe(1);
  });

  it('returns null for an expired JWT', () => {
    const exp = Math.floor(Date.now() / 1000) - 1; // 1 second ago
    const token = makeJwt({ sub: 'sub-2', exp });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ jwt_token: token, user: { id: 2, sub: 'sub-2', email: 'b@b.com' } })
    );
    expect(loadAuth()).toBeNull();
  });

  it('returns null for a malformed JWT', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ jwt_token: 'not.a.valid.jwt.at.all', user: { id: 3 } })
    );
    expect(loadAuth()).toBeNull();
  });

  it('treats a JWT without exp as non-expired', () => {
    const token = makeJwt({ sub: 'sub-4' }); // no exp field
    const stored = { jwt_token: token, user: { id: 4, sub: 'sub-4', email: 'c@b.com' } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const result = loadAuth();
    expect(result).not.toBeNull();
    expect(result.user.id).toBe(4);
  });

  it('backfills email from JWT payload when missing from stored user', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeJwt({ sub: 'sub-5', email: 'filled@b.com', exp });
    // Stored user has no email
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ jwt_token: token, user: { id: 5, sub: 'sub-5' } })
    );
    const result = loadAuth();
    expect(result).not.toBeNull();
    expect(result.user.email).toBe('filled@b.com');
  });
});

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    syncLocalDataToServer.mockReset();
    deriveKey.mockReset();
    setActiveKey.mockReset();
    warmCache.mockReset();
    deriveKey.mockResolvedValue({ id: 'derived-key' });
    warmCache.mockResolvedValue(undefined);
  });

  it('waits for local data sync before exposing authenticated state on login', async () => {
    const user = userEvent.setup();
    const syncGate = deferred();

    syncLocalDataToServer.mockReturnValue(syncGate.promise);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        jwt_token: 'jwt-token-1234567890',
        user: { id: 7, sub: 'sub-7', email: 'user@example.com' },
      }),
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(syncLocalDataToServer).toHaveBeenCalledWith('jwt-token-1234567890', 7));
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('syncing')).toHaveTextContent('true');
    expect(screen.getByTestId('logged-in')).toHaveTextContent('false');

    syncGate.resolve(false);

    await waitFor(() => expect(screen.getByTestId('logged-in')).toHaveTextContent('true'));
    await waitFor(() => expect(screen.getByTestId('syncing')).toHaveTextContent('false'));
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(setActiveKey).toHaveBeenCalled();
    expect(warmCache).toHaveBeenCalledWith(7);
  });
});
