import { useState, useEffect, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { getIndex, resetIndex } from '../utils/searchIndex';

const DEBOUNCE_MS = 150;
const MAX_RESULTS_PER_GROUP = 5;
const RECENT_KEY = 'swiss-tracker-recent-searches';
const MAX_RECENT = 8;

const FUSE_OPTIONS = {
  keys: ['label', 'sublabel'],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,
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
    if (raw) return JSON.parse(raw);
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
 * @param {{ visited: Set, wishlist: Set }} context - runtime visited state for annotations
 * @returns {{ groups, isLoading, recentSearches, clearRecent }}
 */
export default function useGlobalSearch(query, context = {}) {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const fuseRef = useRef(null);
  const indexRef = useRef(null);
  const debounceRef = useRef(null);

  // Build / cache the Fuse instance
  const ensureIndex = useCallback(async () => {
    if (fuseRef.current) return fuseRef.current;
    const entries = await getIndex();
    indexRef.current = entries;
    fuseRef.current = new Fuse(entries, FUSE_OPTIONS);
    return fuseRef.current;
  }, []);

  // Listen for visited-data changes and bust index cache
  useEffect(() => {
    const handler = () => {
      resetIndex();
      fuseRef.current = null;
      indexRef.current = null;
    };
    window.addEventListener('visitedchange', handler);
    return () => window.removeEventListener('visitedchange', handler);
  }, []);

  // Re-run search when query changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < 1) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const fuse = await ensureIndex();
      const raw = fuse.search(query.trim());

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
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
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
