import { useState, useRef, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import worldData from '../data/world.json';
import capitalsData from '../data/capitals.json';

const MAX_RESULTS = 6;

export default function MapSearch({ geoJsonRef }) {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const search = useCallback((q) => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const lower = q.toLowerCase();

    const countries = worldData.features
      .filter((f) => f.properties.name?.toLowerCase().includes(lower))
      .slice(0, MAX_RESULTS)
      .map((f) => ({ type: 'country', id: f.properties.id, name: f.properties.name }));

    const remaining = MAX_RESULTS - countries.length;
    const capitals = capitalsData.features
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
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    search(q);
  };

  const handleSelect = (result) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    if (result.type === 'country') {
      if (!geoJsonRef.current) return;
      geoJsonRef.current.eachLayer((l) => {
        if (l.feature?.properties?.id === result.id) {
          try {
            map.fitBounds(l.getBounds(), { padding: [40, 40] });
          } catch (_) {}
        }
      });
    } else {
      map.flyTo([result.lat, result.lng], 8);
    }
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
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
  }, [open]);

  // Prevent map interactions when interacting with search
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
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
          value={query}
          onChange={handleChange}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
        />
        {query && (
          <button
            className="map-search-clear"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="map-search-results">
          {results.map((r) => (
            <li
              key={r.id}
              className="map-search-result"
              onClick={() => handleSelect(r)}
            >
              <span className="map-search-result-icon">{r.type === 'country' ? '🌍' : '📍'}</span>
              <span className="map-search-result-name">{r.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
