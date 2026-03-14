import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { exportAsJson, exportTrackerAsCsv, exportWishlistAsCsv } from '../utils/dataExport';
import './DataExport.css';

const TRACKERS = [
  { id: 'ch', label: 'Switzerland' },
  { id: 'us', label: 'United States' },
  { id: 'usparks', label: 'US National Parks' },
  { id: 'nyc', label: 'New York City' },
  { id: 'no', label: 'Norway' },
  { id: 'ca', label: 'Canada' },
  { id: 'capitals', label: 'World Capitals' },
  { id: 'jp', label: 'Japan' },
  { id: 'au', label: 'Australia' },
  { id: 'unesco', label: 'UNESCO Sites' },
];

export default function DataExport() {
  const { token, user } = useAuth();
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(null); // 'json' | 'csv-{id}' | 'wishlist' | null
  const [error, setError] = useState(null);

  async function run(key, fn) {
    setLoading(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError('Export failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="data-export">
      <p className="data-export-desc">
        Download a copy of all your travel data. This satisfies GDPR data portability.
      </p>

      {error && <p className="data-export-error">{error}</p>}

      <div className="data-export-section">
        <p className="data-export-section-label">Full backup</p>
        <button
          className="data-export-btn data-export-btn-primary"
          onClick={() => run('json', () => exportAsJson(token, userId))}
          disabled={loading === 'json'}
        >
          {loading === 'json' ? 'Exporting…' : '⬇ Export all data as JSON'}
        </button>
      </div>

      <div className="data-export-section">
        <p className="data-export-section-label">Bucket list (CSV)</p>
        <button
          className="data-export-btn"
          onClick={() => run('wishlist', () => exportWishlistAsCsv(token))}
          disabled={!!loading}
        >
          {loading === 'wishlist' ? 'Exporting…' : '⬇ Export bucket list'}
        </button>
      </div>

      <div className="data-export-section">
        <p className="data-export-section-label">Individual trackers (CSV)</p>
        <div className="data-export-tracker-list">
          {TRACKERS.map(({ id, label }) => (
            <button
              key={id}
              className="data-export-btn data-export-btn-sm"
              onClick={() => run(`csv-${id}`, () => exportTrackerAsCsv(id, token, userId))}
              disabled={!!loading}
            >
              {loading === `csv-${id}` ? '…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
