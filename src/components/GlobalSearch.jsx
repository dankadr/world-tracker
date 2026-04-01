import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useGlobalSearch from '../hooks/useGlobalSearch';
import './GlobalSearch.css';

const TYPE_ICONS = {
  country: '🌍',
  region: '📍',
  tracker: '🗺️',
  unesco: '🏛️',
};

function ResultItem({ item, isActive, onClick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

  return (
    <button
      ref={ref}
      className={`gs-result-item${isActive ? ' gs-result-item--active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className="gs-result-icon">
        {item.flag || TYPE_ICONS[item.type] || '📌'}
      </span>
      <span className="gs-result-text">
        <span className="gs-result-label">{item.label}</span>
        <span className="gs-result-sublabel">{item.sublabel}</span>
      </span>
    </button>
  );
}

function RecentItem({ item, onClick }) {
  return (
    <button className="gs-result-item gs-recent-item" onClick={onClick} type="button">
      <span className="gs-result-icon gs-recent-icon">🕐</span>
      <span className="gs-result-text">
        <span className="gs-result-label">{item.label}</span>
        <span className="gs-result-sublabel">{item.sublabel}</span>
      </span>
    </button>
  );
}

/**
 * GlobalSearch palette overlay.
 *
 * Props:
 *   onClose()
 *   onSelect(entry) — called when the user picks a result
 */
export default function GlobalSearch({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const { groups, isLoading, recentSearches, recordSearch, clearRecent } = useGlobalSearch(query);
  const inputRef = useRef(null);
  const trimmedQuery = query.trim();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape closes
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Flatten all visible items for keyboard navigation
  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(-1); }, [groups]);

  const handleSelect = useCallback((item) => {
    recordSearch(item);
    onSelect(item);
    onClose();
  }, [recordSearch, onSelect, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const item = flatItems[activeIdx];
      if (item) handleSelect(item);
    }
  }, [flatItems, activeIdx, handleSelect]);

  const showRecent = trimmedQuery.length === 0 && recentSearches.length > 0;
  const showEmpty = trimmedQuery.length >= 2 && !isLoading && groups.length === 0;

  let flatIdx = 0;

  return (
    <div className="gs-backdrop" onClick={onClose}>
      <div className="gs-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Global Search">
        {/* Search input */}
        <div className="gs-input-row">
          <span className="gs-input-icon">🔍</span>
          <input
            ref={inputRef}
            className="gs-input"
            type="text"
            placeholder="Search countries, regions, UNESCO sites…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button className="gs-clear-btn" onClick={() => setQuery('')} type="button" aria-label="Clear">✕</button>
          )}
        </div>

        <div className="gs-results">
          {/* Recent searches (when no query) */}
          {showRecent && (
            <div className="gs-group">
              <div className="gs-group-header">
                <span>Recent</span>
                <button className="gs-clear-recent" onClick={clearRecent} type="button">Clear</button>
              </div>
              {recentSearches.map((item) => (
                <RecentItem key={item.id} item={item} onClick={() => handleSelect(item)} />
              ))}
            </div>
          )}

          {/* Search results */}
          {groups.map((group) => (
            <div key={group.type} className="gs-group">
              <div className="gs-group-header">
                <span>{group.label}</span>
              </div>
              {group.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <ResultItem
                    key={item.id}
                    item={item}
                    isActive={idx === activeIdx}
                    onClick={() => handleSelect(item)}
                  />
                );
              })}
            </div>
          ))}

          {/* Loading */}
          {isLoading && (
            <div className="gs-status">Searching…</div>
          )}

          {/* Empty state */}
          {showEmpty && (
            <div className="gs-status">No results for "{query}"</div>
          )}

          {/* Prompt when no query and no recent */}
          {trimmedQuery.length === 0 && !showRecent && (
            <div className="gs-status gs-status--hint">
              Type to search countries, regions, and UNESCO sites
            </div>
          )}
        </div>

        <div className="gs-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
