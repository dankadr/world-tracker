import { useState, useRef, useEffect, useCallback } from 'react';
import { findRegion } from '../utils/geo';

// Map country IDs to Nominatim country codes
const COUNTRY_CODES = { ch: 'Switzerland', us: 'United States', no: 'Norway', ca: 'Canada' };

export default function CitySearch({ country, visited, onToggle, searchRef }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
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
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-hide message after 4 seconds
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const search = useCallback(
    async (q) => {
      if (q.trim().length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const countryName = COUNTRY_CODES[country.id] || '';
        const params = new URLSearchParams({
          q: `${q}, ${countryName}`,
          format: 'json',
          limit: '6',
          addressdetails: '1',
        });
        const res = await fetch(`/nominatim/search?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data);
        setShowDropdown(data.length > 0);
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
    timerRef.current = setTimeout(() => search(val), 500);
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
          type="text"
          className="search-input"
          placeholder={`Search a city in ${country.name}...`}
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          ref={searchRef}
        />
        {loading && <span className="search-spinner" />}
      </div>

      {showDropdown && results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.place_id}>
              <button className="search-result-btn" onClick={() => handleSelect(r)}>
                <span className="result-name">{r.display_name.split(',')[0]}</span>
                <span className="result-detail">
                  {r.display_name.split(',').slice(1, 3).join(',').trim()}
                </span>
              </button>
            </li>
          ))}
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
