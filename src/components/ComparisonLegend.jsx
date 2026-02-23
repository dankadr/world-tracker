import './ComparisonView.css';

export default function ComparisonLegend({ friendName, friendPicture, onClose }) {
  return (
    <div className="comparison-legend">
      <div className="comparison-legend-header">
        <div className="comparison-legend-friend">
          {friendPicture ? (
            <img className="comparison-legend-avatar" src={friendPicture} alt={friendName} referrerPolicy="no-referrer" />
          ) : (
            <div className="comparison-legend-avatar comparison-legend-avatar-initials">
              {(friendName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="comparison-legend-name">vs {friendName}</span>
        </div>
        <button className="comparison-legend-close" onClick={onClose} title="Exit comparison">&times;</button>
      </div>
      <div className="comparison-legend-items">
        <div className="comparison-legend-item">
          <span className="comparison-legend-dot" style={{ background: '#27AE60' }} />
          <span>Both visited</span>
        </div>
        <div className="comparison-legend-item">
          <span className="comparison-legend-dot" style={{ background: '#3498DB' }} />
          <span>Only you</span>
        </div>
        <div className="comparison-legend-item">
          <span className="comparison-legend-dot" style={{ background: '#E74C3C' }} />
          <span>Only {friendName?.split(' ')[0] || 'friend'}</span>
        </div>
        <div className="comparison-legend-item">
          <span className="comparison-legend-dot comparison-legend-dot-empty" />
          <span>Neither</span>
        </div>
      </div>
    </div>
  );
}
