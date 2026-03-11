import { forwardRef } from 'react';
import './ShareCard.css';

const MAX_FLAGS = 12;

const CONTINENT_ABBREV = {
  'Africa': 'AF',
  'Asia': 'AS',
  'Europe': 'EU',
  'North America': 'NA',
  'South America': 'SA',
  'Oceania': 'OC',
};

function FlagRow({ flags, total }) {
  const shown = flags.slice(0, MAX_FLAGS);
  const overflow = total - MAX_FLAGS;
  return (
    <div className="sc-flags">
      {shown.map((flag, i) => (
        <span key={i} className="sc-flag">{flag}</span>
      ))}
      {overflow > 0 && (
        <span className="sc-flag-more">+{overflow}</span>
      )}
    </div>
  );
}

function ContinentPills({ breakdown }) {
  const entries = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="sc-continents">
      {entries.map(([name, count]) => (
        <div key={name} className="sc-continent-pill">
          <span className="sc-continent-abbrev">
            {CONTINENT_ABBREV[name] || name.slice(0, 2).toUpperCase()}
          </span>
          <span className="sc-continent-count">{count}</span>
        </div>
      ))}
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

  const pctInt = worldPct < 1 && worldPct > 0 ? '<1' : String(Math.floor(worldPct));

  const mrzLine1 = `RIGHTWORLD<<${isYearly ? stats.year : 'ALLTIME'}<<PASSPORT`.padEnd(44, '<').slice(0, 44);
  const mrzLine2 = `TRACKED<<${worldCountries}<<OF<<${worldTotal}<<COUNTRIES<<`.padEnd(44, '<').slice(0, 44);

  const watermarkSrc = isDark
    ? '/brand/rw-monogram-globe-white.png'
    : '/brand/rw-compass-navy.png';

  const showTopTracker = isYearly && isPortrait && stats.topTracker;
  const showComparison = isYearly && isPortrait && stats.comparedToPrevYear;
  const showContinentPills = isYearly && isPortrait && stats.continentBreakdown;

  return (
    <div ref={ref} className={`share-card share-card-${format} share-card-${theme}`}>

      {/* Background watermark */}
      <img className="sc-watermark" src={watermarkSrc} alt="" aria-hidden="true" />

      {/* Header */}
      <div className="sc-header">
        <div className="sc-brand-mark" aria-hidden="true">✦</div>
        <span className="sc-brand">Right World</span>
        <span className="sc-year-tag">{isYearly ? stats.year : 'All Time'}</span>
      </div>

      {/* Hero — world % */}
      <div className="sc-hero">
        {isDark && <div className="sc-hero-glow" />}
        <div className="sc-pct-row">
          <span className="sc-pct-num">{pctInt}</span>
          <span className="sc-pct-symbol">%</span>
        </div>
        <div className="sc-pct-label">of the world explored</div>
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

      {/* Continent breakdown (yearly portrait) */}
      {showContinentPills && (
        <ContinentPills breakdown={stats.continentBreakdown} />
      )}

      {/* Stats grid */}
      <div className="sc-stats">
        {isYearly ? (
          <>
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
          </>
        ) : (
          <>
            <div className="sc-stat">
              <span className="sc-stat-num">{stats.totalRegions ?? 0}</span>
              <span className="sc-stat-label">Regions</span>
            </div>
            <div className="sc-stat">
              <span className="sc-stat-num">{stats.continentsVisited ?? 0}/6</span>
              <span className="sc-stat-label">Continents</span>
            </div>
            <div className="sc-stat">
              <span className="sc-stat-num">{stats.achievements ?? 0}</span>
              <span className="sc-stat-label">Badges</span>
            </div>
          </>
        )}
      </div>

      {/* Top tracker (yearly portrait) */}
      {showTopTracker && (
        <div className="sc-top-tracker">
          <span className="sc-top-tracker-flag">{stats.topTracker.flag}</span>
          <div className="sc-top-tracker-info">
            <span className="sc-top-tracker-label">Most explored</span>
            <span className="sc-top-tracker-name">{stats.topTracker.name}</span>
          </div>
          <span className="sc-top-tracker-count">
            {stats.topTracker.count}&nbsp;{stats.topTracker.regionLabel}
          </span>
        </div>
      )}

      {/* Year comparison (yearly portrait) */}
      {showComparison && (
        <div className={`sc-vs-prev${stats.comparedToPrevYear === 'first-year' ? ' sc-vs-first' : stats.comparedToPrevYear.startsWith('+') ? ' sc-vs-up' : ' sc-vs-down'}`}>
          {stats.comparedToPrevYear === 'first-year'
            ? '⭐ First year on record'
            : `${stats.comparedToPrevYear} compared to ${stats.year - 1}`}
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
