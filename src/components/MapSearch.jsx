import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import worldData from '../data/world.json';
import capitalsData from '../data/capitals.json';

const MAX_RESULTS = 6;

function getResultKey(result) {
  return `${result.type}-${result.id}`;
}

export default function MapSearch({ geoJsonRef, searchWorldData = worldData }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const availableCountryIds = useMemo(
    () => new Set(searchWorldData.features.map((feature) => feature.properties.id)),
    [searchWorldData]
  );

  const search = useCallback((q) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    const lower = q.toLowerCase();

    const countries = searchWorldData.features
      .filter((f) => f.properties.name?.toLowerCase().includes(lower))
      .slice(0, MAX_RESULTS)
      .map((f) => ({ type: 'country', id: f.properties.id, name: f.properties.name }));

    const remaining = MAX_RESULTS - countries.length;
    const capitals = capitalsData.features
      .filter((f) => availableCountryIds.has(f.properties.country || f.properties.id))
      .filter((f) => f.properties.name?.toLowerCase().includes(lower))
      .slice(0, remaining)
      .map((f) => ({
        type: 'capital',
        id: f.properties.id,
        name: f.properties.name,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));

    const combined = [...countries, ...capitals];
    setResults(combined);
    setOpen(combined.length > 0);
    setActiveIndex(combined.length > 0 ? 0 : -1);
  }, [availableCountryIds, searchWorldData]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    search(q);
  };

  const closeResults = useCallback((shouldBlur = false) => {
    setOpen(false);
    setActiveIndex(-1);
    if (shouldBlur) {
      inputRef.current?.blur();
    }
  }, []);

  const handleSelect = (result) => {
    setQuery('');
    setResults([]);
    closeResults();
    if (result.type === 'country') {
      if (!geoJsonRef.current) return;
      geoJsonRef.current.eachLayer((l) => {
        if (l.feature?.properties?.id === result.id) {
          try {
            map.fitBounds(l.getBounds(), { padding: [40, 40] });
          } catch (err) {
            console.warn('[MapSearch] fitBounds failed:', err);
          }
        }
      });
    } else {
      map.flyTo([result.lat, result.lng], 8);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeResults(true);
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index < results.length - 1 ? index + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index > 0 ? index - 1 : results.length - 1));
    } else if (e.key === 'Enter' && open && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        closeResults();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        closeResults(true);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeResults, open]);

  // Prevent map interactions when interacting with search
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation?.(el);
    L.DomEvent.disableScrollPropagation?.(el);
  }, []);

  return (
    <div className="map-search leaflet-control" ref={wrapperRef}>
      <div className="map-search-input-wrap">
        <svg className="map-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="map-search-input"
          type="text"
          placeholder="Search country or city…"
          aria-label="Search for a country or city"
          value={query}
          onChange={handleChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {query && (
          <button
            type="button"
            className="map-search-clear"
            onClick={() => { setQuery(''); setResults([]); closeResults(); }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="map-search-results" aria-label="Search results">
          {results.map((r, index) => (
            <li key={getResultKey(r)} className="map-search-result">
              <button
                type="button"
                className={`map-search-result-btn${index === activeIndex ? ' is-active' : ''}`}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="map-search-result-icon">{r.type === 'country' ? '🌍' : '📍'}</span>
                <span className="map-search-result-name">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
