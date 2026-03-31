import { useState, useEffect, useRef } from 'react';

// Singleton cache — the JSON is loaded once per session and reused
let cache = null;
let pending = null;

async function loadCountryInfo() {
  if (cache) return cache;
  if (pending) return pending;

  pending = import('../data/countryInfo.json').then((mod) => {
    cache = mod.default;
    pending = null;
    return cache;
  });
  return pending;
}

/**
 * Returns static country info for a given ISO alpha-2 country code.
 *
 * @param {string|null} countryId  e.g. 'us', 'ch', 'de'
 * @returns {{ info: object|null, loading: boolean }}
 */
export default function useCountryInfo(countryId) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const lastId = useRef(null);

  useEffect(() => {
    let aborted = false;

    if (!countryId) {
      setInfo(null);
      setLoading(false);
      return;
    }

    // If the JSON is already cached, resolve synchronously to avoid a render cycle
    if (cache) {
      setInfo(cache[countryId] ?? null);
      setLoading(false);
      return;
    }

    lastId.current = countryId;
    setLoading(true);

    loadCountryInfo()
      .then((data) => {
        if (aborted) return;
        // Guard against stale effect (country changed while loading)
        if (lastId.current !== countryId) return;
        setInfo(data[countryId] ?? null);
      })
      .catch(() => {
        if (aborted) return;
        setInfo(null);
      })
      .finally(() => {
        if (aborted) return;
        setLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [countryId]);

  return { info, loading };
}
