import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './DataImport.css';
import { emitVisitedChange } from '../utils/events';

const VALID_TRACKER_IDS = new Set(['ch', 'us', 'usparks', 'nyc', 'no', 'ca', 'capitals', 'jp', 'au', 'unesco']);

function validateExport(data) {
  if (!data || typeof data !== 'object') return 'Invalid file format.';
  if (data.exportVersion !== 1) return 'Unsupported export version.';
  if (!data.visited || typeof data.visited !== 'object') return 'Missing visited data.';
  return null;
}

export default function DataImport({ onImportComplete }) {
  const { token } = useAuth();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState('merge'); // 'merge' | 'overwrite'
  const [done, setDone] = useState(false);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setParsed(null);
    setDone(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const err = validateExport(data);
        if (err) { setError(err); return; }
        setParsed(data);
        buildPreview(data);
      } catch {
        setError('Could not parse file. Make sure it\'s a valid JSON export.');
      }
    };
    reader.readAsText(file);
  }

  function buildPreview(data) {
    const regionCounts = {};
    if (data.visited?.regions) {
      for (const [id, regions] of Object.entries(data.visited.regions)) {
        if (VALID_TRACKER_IDS.has(id)) regionCounts[id] = Array.isArray(regions) ? regions.length : 0;
      }
    }
    const worldCount = Array.isArray(data.visited?.world) ? data.visited.world.length : 0;
    const wishlistCount = Array.isArray(data.wishlist) ? data.wishlist.length : 0;
    setPreview({ regionCounts, worldCount, wishlistCount, exportedAt: data.exportedAt });
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      if (token) {
        await importAuthenticated(parsed, token, mode);
      } else {
        importGuest(parsed, mode);
      }
      setDone(true);
      onImportComplete?.();
    } catch (err) {
      setError('Import failed. ' + (err.message || 'Please try again.'));
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setParsed(null);
    setError(null);
    setDone(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (done) {
    return (
      <div className="data-import-done">
        <span className="data-import-done-icon">✓</span>
        <p>Import complete! Your data has been updated.</p>
        <button className="data-import-btn" onClick={handleReset}>Import another file</button>
      </div>
    );
  }

  return (
    <div className="data-import">
      <p className="data-import-desc">
        Restore from a previous JSON export. Merge adds new data; Overwrite replaces existing data.
      </p>

      {error && <p className="data-import-error">{error}</p>}

      {!preview ? (
        <label className="data-import-dropzone">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFile}
            className="data-import-file-input"
          />
          <span className="data-import-dropzone-icon">📂</span>
          <span className="data-import-dropzone-text">Choose JSON export file</span>
        </label>
      ) : (
        <div className="data-import-preview">
          <p className="data-import-preview-title">Preview</p>
          {preview.exportedAt && (
            <p className="data-import-preview-date">
              Exported: {new Date(preview.exportedAt).toLocaleDateString()}
            </p>
          )}
          <ul className="data-import-preview-list">
            <li>🌍 World countries: <strong>{preview.worldCount}</strong></li>
            {Object.entries(preview.regionCounts).map(([id, count]) => (
              <li key={id}>{id}: <strong>{count} regions</strong></li>
            ))}
            {preview.wishlistCount > 0 && (
              <li>⭐ Wishlist items: <strong>{preview.wishlistCount}</strong></li>
            )}
          </ul>

          <div className="data-import-mode">
            <label className="data-import-radio">
              <input type="radio" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              Merge (add new, keep existing)
            </label>
            <label className="data-import-radio">
              <input type="radio" value="overwrite" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} />
              Overwrite (replace all data)
            </label>
          </div>

          <div className="data-import-actions">
            <button className="data-import-btn data-import-btn-primary" onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : 'Apply import'}
            </button>
            <button className="data-import-btn" onClick={handleReset} disabled={importing}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Authenticated import ──

async function importAuthenticated(data, token, mode) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Import world countries
  if (Array.isArray(data.visited?.world)) {
    let countries = data.visited.world;
    if (mode === 'merge') {
      const res = await fetch('/api/visited-world', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const existing = await res.json();
        const merged = [...new Set([...(existing.countries ?? []), ...countries])];
        countries = merged;
      }
    }
    await fetch('/api/visited-world', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ countries }),
    });
  }

  // Import per-tracker regions
  if (data.visited?.regions) {
    for (const [trackerId, regions] of Object.entries(data.visited.regions)) {
      if (!VALID_TRACKER_IDS.has(trackerId) || !Array.isArray(regions)) continue;
      let toSave = regions;
      if (mode === 'merge') {
        const res = await fetch(`/api/visited/${trackerId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const existing = await res.json();
          toSave = [...new Set([...(existing.regions ?? []), ...regions])];
        }
      }
      await fetch(`/api/visited/${trackerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          regions: toSave,
          ...(data.dates?.[trackerId] && Object.keys(data.dates[trackerId]).length
            ? { dates: data.dates[trackerId] } : {}),
          ...(data.notes?.[trackerId] && Object.keys(data.notes[trackerId]).length
            ? { notes: data.notes[trackerId] } : {}),
        }),
      });
    }
  }
}

// ── Guest mode import (localStorage) ──

function importGuest(data, mode) {
  // World countries
  if (Array.isArray(data.visited?.world)) {
    let countries = data.visited.world;
    if (mode === 'merge') {
      try {
        const existing = JSON.parse(localStorage.getItem('swiss-tracker-visited-world') || '[]');
        countries = [...new Set([...existing, ...countries])];
      } catch {}
    }
    localStorage.setItem('swiss-tracker-visited-world', JSON.stringify(countries));
  }

  // Per-tracker regions
  if (data.visited?.regions) {
    for (const [trackerId, regions] of Object.entries(data.visited.regions)) {
      if (!VALID_TRACKER_IDS.has(trackerId) || !Array.isArray(regions)) continue;
      const key = `swiss-tracker-visited-${trackerId}`;
      let toSave = regions;
      if (mode === 'merge') {
        try {
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          toSave = [...new Set([...existing, ...regions])];
        } catch {}
      }
      localStorage.setItem(key, JSON.stringify(toSave));
    }
  }

  emitVisitedChange();
}
