import { renderHook, waitFor } from '@testing-library/react';

let authState;
const fetchAllVisited = vi.fn();
const invalidateBulkCache = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../utils/api', () => ({
  fetchAllVisited: (...args) => fetchAllVisited(...args),
  invalidateBulkCache: (...args) => invalidateBulkCache(...args),
}));

import useVisitedCountries from '../useVisitedCountries';

describe('useVisitedCountries', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchAllVisited.mockReset();
    invalidateBulkCache.mockReset();
    authState = {
      token: 'token-1234567890abcdef',
      isLoggedIn: true,
      isSyncingLocalData: true,
      user: { id: 5 },
    };
  });

  it('does not fetch authenticated world data while local sync is in progress', () => {
    renderHook(() => useVisitedCountries());
    expect(fetchAllVisited).not.toHaveBeenCalled();
  });

  it('fetches authenticated world data once the local sync lock is released', async () => {
    fetchAllVisited.mockResolvedValue({ world: ['ch'], regions: {} });

    const { result, rerender } = renderHook(() => useVisitedCountries());

    authState = {
      ...authState,
      isSyncingLocalData: false,
    };
    rerender();

    await waitFor(() => expect(fetchAllVisited).toHaveBeenCalledWith('token-1234567890abcdef'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
