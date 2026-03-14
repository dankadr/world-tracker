import './ComparisonView.css';

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function ComparisonStats({ myVisited, friendVisited, total, friendName, friendPicture, regionLabel, onClose, embedded = false }) {
  const mySet = myVisited instanceof Set ? myVisited : new Set(myVisited || []);
  const friendSet = friendVisited instanceof Set ? friendVisited : new Set(friendVisited || []);

  const both = new Set([...mySet].filter(x => friendSet.has(x)));
  const onlyMe = new Set([...mySet].filter(x => !friendSet.has(x)));
  const onlyFriend = new Set([...friendSet].filter(x => !mySet.has(x)));

  const myPct = total > 0 ? Math.round((mySet.size / total) * 100) : 0;
  const friendPct = total > 0 ? Math.round((friendSet.size / total) * 100) : 0;
  const firstName = friendName?.split(' ')[0] || 'Friend';

  const body = (
      <div className={`comparison-stats-modal${embedded ? ' comparison-stats-modal-embedded' : ''}`} onClick={(e) => !embedded && e.stopPropagation()}>
        <div className="comparison-stats-header">
          <h3>Comparison</h3>
          <button className="comparison-stats-close" onClick={onClose}>&times;</button>
        </div>

        <div className="comparison-stats-versus">
          <div className="comparison-stats-user">
            <span className="comparison-stats-user-icon"><UserIcon /></span>
            <span className="comparison-stats-user-label">You</span>
          </div>
          <span className="comparison-stats-vs">VS</span>
          <div className="comparison-stats-user">
            {friendPicture ? (
              <img className="comparison-stats-avatar" src={friendPicture} alt={friendName} referrerPolicy="no-referrer" />
            ) : (
              <span className="comparison-stats-user-icon"><UserIcon /></span>
            )}
            <span className="comparison-stats-user-label">{firstName}</span>
          </div>
        </div>

        <div className="comparison-stats-bars">
          <div className="comparison-stats-bar-row">
            <span className="comparison-stats-bar-label">You</span>
            <div className="comparison-stats-bar-track">
              <div className="comparison-stats-bar-fill you" style={{ width: `${myPct}%` }} />
            </div>
            <span className="comparison-stats-bar-value">{mySet.size} / {total} ({myPct}%)</span>
          </div>
          <div className="comparison-stats-bar-row">
            <span className="comparison-stats-bar-label">{firstName}</span>
            <div className="comparison-stats-bar-track">
              <div className="comparison-stats-bar-fill friend" style={{ width: `${friendPct}%` }} />
            </div>
            <span className="comparison-stats-bar-value">{friendSet.size} / {total} ({friendPct}%)</span>
          </div>
        </div>

        <div className="comparison-stats-breakdown">
          <div className="comparison-stats-card both">
            <span className="comparison-stats-card-number">{both.size}</span>
            <span className="comparison-stats-card-label">In common</span>
          </div>
          <div className="comparison-stats-card only-me">
            <span className="comparison-stats-card-number">{onlyMe.size}</span>
            <span className="comparison-stats-card-label">Only you</span>
          </div>
          <div className="comparison-stats-card only-friend">
            <span className="comparison-stats-card-number">{onlyFriend.size}</span>
            <span className="comparison-stats-card-label">Only {firstName}</span>
          </div>
        </div>

        {regionLabel && (
          <p className="comparison-stats-footer">{regionLabel}</p>
        )}
      </div>
  );

  if (embedded) return body;

  return (
    <div className="comparison-stats-overlay" onClick={onClose}>
      {body}
    </div>
  );
}
