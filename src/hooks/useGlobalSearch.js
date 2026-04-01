import { useState, useEffect, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { getIndex, resetIndex } from '../utils/searchIndex';

const DEBOUNCE_MS = 150;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS_PER_GROUP = 5;
const RECENT_KEY = 'swiss-tracker-recent-searches';
const MAX_RECENT = 8;

const FUSE_OPTIONS = {
  keys: ['label', 'sublabel'],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: MIN_QUERY_LENGTH,
};

const TYPE_ORDER = ['country', 'region', 'tracker', 'unesco'];
const TYPE_LABELS = {
  country: 'Countries',
  region: 'Regions',
  tracker: 'Trackers',
  unesco: 'UNESCO Sites',
};

// ── Recent searches ──────────────────────────────────────────────────────────

export function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return [];
}

export function saveRecentSearch(entry) {
  try {
    const existing = loadRecentSearches().filter((e) => e.id !== entry.id);
    const updated = [entry, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

// ── Main hook ────────────────────────────────────────────────────────────────

/**
 * @param {string} query - current search query
 * @returns {{ groups, isLoading, recentSearches, recordSearch, clearRecent }}
 */
export default function useGlobalSearch(query) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const fuseRef = useRef(null);
  const debounceRef = useRef(null);

  // Build / cache the Fuse instance
  const ensureIndex = useCallback(async () => {
    if (fuseRef.current) return fuseRef.current;
    const entries = await getIndex();
    fuseRef.current = new Fuse(entries, FUSE_OPTIONS);
    return fuseRef.current;
  }, []);

  // Listen for visited-data changes and bust index cache
  useEffect(() => {
    const handler = () => {
      resetIndex();
      fuseRef.current = null;
    };
    window.addEventListener('visitedchange', handler);
    return () => window.removeEventListener('visitedchange', handler);
  }, []);

  // Re-run search when query changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const normalizedQuery = query.trim();
    let cancelled = false;

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const fuse = await ensureIndex();
        if (cancelled) return;

        const raw = fuse.search(normalizedQuery);
        if (cancelled) return;

        // Group by type
        const byType = {};
        for (const result of raw) {
          const { type } = result.item;
          if (!byType[type]) byType[type] = [];
          if (byType[type].length < MAX_RESULTS_PER_GROUP) {
            byType[type].push(result.item);
          }
        }

        const grouped = TYPE_ORDER
          .filter((t) => byType[t]?.length > 0)
          .map((t) => ({ type: t, label: TYPE_LABELS[t], items: byType[t] }));

        setGroups(grouped);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        setGroups([]);
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [query, ensureIndex]);

  const recordSearch = useCallback((entry) => {
    saveRecentSearch(entry);
    setRecentSearches(loadRecentSearches());
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentSearches();
    setRecentSearches([]);
  }, []);

  return { groups, isLoading, recentSearches, recordSearch, clearRecent };
}
