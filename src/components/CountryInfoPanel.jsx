import { createPortal } from 'react-dom';
import useCountryInfo from '../hooks/useCountryInfo';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
import './CountryInfoPanel.css';

function formatNumber(n) {
  if (!n) return '—';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

function formatArea(km2) {
  if (!km2) return '—';
  return km2.toLocaleString() + ' km²';
}

function StatRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="cip-stat-row">
      <span className="cip-stat-label">{label}</span>
      <span className="cip-stat-value">{value}</span>
    </div>
  );
}

/**
 * CountryInfoPanel — shows static info about a world country.
 *
 * Props:
 *   countryId     {string}    ISO alpha-2 code (e.g. 'us')
 *   countryName   {string}    Displayed name fallback
 *   isVisited     {boolean}
 *   onToggleVisited  {() => void}  callback to mark visited / unvisited
 *   onClose          {() => void}
 *   onExplorRegions  {() => void}  callback to jump to region tracker (optional)
 */
export default function CountryInfoPanel({
  countryId,
  countryName,
  isVisited,
  onToggleVisited,
  onClose,
  onExploreRegions,
}) {
  const { info, loading } = useCountryInfo(countryId);
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);

  const name = info?.name || countryName || countryId?.toUpperCase() || '—';
  const flag = info?.flag || '';

  const panel = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="cip-panel modal-content"
        ref={handleRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swipe handle */}
        <div className="swipeable-drag-strip" {...dragHandlers}>
          <div className="drag-handle" />
        </div>

        {/* Header */}
        <div className="cip-header">
          {flag && <span className="cip-flag">{flag}</span>}
          <div className="cip-header-text">
            <h2 className="cip-name">{name}</h2>
            {info?.capital && (
              <p className="cip-capital">🏛 {info.capital}</p>
            )}
          </div>
          <button className="cip-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="cip-loading">Loading…</div>
        ) : info ? (
          <>
            <div className="cip-stats">
              <StatRow label="Continent" value={info.continent} />
              <StatRow label="Population" value={formatNumber(info.population)} />
              <StatRow label="Area" value={formatArea(info.area)} />
              <StatRow label="Currency" value={info.currencySymbol ? `${info.currencyName} (${info.currencySymbol})` : info.currencyName} />
              <StatRow label="Language" value={info.language} />
              <StatRow label="Calling code" value={info.callingCode} />
              <StatRow label="Driving" value={info.drivingSide === 'left' ? 'Left side' : 'Right side'} />
            </div>

            <div className="cip-actions">
              <button
                className={`cip-action-btn cip-action-visited ${isVisited ? 'active' : ''}`}
                onClick={() => { onToggleVisited?.(); onClose(); }}
              >
                {isVisited ? '✓ Visited' : '+ Mark Visited'}
              </button>
              {onExploreRegions && (
                <button
                  className="cip-action-btn cip-action-explore"
                  onClick={() => { onExploreRegions(); onClose(); }}
                >
                  🗺 Explore Regions
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="cip-no-data">No info available for this country.</p>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
