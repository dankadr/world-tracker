import { act, renderHook, waitFor } from '@testing-library/react';

const getIndex = vi.fn();
const resetIndex = vi.fn();

vi.mock('../../utils/searchIndex', () => ({
  getIndex: (...args) => getIndex(...args),
  resetIndex: (...args) => resetIndex(...args),
}));

import useGlobalSearch from '../useGlobalSearch';

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getIndex.mockReset();
    resetIndex.mockReset();
  });

  it('does not search before the minimum query length', () => {
    renderHook(() => useGlobalSearch('a'));

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(getIndex).not.toHaveBeenCalled();
  });

  it('groups results by type in the expected order and limits each group', async () => {
    vi.useRealTimers();

    const entries = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `country-${index}`,
        type: 'country',
        label: `Co Country ${index}`,
        sublabel: 'Co World',
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        id: `region-${index}`,
        type: 'region',
        label: `Co Region ${index}`,
        sublabel: 'Co Region',
      })),
      {
        id: 'tracker-1',
        type: 'tracker',
        label: 'Co Tracker',
        sublabel: 'Co Tracker',
      },
    ];

    getIndex.mockResolvedValue(entries);

    const { result } = renderHook(() => useGlobalSearch('co'));

    await waitFor(() => expect(result.current.groups).toHaveLength(3));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.groups.map((group) => group.type)).toEqual(['country', 'region', 'tracker']);
    expect(result.current.groups[0].items).toHaveLength(5);
    expect(result.current.groups[1].items).toHaveLength(2);
    expect(result.current.groups[2].items).toHaveLength(1);
  });

  it('persists recent searches and can clear them', () => {
    const entry = {
      id: 'country-ch',
      type: 'country',
      label: 'Switzerland',
      sublabel: 'Europe',
    };

    const { result } = renderHook(() => useGlobalSearch(''));

    act(() => {
      result.current.recordSearch(entry);
    });

    expect(result.current.recentSearches).toEqual([entry]);
    expect(JSON.parse(localStorage.getItem('swiss-tracker-recent-searches'))).toEqual([entry]);

    act(() => {
      result.current.clearRecent();
    });

    expect(result.current.recentSearches).toEqual([]);
    expect(localStorage.getItem('swiss-tracker-recent-searches')).toBeNull();
  });
});
