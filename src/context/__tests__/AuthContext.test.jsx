import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../AuthContext';

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
