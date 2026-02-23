import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import useChallenges from '../hooks/useChallenges';
import useChallengeStreak from '../hooks/useChallengeStreak';
import ChallengeCreateModal from './ChallengeCreateModal';
import ChallengeDetailModal from './ChallengeDetailModal';
import ConfirmDialog from './ConfirmDialog';
import countries from '../data/countries';
import { formatTimeRemaining, getDifficultyLabel } from '../utils/challengeUtils';
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

// Build region map for a given tracker
function buildRegionMap(trackerId) {
  const regionMap = {};
  if (trackerId && trackerId !== 'world') {
    const features = countries[trackerId]?.data?.features || [];
    features.forEach((f) => {
      if (f.properties?.id && f.properties?.name) {
        regionMap[f.properties.id] = f.properties.name;
      }
    });
  }
  return regionMap;
}

// Get formatted region string for display
function getRegionDisplay(challenge) {
  const regions = challenge.target_regions || [];
  if (regions[0] === '*') return 'All regions';
  
  const regionMap = buildRegionMap(challenge.tracker_id);
  const names = regions.slice(0, 3).map(id => regionMap[id] || id);
  
  if (regions.length <= 3) {
    return names.join(', ');
  }
  return `${names.join(', ')}, +${regions.length - 3} more`;
}

function ChallengeCard({ challenge, userId, onClick }) {
  const progress = challenge.progress || {};
  const isRace = challenge.challenge_type === 'race';
  const isCreator = challenge.creator_id === userId;
  const tracker = TRACKER_LABELS[challenge.tracker_id] || { flag: '🗺️', name: challenge.tracker_id };
  const regionDisplay = getRegionDisplay(challenge);
  const total = progress.total || 0;
  const streak = useChallengeStreak(challenge, progress.participants, userId);
  const difficultyInfo = getDifficultyLabel(challenge.difficulty);
  const timeRemaining = formatTimeRemaining(challenge.end_at);

  // For collaborative: use merged progress; for race: show your own
  let pct = 0;
  let visitedCount = 0;
  if (isRace) {
    const me = progress.participants?.find((p) => p.user_id === userId);
    visitedCount = me?.visited_count || 0;
    pct = total > 0 ? Math.round((visitedCount / total) * 100) : 0;
  } else {
    visitedCount = progress.collaborative_count || 0;
    pct = progress.collaborative_pct || 0;
  }

  return (
    <div className="ch-card" onClick={onClick}>
      {progress.is_completed && (
        <div className="ch-card-completed-badge">✓ Completed</div>
      )}
      <div className="ch-card-header">
        <span className="ch-card-tracker">{tracker.flag}</span>
        <div className="ch-card-title-group">
          <span className="ch-card-title">{challenge.title}</span>
          <span className="ch-card-meta">
            {isRace ? '🏁 Race' : '🤝 Team'} · {tracker.name}
            {isCreator && <span className="ch-card-creator"> · Creator</span>}
          </span>
          <span className="ch-card-regions">📍 {regionDisplay}</span>
          <div className="ch-card-badges">
            {difficultyInfo && (
              <span className="ch-card-difficulty" style={{ color: difficultyInfo.color }}>
                {difficultyInfo.emoji} {difficultyInfo.label}
              </span>
            )}
            {timeRemaining && (
              <span className="ch-card-timer">⏰ {timeRemaining}</span>
            )}
          </div>
        </div>
        <div className="ch-card-right">
          <div className="ch-card-avatars">
            {(challenge.participants || []).slice(0, 3).map((p) => (
              <img key={p.id} className="ch-card-avatar" src={p.picture} alt={p.name} title={p.name} referrerPolicy="no-referrer" />
            ))}
            {challenge.participant_count > 3 && (
              <span className="ch-card-avatar-more">+{challenge.participant_count - 3}</span>
            )}
          </div>
          {streak.currentStreak > 0 && !progress.is_completed && (
            <div className="ch-card-streak">
              🔥 {streak.currentStreak}d
            </div>
          )}
          {streak.daysSinceStart > 0 && (
            <div className="ch-card-days">
              📅 {streak.daysSinceStart}d ago
            </div>
          )}
        </div>
      </div>
      <div className="ch-card-progress">
        <div className="ch-card-bar">
          <div className="ch-card-bar-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="ch-card-stats">
          <span className="ch-card-pct">{pct}%</span>
          <span className="ch-card-fraction">{visitedCount}/{total}</span>
        </div>
      </div>
    </div>
  );
}

export default function ChallengesPanel({ onClose }) {
  const { user, isLoggedIn } = useAuth();
  const { challenges, loading, refresh, create, getDetail, leave, remove } = useChallenges();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(null);

  const handleOpenDetail = useCallback(async (challenge) => {
    setSelectedChallenge(challenge);
    setDetailLoading(true);
    try {
      const detail = await getDetail(challenge.id);
      setDetailData(detail);
    } catch {
      setDetailData(challenge);
    } finally {
      setDetailLoading(false);
    }
  }, [getDetail]);

  const handleCloseDetail = useCallback(() => {
    setSelectedChallenge(null);
    setDetailData(null);
  }, []);

  const handleCreate = useCallback(async (data) => {
    await create(data);
    setShowCreate(false);
  }, [create]);

  const handleLeave = useCallback(async () => {
    if (!confirmLeave) return;
    try {
      await leave(confirmLeave.id);
      handleCloseDetail();
    } catch (err) {
      console.error('Failed to leave challenge:', err);
    } finally {
      setConfirmLeave(null);
    }
  }, [confirmLeave, leave, handleCloseDetail]);

  const handleDelete = useCallback(async (challengeId) => {
    try {
      await remove(challengeId);
      handleCloseDetail();
    } catch (err) {
      console.error('Failed to delete challenge:', err);
    }
  }, [remove, handleCloseDetail]);

  if (!isLoggedIn) {
    return (
      <div className="challenges-panel">
        <div className="ch-header">
          <h2 className="ch-title">🏆 Challenges</h2>
          {onClose && <button className="ch-close" onClick={onClose}>&times;</button>}
        </div>
        <div className="ch-empty-auth">
          <p>Sign in to create & join travel challenges with friends!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="challenges-panel">
      <div className="ch-header">
        <h2 className="ch-title">🏆 Challenges</h2>
        <div className="ch-header-actions">
          <button className="ch-create-btn" onClick={() => setShowCreate(true)}>+ Create</button>
          {onClose && <button className="ch-close" onClick={onClose}>&times;</button>}
        </div>
      </div>

      <div className="ch-scrollable">
        {loading && challenges.length === 0 && (
          <p className="ch-empty">Loading challenges...</p>
        )}
        {!loading && challenges.length === 0 && (
          <div className="ch-empty-state">
            <span className="ch-empty-icon">🏔️</span>
            <p className="ch-empty-text">No challenges yet</p>
            <p className="ch-empty-sub">Create a challenge and invite your friends to track progress together!</p>
          </div>
        )}

        {challenges.map((c) => (
          <ChallengeCard
            key={c.id}
            challenge={c}
            userId={user?.id}
            onClick={() => handleOpenDetail(c)}
          />
        ))}
      </div>

      {showCreate && (
        <ChallengeCreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={detailData || selectedChallenge}
          loading={detailLoading}
          userId={user?.id}
          onClose={handleCloseDetail}
          onLeave={(c) => setConfirmLeave(c)}
          onDelete={handleDelete}
          onRefresh={() => handleOpenDetail(selectedChallenge)}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmLeave}
        message={`Leave "${confirmLeave?.title || 'this challenge'}"?${confirmLeave?.creator_id === user?.id ? ' As the creator, this will delete it for everyone.' : ''}`}
        confirmLabel="Leave"
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(null)}
        destructive
      />
    </div>
  );
}
