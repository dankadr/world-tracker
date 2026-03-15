import { useEffect } from 'react';
import { useFriendsData } from '../hooks/useFriendsData';
import { useAuth } from '../context/AuthContext';
import './Leaderboard.css';
import './iosPrimitives.css';

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  return <span className={`lb-rank ${cls}`}>#{rank}</span>;
}

function Avatar({ user, size = 28 }) {
  if (user?.picture) {
    return (
      <img
        className="lb-avatar"
        src={user.picture}
        alt={user.name || ''}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="lb-avatar lb-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="lb-skeleton-list" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="lb-skeleton-row">
          <span className="ios-skeleton lb-skeleton-rank" />
          <span className="ios-skeleton lb-skeleton-avatar" />
          <span className="ios-skeleton lb-skeleton-name" />
          <span className="ios-skeleton lb-skeleton-bar" />
          <span className="ios-skeleton lb-skeleton-count" />
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard() {
  const { isLoggedIn } = useAuth();
  const { leaderboard, loading, loadLeaderboard } = useFriendsData();

  useEffect(() => {
    if (isLoggedIn) loadLeaderboard();
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxCount = leaderboard.length > 0
    ? Math.max(...leaderboard.map(e => e.world_countries || 0), 1)
    : 1;

  if (!isLoggedIn) return null;

  return (
    <div className="leaderboard">
      <h3 className="lb-title">🏆 Leaderboard</h3>

      {loading && leaderboard.length === 0 && (
        <LeaderboardSkeleton />
      )}

      {!loading && leaderboard.length === 0 && (
        <p className="lb-empty">Add friends to see the leaderboard!</p>
      )}

      <div className="lb-list">
        {leaderboard.map((entry, i) => {
          const count = entry.world_countries || 0;
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={entry.user_id || i} className={`lb-row ${entry.is_self ? 'is-self' : ''}`}>
              <RankBadge rank={i + 1} />
              <Avatar user={entry} />
              <span className="lb-name">{entry.is_self ? 'You' : entry.name}</span>
              <div className="lb-bar-wrap">
                <div className="lb-bar" style={{ width: `${pct}%` }} />
              </div>
              <span className="lb-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
