import './ChallengesPanel.css';

const TRACKER_LABELS = {
  world: { flag: '🌍', name: 'World' },
  ch: { flag: '🇨🇭', name: 'Switzerland' },
  us: { flag: '🇺🇸', name: 'United States' },
  usparks: { flag: '🏞️', name: 'US Nat. Parks' },
  nyc: { flag: '🗽', name: 'NYC' },
  no: { flag: '🇳🇴', name: 'Norway' },
  ca: { flag: '🇨🇦', name: 'Canada' },
  capitals: { flag: '🏛️', name: 'World Capitals' },
};

function LeaderboardRow({ participant, rank, total, isMe }) {
  const pct = total > 0 ? Math.round((participant.visited_count / total) * 100) : 0;
  return (
    <div className={`ch-lb-row ${isMe ? 'is-me' : ''}`}>
      <span className="ch-lb-rank">#{rank}</span>
      {participant.picture ? (
        <img className="ch-lb-avatar" src={participant.picture} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="ch-lb-avatar ch-lb-avatar-placeholder">
          {(participant.name || '?')[0]}
        </span>
      )}
      <div className="ch-lb-info">
        <span className="ch-lb-name">{participant.name}{isMe ? ' (you)' : ''}</span>
        <div className="ch-lb-bar-wrapper">
          <div className="ch-lb-bar">
            <div className="ch-lb-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="ch-lb-stat">{participant.visited_count}/{total} ({pct}%)</span>
        </div>
      </div>
    </div>
  );
}

export default function ChallengeDetailModal({ challenge, loading, userId, onClose, onLeave, onDelete, onRefresh }) {
  const isRace = challenge.challenge_type === 'race';
  const isCreator = challenge.creator_id === userId;
  const tracker = TRACKER_LABELS[challenge.tracker_id] || { flag: '🗺️', name: challenge.tracker_id };
  const progress = challenge.progress || {};
  const participants = progress.participants || [];
  const total = progress.total || 0;

  // Sort participants by visited_count for race mode
  const sorted = isRace
    ? [...participants].sort((a, b) => b.visited_count - a.visited_count)
    : participants;

  const collabPct = progress.collaborative_pct || 0;
  const collabCount = progress.collaborative_count || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ch-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ch-detail-header">
          <div className="ch-detail-title-row">
            <span className="ch-detail-tracker">{tracker.flag}</span>
            <div>
              <h3 className="ch-detail-title">{challenge.title}</h3>
              <span className="ch-detail-meta">
                {isRace ? '🏁 Race' : '🤝 Team'} · {tracker.name} · {(challenge.participants || participants).length} participants
              </span>
            </div>
          </div>
          <button className="ch-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ch-detail-body">
          {loading ? (
            <p className="ch-loading">Loading challenge details...</p>
          ) : (
            <>
              {challenge.description && (
                <p className="ch-detail-desc">{challenge.description}</p>
              )}

              {/* Collaborative Progress */}
              {!isRace && (
                <div className="ch-collab-section">
                  <h4 className="ch-section-label">Team Progress</h4>
                  <div className="ch-collab-progress">
                    <div className="ch-collab-bar">
                      <div className="ch-collab-bar-fill" style={{ width: `${Math.min(collabPct, 100)}%` }} />
                    </div>
                    <div className="ch-collab-stats">
                      <span className="ch-collab-count">{collabCount} / {total}</span>
                      <span className="ch-collab-pct">{collabPct}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Participants / Leaderboard */}
              <div className="ch-lb-section">
                <h4 className="ch-section-label">{isRace ? 'Leaderboard' : 'Contributions'}</h4>
                <div className="ch-lb-list">
                  {sorted.map((p, i) => (
                    <LeaderboardRow
                      key={p.user_id}
                      participant={p}
                      rank={i + 1}
                      total={total}
                      isMe={p.user_id === userId}
                    />
                  ))}
                </div>
              </div>

              {/* Target regions info */}
              {challenge.target_regions && challenge.target_regions[0] !== '*' && (
                <div className="ch-targets-section">
                  <h4 className="ch-section-label">Target Regions ({challenge.target_regions.length})</h4>
                  <div className="ch-targets-list">
                    {challenge.target_regions.map((r) => {
                      // Check if this region is visited (in collab mode, by anyone)
                      const visitedByAnyone = participants.some((p) => p.visited_regions?.includes(r));
                      return (
                        <span key={r} className={`ch-target-tag ${visitedByAnyone ? 'visited' : ''}`}>
                          {r}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Created info */}
              <div className="ch-detail-footer-info">
                <span className="ch-detail-date">
                  Created {new Date(challenge.created_at).toLocaleDateString()}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="ch-detail-actions">
          <button className="ch-refresh-btn" onClick={onRefresh} title="Refresh progress">
            ↻ Refresh
          </button>
          <div className="ch-detail-actions-right">
            {isCreator ? (
              <button className="ch-delete-btn" onClick={() => onDelete(challenge.id)}>
                Delete Challenge
              </button>
            ) : (
              <button className="ch-leave-btn" onClick={() => onLeave(challenge)}>
                Leave Challenge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
