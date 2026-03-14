import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import useChallenges from '../hooks/useChallenges';
import useChallengeStreak from '../hooks/useChallengeStreak';
import usePullToRefresh from '../hooks/usePullToRefresh';
import ChallengeCreateModal from './ChallengeCreateModal';
import ChallengeDetailModal from './ChallengeDetailModal';
import ConfirmDialog from './ConfirmDialog';
import countries from '../data/countries';
import { formatTimeRemaining, getDifficultyLabel } from '../utils/challengeUtils';
import useDeviceType from '../hooks/useDeviceType';
import { useNavigation } from '../context/NavigationContext';
import { haptics } from '../utils/haptics';
import './ChallengesPanel.css';
import './iosPrimitives.css';

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

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 7H5a2 2 0 0 0 0 4h2" />
      <path d="M17 7h2a2 2 0 0 1 0 4h-2" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" />
      <path d="M2.5 20v-1a4.5 4.5 0 0 1 9 0v1" />
      <circle cx="16.5" cy="7.5" r="2.5" />
      <path d="M14 20v-.8a3.8 3.8 0 0 1 5.5-3.4" />
    </svg>
  );
}

function RaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 5h9l-1.5 4L14 13H5V5Z" />
      <path d="M5 18V5" />
      <path d="M14 5h4" />
      <path d="M14 9h4" />
      <path d="M12.5 13h4" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-4 2.8-5.8 4.2-8.4.4-.8.7-1.7.8-2.8 2.9 1.8 4.8 4.6 4.8 7.9.8-.8 1.4-2 1.7-3.4 1.8 1.8 2.8 4 2.8 6.5C20 18.6 16.6 21 12 21Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M7.5 3.5v4" />
      <path d="M16.5 3.5v4" />
      <path d="M3.5 10.5h17" />
    </svg>
  );
}

function PullArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h18" />
      <path d="m4 20 5-9 3 4 2-3 6 8" />
      <path d="m9 11 3-5 3 6 2-3 3 8" />
    </svg>
  );
}

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

function getRegionDisplay(challenge) {
  const regions = challenge.target_regions || [];
  if (regions[0] === '*') return 'All regions';

  const regionMap = buildRegionMap(challenge.tracker_id);
  const names = regions.slice(0, 3).map((id) => regionMap[id] || id);

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
    <div className="ch-card ios-touch-feedback" onClick={onClick}>
      {progress.is_completed && (
        <div className="ch-card-completed-badge">Completed</div>
      )}
      <div className="ch-card-header">
        <span className="ch-card-tracker">{tracker.flag}</span>
        <div className="ch-card-title-group">
          <span className="ch-card-title">{challenge.title}</span>
          <span className="ch-card-meta">
            <span className="ch-inline-icon">{isRace ? <RaceIcon /> : <TeamIcon />}</span>
            {isRace ? 'Race' : 'Team'} · {tracker.name}
            {isCreator && <span className="ch-card-creator"> · Creator</span>}
          </span>
          <span className="ch-card-regions">
            <span className="ch-inline-icon"><PinIcon /></span>
            {regionDisplay}
          </span>
          <div className="ch-card-badges">
            {difficultyInfo && (
              <span className="ch-card-difficulty" style={{ color: difficultyInfo.color }}>
                <span className="ch-difficulty-dot" style={{ backgroundColor: difficultyInfo.color }} />
                {difficultyInfo.label}
              </span>
            )}
            {timeRemaining && (
              <span className="ch-card-timer">
                <span className="ch-inline-icon"><ClockIcon /></span>
                {timeRemaining}
              </span>
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
              <span className="ch-inline-icon"><FlameIcon /></span>
              {streak.currentStreak}d
            </div>
          )}
          {streak.daysSinceStart > 0 && (
            <div className="ch-card-days">
              <span className="ch-inline-icon"><CalendarIcon /></span>
              {streak.daysSinceStart}d ago
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

function ChallengeCardSkeleton() {
  return (
    <div className="ch-card ch-card-skeleton" aria-hidden="true">
      <div className="ch-card-header">
        <div className="ios-skeleton ch-card-skeleton-tracker" />
        <div className="ch-card-title-group">
          <div className="ios-skeleton ch-card-skeleton-title" />
          <div className="ios-skeleton ch-card-skeleton-meta" />
          <div className="ios-skeleton ch-card-skeleton-meta short" />
        </div>
      </div>
      <div className="ios-skeleton ch-card-skeleton-bar" />
    </div>
  );
}

export default function ChallengesPanel({ onClose, showHeader = true, onScrollPositionChange }) {
  const { user, isLoggedIn } = useAuth();
  const { challenges, loading, refresh, create, getDetail, leave, remove } = useChallenges();
  const { isMobile } = useDeviceType();
  const { push } = useNavigation();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(null);

  const pullToRefresh = usePullToRefresh({
    onRefresh: refresh,
    disabled: !isLoggedIn,
  });

  const handleScrollableScroll = useCallback((event) => {
    onScrollPositionChange?.(event.currentTarget.scrollTop);
  }, [onScrollPositionChange]);

  const handleOpenDetail = useCallback(async (challenge) => {
    haptics.action();
    if (isMobile) {
      push('challenge', { challenge });
      return;
    }
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
  }, [isMobile, push, getDetail]);

  const handleOpenCreate = useCallback(() => {
    haptics.action();
    setShowCreate(true);
  }, []);

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

  useEffect(() => {
    onScrollPositionChange?.(0);
  }, [onScrollPositionChange, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="challenges-panel">
        {showHeader && (
          <div className="ch-header">
            <h2 className="ch-title">
              <span className="ch-title-icon"><TrophyIcon /></span>
              Challenges
            </h2>
            {onClose && <button className="ch-close ios-touch-feedback" onClick={onClose}>&times;</button>}
          </div>
        )}
        <div className="ch-empty-auth">
          <p>Sign in to create and join travel challenges with friends.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="challenges-panel">
      {showHeader ? (
        <div className="ch-header">
          <h2 className="ch-title">
            <span className="ch-title-icon"><TrophyIcon /></span>
            Challenges
          </h2>
          <div className="ch-header-actions">
            <button className="ch-create-btn ios-touch-feedback" onClick={handleOpenCreate}>
              <span className="ch-create-icon"><PlusIcon /></span>
              Create
            </button>
            {onClose && <button className="ch-close ios-touch-feedback" onClick={onClose}>&times;</button>}
          </div>
        </div>
      ) : (
        <div className="ch-inline-actions">
          <button className="ch-create-btn ios-touch-feedback" onClick={handleOpenCreate}>
            <span className="ch-create-icon"><PlusIcon /></span>
            Create Challenge
          </button>
        </div>
      )}

      <div className="ch-scrollable" {...pullToRefresh.bind} onScroll={handleScrollableScroll}>
        <div className={`ios-pull-indicator${pullToRefresh.pullDistance > 4 || pullToRefresh.isRefreshing ? ' visible' : ''}${pullToRefresh.isReady ? ' ready' : ''}${pullToRefresh.isRefreshing ? ' refreshing' : ''}`}>
          <PullArrowIcon />
          <span>{pullToRefresh.indicatorText}</span>
        </div>

        <div className="ch-scroll-content" style={pullToRefresh.contentStyle}>
          {loading && challenges.length === 0 && (
            <div className="ch-skeleton-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <ChallengeCardSkeleton key={index} />
              ))}
            </div>
          )}
          {!loading && challenges.length === 0 && (
            <div className="ch-empty-state">
              <span className="ch-empty-icon"><EmptyIcon /></span>
              <p className="ch-empty-text">No challenges yet</p>
              <p className="ch-empty-sub">Create a challenge and invite your friends to track progress together.</p>
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
