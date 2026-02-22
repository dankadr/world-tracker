import { useState, useRef, useEffect, useCallback } from 'react';
import { findRegion } from '../utils/geo';

// Map country IDs to ISO 3166-1 alpha-2 codes for Nominatim countrycodes param
const ISO_CODES = { ch: 'ch', us: 'us', usparks: 'us', nyc: 'us', no: 'no', ca: 'ca' };

export default function CitySearch({ country, visited, onToggle, searchRef, onSearchFocus }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  // Clear state when country changes
  useEffect(() => {
    setQuery('');
    setResults([]);
    setMessage(null);
    setShowDropdown(false);
  }, [country.id]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  // Auto-hide message after 4 seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const search = useCallback(
    async (q) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const isoCode = ISO_CODES[country.id];

        // Build params: use countrycodes to restrict (not appended to q)
        const params = new URLSearchParams({
          q: trimmed,
          format: 'json',
          limit: '8',
          addressdetails: '1',
          dedupe: '1',
          'accept-language': 'en',
        });

        // Restrict to country when we have an ISO code (skip for world capitals)
        if (isoCode) {
          params.set('countrycodes', isoCode);
        }

        const res = await fetch(`/nominatim/search?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();

        // Sort results: prefer cities/towns/villages over highways/counties/etc.
        const placeTypes = ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood'];
        const sorted = data.sort((a, b) => {
          const aType = a.type || '';
          const bType = b.type || '';
          const aIsPlace = placeTypes.includes(aType);
          const bIsPlace = placeTypes.includes(bType);
          if (aIsPlace && !bIsPlace) return -1;
          if (!aIsPlace && bIsPlace) return 1;
          // Prefer results whose name starts with the query
          const name = trimmed.toLowerCase();
          const aStarts = (a.display_name || '').toLowerCase().startsWith(name);
          const bStarts = (b.display_name || '').toLowerCase().startsWith(name);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return (parseFloat(a.importance) || 0) > (parseFloat(b.importance) || 0) ? -1 : 1;
        });

        setResults(sorted);
        setSelectedIdx(-1);
        setShowDropdown(sorted.length > 0);
      } catch {
        setResults([]);
        setShowDropdown(false);
      } finally {
        setLoading(false);
      }
    },
    [country.id]
  );

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setMessage(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIdx(-1);
    }
  };

  const handleSelect = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const region = findRegion(lat, lng, country.data);

    setShowDropdown(false);
    setQuery('');
    setResults([]);

    if (region) {
      const alreadyVisited = visited.has(region.id);
      if (!alreadyVisited) {
        onToggle(region.id);
        setMessage({
          type: 'success',
          text: `${result.display_name.split(',')[0]} is in ${region.name} (${region.id}) — marked as visited!`,
        });
      } else {
        setMessage({
          type: 'info',
          text: `${result.display_name.split(',')[0]} is in ${region.name} (${region.id}) — already visited!`,
        });
      }
    } else {
      setMessage({
        type: 'warn',
        text: `Could not match "${result.display_name.split(',')[0]}" to a ${country.regionLabelSingular}.`,
      });
    }
  };

  return (
    <div className="city-search" ref={wrapperRef}>
      <div className="search-input-wrapper">
        <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder={`Search a city in ${country.name}...`}
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
            if (onSearchFocus) onSearchFocus();
          }}
          ref={searchRef}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className="search-spinner" />}
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="search-results">
          {results.map((r, i) => {
            const parts = r.display_name.split(',');
            const name = parts[0].trim();
            const detail = parts.slice(1, 3).join(',').trim();
            const type = r.type ? r.type.replace(/_/g, ' ') : '';
            return (
              <li key={r.place_id}>
                <button
                  className={`search-result-btn${i === selectedIdx ? ' selected' : ''}`}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="result-name">{name}</span>
                  <span className="result-detail">
                    {detail}
                    {type && <span className="result-type">{type}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <div className={`search-message search-message--${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
