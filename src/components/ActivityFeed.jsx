import { useEffect } from 'react';
import { useFriendsData } from '../hooks/useFriendsData';
import { useAuth } from '../context/AuthContext';
import './ActivityFeed.css';

function relativeTime(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today - target;
  if (diff < 0) return 'Today';
  if (diff === 0) return 'Today';
  if (diff <= 86400000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function Avatar({ user, size = 28 }) {
  if (user?.picture) {
    return (
      <img
        className="af-avatar"
        src={user.picture}
        alt={user.name || ''}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="af-avatar af-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

function groupByDay(items) {
  const groups = [];
  let currentDay = null;
  let currentItems = [];

  for (const item of items) {
    const day = dayLabel(item.created_at || item.timestamp);
    if (day !== currentDay) {
      if (currentItems.length > 0) {
        groups.push({ day: currentDay, items: currentItems });
      }
      currentDay = day;
      currentItems = [item];
    } else {
      currentItems.push(item);
    }
  }
  if (currentItems.length > 0) {
    groups.push({ day: currentDay, items: currentItems });
  }
  return groups;
}

export default function ActivityFeed() {
  const { isLoggedIn } = useAuth();
  const { activity, loading, loadActivity } = useFriendsData();

  useEffect(() => {
    if (isLoggedIn) loadActivity();
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh on window focus
  useEffect(() => {
    if (!isLoggedIn) return;
    const handleFocus = () => loadActivity();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoggedIn, loadActivity]);

  if (!isLoggedIn) return null;

  const groups = groupByDay(activity.slice(0, 50));

  return (
    <div className="activity-feed">
      <h3 className="af-title">📋 Activity</h3>

      {loading && activity.length === 0 && (
        <p className="af-empty">Loading...</p>
      )}

      {!loading && activity.length === 0 && (
        <p className="af-empty">No activity yet. Add friends to see their updates!</p>
      )}

      {groups.map((group) => (
        <div key={group.day} className="af-day-group">
          <div className="af-day-label">{group.day}</div>
          {group.items.map((item, i) => (
            <div key={item.id || i} className="af-item">
              <Avatar user={item.user || item} />
              <div className="af-item-content">
                <div className="af-item-text">
                  <span className="af-item-name">{item.user?.name || item.name}</span>
                  {' '}
                  <span className="af-item-desc">{item.description || formatActivity(item)}</span>
                </div>
                <span className="af-item-time">{relativeTime(item.created_at || item.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatActivity(item) {
  if (item.activity_type === 'world') {
    return `visited ${item.count || ''} new countr${item.count === 1 ? 'y' : 'ies'}`;
  }
  if (item.activity_type === 'region' && item.country_name) {
    return `updated ${item.country_name}${item.count ? ` · ${item.count} regions` : ''}`;
  }
  return item.description || 'updated their map';
}
