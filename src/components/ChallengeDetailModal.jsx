import './ChallengesPanel.css';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
import countries from '../data/countries';
import { useState } from 'react';

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
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);
  const [shareCopied, setShareCopied] = useState(false);
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

  // Calculate leaderboard stats
  const stats = {
    mostActive: sorted.length > 0 ? sorted[0] : null,
    totalVisits: participants.reduce((sum, p) => sum + (p.visited_count || 0), 0),
    avgVisits: participants.length > 0 
      ? Math.round(participants.reduce((sum, p) => sum + (p.visited_count || 0), 0) / participants.length) 
      : 0,
    participantCount: participants.length,
  };

  // Build a lookup from region ID → display name for this tracker
  const regionMap = {};
  if (challenge.tracker_id && challenge.tracker_id !== 'world') {
    const features = countries[challenge.tracker_id]?.data?.features || [];
    features.forEach((f) => {
      if (f.properties?.id && f.properties?.name) {
        regionMap[f.properties.id] = f.properties.name;
      }
    });
  }

  const handleShareLink = () => {
    const url = `${window.location.origin}/challenges/${challenge.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const text = `Join my travel challenge: "${challenge.title}" - Can you visit more regions than me? 🌍`;
    const url = `${window.location.origin}/challenges/${challenge.id}`;

    if (navigator.share) {
      navigator.share({ title: challenge.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      });
    }
  };

  return (
    <div className="modal-overlay ch-detail-overlay" onClick={onClose}>
      <div className="modal-content ch-detail-modal" ref={handleRef} onClick={(e) => e.stopPropagation()}>
        <div className="ch-detail-header" {...dragHandlers}>
          <button className="ch-back-btn" onClick={onClose} aria-label="Go back">
            ← Back
          </button>
          <div className="ch-detail-title-row">
            <span className="ch-detail-tracker">{tracker.flag}</span>
            <div>
              <h3 className="ch-detail-title">{challenge.title}</h3>
              <span className="ch-detail-meta">
                {isRace ? '🏁 Race' : '🤝 Team'} · {tracker.name} · {(challenge.participants || participants).length} participants
              </span>
            </div>
          </div>
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
                
                {/* Stats Cards */}
                {participants.length > 0 && (
                  <div className="ch-stats-grid">
                    <div className="ch-stat-card">
                      <span className="ch-stat-icon">👥</span>
                      <span className="ch-stat-value">{stats.participantCount}</span>
                      <span className="ch-stat-label">Participants</span>
                    </div>
                    <div className="ch-stat-card">
                      <span className="ch-stat-icon">📊</span>
                      <span className="ch-stat-value">{stats.avgVisits}</span>
                      <span className="ch-stat-label">Avg Visits</span>
                    </div>
                    {stats.mostActive && (
                      <div className="ch-stat-card ch-stat-card-highlight">
                        <span className="ch-stat-icon">🔥</span>
                        <span className="ch-stat-value">{stats.mostActive.visited_count}</span>
                        <span className="ch-stat-label">Top Score</span>
                      </div>
                    )}
                  </div>
                )}

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
              {challenge.target_regions && (
                <div className="ch-targets-section">
                  {challenge.target_regions[0] === '*' ? (
                    <>
                      <h4 className="ch-section-label">Target Regions</h4>
                      <div className="ch-targets-list">
                        <span className="ch-target-tag ch-target-all">All regions</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="ch-section-label">Target Regions ({challenge.target_regions.length})</h4>
                      <div className="ch-targets-list">
                        {challenge.target_regions.map((r) => {
                          const visitedByAnyone = participants.some((p) => p.visited_regions?.includes(r));
                          return (
                            <span key={r} className={`ch-target-tag ${visitedByAnyone ? 'visited' : ''}`}>
                              {regionMap[r] || r}
                            </span>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Share Section */}
              <div className="ch-share-section">
                <button className="ch-share-btn" onClick={handleShareLink} title="Copy invite link">
                  {shareCopied ? '✓ Copied!' : '🔗 Copy Link'}
                </button>
                <button className="ch-share-btn" onClick={handleShare} title="Share challenge">
                  📤 Share
                </button>
              </div>

              {/* Created info */}
              <div className="ch-detail-footer-info">
                <span className="ch-detail-date">
                  Created {new Date(challenge.created_at).toLocaleDateString()}
                </span>
                {challenge.completed_at && (
                  <span className="ch-detail-completed">
                    ✓ Completed {new Date(challenge.completed_at).toLocaleDateString()}
                  </span>
                )}
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
