import './iosPrimitives.css';

export default function ChallengeDetailSkeleton() {
  return (
    <div className="ch-detail-skeleton" aria-hidden="true">
      <div className="ios-skeleton ch-detail-skeleton-description" />

      <div className="ch-detail-skeleton-section">
        <div className="ios-skeleton ch-detail-skeleton-label" />
        <div className="ios-skeleton ch-detail-skeleton-card ch-detail-skeleton-progress" />
      </div>

      <div className="ch-detail-skeleton-section">
        <div className="ios-skeleton ch-detail-skeleton-label" />
        <div className="ch-detail-skeleton-stats">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ios-skeleton ch-detail-skeleton-card ch-detail-skeleton-stat" />
          ))}
        </div>
        <div className="ch-detail-skeleton-list">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ios-skeleton ch-detail-skeleton-card ch-detail-skeleton-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
