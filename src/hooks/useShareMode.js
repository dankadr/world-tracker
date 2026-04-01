import { useState, useCallback, useEffect } from 'react';
import { decodeShareData } from '../utils/shareUrl';
import countries from '../data/countries';

function parseShareHash() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  return decodeShareData(hash.slice(7));
}

/**
 * Manages URL-based share mode (#share=... hash).
 *
 * On mount reads the hash; if share data is present calls setView/setCountryId
 * so the app opens directly to the shared tracker.
 *
 * Returns isShareMode, exitShareMode, and getSharedVisited(countryId)
 * so App can gate features and compute the display-visited set without
 * touching share internals.
 */
export default function useShareMode({ setView, setCountryId }) {
  const [shareData, setShareData] = useState(null);

  useEffect(() => {
    const data = parseShareHash();
    if (!data) return;
    setShareData(data);
    setView('detail');
    const firstKey = Object.keys(data).find((k) => countries[k]);
    if (firstKey) setCountryId(firstKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isShareMode = !!shareData;

  const exitShareMode = useCallback(() => {
    setShareData(null);
    if (typeof window === 'undefined') return;
    window.location.hash = '';
  }, []);

  /** Returns the visited Set for countryId from share data, or null if not in share mode. */
  const getSharedVisited = useCallback(
    (countryId) => {
      if (!isShareMode || !shareData[countryId]) return null;
      return new Set(shareData[countryId]);
    },
    [isShareMode, shareData],
  );

  return { shareData, isShareMode, exitShareMode, getSharedVisited };
}
