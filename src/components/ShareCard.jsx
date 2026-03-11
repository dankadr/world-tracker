import { forwardRef } from 'react';
import './ShareCard.css';

const MAX_FLAGS = 8;

function FlagRow({ flags, total }) {
  const shown = flags.slice(0, MAX_FLAGS);
  const overflow = total - MAX_FLAGS;
  return (
    <div className="sc-flags">
      {shown.map((flag, i) => (
        <span key={i} className="sc-flag">{flag}</span>
      ))}
      {overflow > 0 && (
        <span className="sc-flag sc-flag-more">+{overflow}</span>
      )}
    </div>
  );
}

const ShareCard = forwardRef(function ShareCard({ variant, format, theme = 'dark', stats }, ref) {
  const isPortrait = format === 'portrait';
  const isYearly = variant === 'yearly';
  const isDark = theme === 'dark';

  const worldPct = stats.worldPercent ?? 0;
  const worldCountries = stats.worldCountries ?? 0;
  const worldTotal = stats.worldTotal ?? 238;
  const visitedFlags = stats.visitedFlags ?? [];

  // Display: floor the integer part, show one decimal if ≥ 1
  const pctInt = worldPct < 1 && worldPct > 0 ? '<1' : String(Math.floor(worldPct));
  const pctFrac = worldPct >= 1 && worldPct % 1 !== 0
    ? '.' + worldPct.toFixed(1).split('.')[1]
    : '';

  const mrzLine1 = `RIGHTWORLD<<${isYearly ? stats.year : 'ALLTIME'}<<PASSPORT`.padEnd(44, '<').slice(0, 44);
  const mrzLine2 = `TRACKED<<${worldCountries}<<OF<<${worldTotal}<<COUNTRIES<<`.padEnd(44, '<').slice(0, 44);

  return (
    <div
      ref={ref}
      className={`share-card share-card-${format} share-card-${theme}`}
    >
      {/* Header */}
      <div className="sc-header">
        <span className="sc-compass">🧭</span>
        <span className="sc-brand">Right World</span>
        <span className="sc-year-tag">
          {isYearly ? stats.year : 'ALL TIME'}
        </span>
      </div>

      {/* Hero — world % */}
      <div className="sc-hero">
        <div className="sc-pct-row">
          <span className="sc-pct-num">{pctInt}</span>
          <span className="sc-pct-symbol">%</span>
        </div>
        <div className="sc-pct-label">of the world</div>
        <div className="sc-prog-bar">
          <div className="sc-prog-fill" style={{ width: `${Math.min(worldPct, 100)}%` }} />
        </div>
        <div className="sc-pct-detail">
          {worldCountries} of {worldTotal} countries
        </div>
      </div>

      {/* Flag row */}
      {visitedFlags.length > 0 && (
        <FlagRow flags={visitedFlags} total={worldCountries} />
      )}

      <div className="sc-divider" />

      {/* Stats grid */}
      {isYearly ? (
        <div className="sc-stats">
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.totalRegions ?? 0}</span>
            <span className="sc-stat-label">Regions</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.trackersUsed ?? 0}</span>
            <span className="sc-stat-label">Trackers</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.totalVisitDays ?? 0}</span>
            <span className="sc-stat-label">Days</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.achievementsUnlocked ?? 0}</span>
            <span className="sc-stat-label">Badges</span>
          </div>
        </div>
      ) : (
        <div className="sc-stats">
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.totalRegions ?? 0}</span>
            <span className="sc-stat-label">Regions</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.continentsVisited ?? 0}</span>
            <span className="sc-stat-label">Continents</span>
          </div>
          <div className="sc-stat">
            <span className="sc-stat-num">{stats.achievements ?? 0}</span>
            <span className="sc-stat-label">Badges</span>
          </div>
        </div>
      )}

      {/* MRZ zone — light mode only */}
      {!isDark && (
        <div className="sc-mrz">
          <div>{mrzLine1}</div>
          <div>{mrzLine2}</div>
        </div>
      )}

      <div className="sc-footer">rightworld.app</div>
    </div>
  );
});

export default ShareCard;
