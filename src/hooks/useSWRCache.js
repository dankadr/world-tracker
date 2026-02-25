import { useState, useCallback, useEffect, useRef } from 'react';
import { cacheGet, cacheGetStale, cacheSet } from '../utils/cache';

/**
 * Generic stale-while-revalidate hook.
 *
 * - Initialises state synchronously from stale cache (instant render)
 * - `isLoading` is true only on cold start (no cached data at all)
 * - Background revalidation when TTL expires; updates state only on diff
 *
 * @param {string} cacheKey  localStorage cache key
 * @param {() => Promise<*>} fetcher  async function returning fresh data
 * @param {{ ttlMs: number }} options
 * @returns {{ data: *, isLoading: boolean, mutate: (v: *) => void, revalidate: () => Promise<void> }}
 */
export default function useSWRCache(cacheKey, fetcher, { ttlMs }) {
  const [data, setData] = useState(() => cacheGetStale(cacheKey));
  const [isLoading, setIsLoading] = useState(() => cacheGetStale(cacheKey) === null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const revalidate = useCallback(async () => {
    // Only fetch if TTL has expired (or no cache entry exists)
    if (cacheGet(cacheKey, ttlMs) !== null) return;

    try {
      const fresh = await fetcher();
      if (fresh === null || fresh === undefined) return;

      // Update cache
      cacheSet(cacheKey, fresh);

      // Only update state if data actually changed
      const prev = dataRef.current;
      if (JSON.stringify(prev) !== JSON.stringify(fresh)) {
        setData(fresh);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, fetcher, ttlMs]);

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  const mutate = useCallback(
    (value) => {
      setData(value);
      cacheSet(cacheKey, value);
    },
    [cacheKey],
  );

  return { data, isLoading, mutate, revalidate };
}
