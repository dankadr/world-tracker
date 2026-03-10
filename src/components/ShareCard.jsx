import { forwardRef } from 'react';
import './ShareCard.css';

const ShareCard = forwardRef(function ShareCard({ variant, format, stats }, ref) {
  const isPortrait = format === 'portrait';
  const isYearly = variant === 'yearly';

  return (
    <div
      ref={ref}
      className={`share-card share-card-${format}`}
    >
      {/* Header */}
      <div className="share-card-header">
        <span className="share-card-globe">🌍</span>
        <span className="share-card-brand">Right World</span>
      </div>

      {isYearly ? (
        <>
          <div className="share-card-year">{stats.year}</div>
          <div className="share-card-year-sub">Year in Review</div>
          <div className="share-card-divider" />

          {/* Stats grid: 2x2 for portrait, 4-across for square */}
          <div className={`share-card-grid ${isPortrait ? 'share-card-grid-2x2' : 'share-card-grid-4'}`}>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.totalRegions}</span>
              <span className="share-card-label">Regions</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.trackersUsed}</span>
              <span className="share-card-label">Trackers</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.totalVisitDays}</span>
              <span className="share-card-label">Days</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-num">{stats.achievementsUnlocked}</span>
              <span className="share-card-label">Badges<br />(all time)</span>
            </div>
          </div>

          {stats.topTracker && (
            <div className="share-card-top-tracker">
              🏆 {stats.topTracker.flag} {stats.topTracker.name} · {stats.topTracker.count} {stats.topTracker.regionLabel.toLowerCase()}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="share-card-title">My Travel<br />Journey</div>
          <div className="share-card-divider" />

          <div className="share-card-list">
            <div className="share-card-list-row">
              <span className="share-card-list-label">🌍 Countries</span>
              <span className="share-card-list-num">{stats.worldCountries}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">📍 Regions</span>
              <span className="share-card-list-num">{stats.totalRegions}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">🌐 Continents</span>
              <span className="share-card-list-num">{stats.continentsVisited}</span>
            </div>
            <div className="share-card-list-row">
              <span className="share-card-list-label">🎖️ Badges</span>
              <span className="share-card-list-num">{stats.achievements}</span>
            </div>
          </div>
        </>
      )}

      <div className="share-card-footer">rightworld.app</div>
    </div>
  );
});

export default ShareCard;
