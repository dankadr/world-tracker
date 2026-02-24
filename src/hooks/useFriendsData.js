import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard, fetchFriendVisited, fetchActivity } from '../utils/api';
import { cacheGet, cacheSet, cacheInvalidate } from '../utils/cache';

const LEADERBOARD_TTL = 10 * 60 * 1000;
const ACTIVITY_TTL = 5 * 60 * 1000;
const FRIEND_VISITED_TTL = 10 * 60 * 1000;

function leaderboardKey(token) { return `leaderboard:${token.slice(-16)}`; }
function activityKey(token) { return `activity:${token.slice(-16)}`; }
function friendVisitedKey(token, friendId) { return `friend-visited:${token.slice(-16)}:${friendId}`; }

// Color palette for friend overlays on map
const FRIEND_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export function useFriendsData() {
  const { token } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [activity, setActivity] = useState([]);
  const [friendOverlayData, setFriendOverlayData] = useState({});
  const [loading, setLoading] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (!token) return;
    const cached = cacheGet(leaderboardKey(token), LEADERBOARD_TTL);
    if (cached) { setLeaderboard(cached); return; }
    setLoading(true);
    try {
      const data = await fetchLeaderboard(token);
      const list = Array.isArray(data) ? data : [];
      setLeaderboard(list);
      cacheSet(leaderboardKey(token), list);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActivity = useCallback(async () => {
    if (!token) return;
    const cached = cacheGet(activityKey(token), ACTIVITY_TTL);
    if (cached) { setActivity(cached); return; }
    try {
      const data = await fetchActivity(token);
      const list = Array.isArray(data) ? data : [];
      setActivity(list);
      cacheSet(activityKey(token), list);
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  }, [token]);

  const loadFriendVisited = useCallback(async (friendId) => {
    if (!token) return null;

    const cached = cacheGet(friendVisitedKey(token, friendId), FRIEND_VISITED_TTL);
    if (cached) return cached;

    try {
      const data = await fetchFriendVisited(token, friendId);
      if (data) cacheSet(friendVisitedKey(token, friendId), data);
      return data;
    } catch (err) {
      console.error('Failed to load friend visited:', err);
      return null;
    }
  }, [token]);

  // Load overlay data for multiple friends at once
  const loadOverlayData = useCallback(async (friendIds) => {
    if (!token || !friendIds.length) return;
    setLoading(true);

    const overlay = {};
    for (let i = 0; i < friendIds.length; i++) {
      const id = friendIds[i];
      const data = await loadFriendVisited(id);
      if (data) {
        overlay[id] = {
          ...data,
          color: FRIEND_COLORS[i % FRIEND_COLORS.length],
        };
      }
    }

    setFriendOverlayData(overlay);
    setLoading(false);
  }, [token, loadFriendVisited]);

  const clearCache = useCallback(() => {
    if (token) {
      cacheInvalidate(leaderboardKey(token));
      cacheInvalidate(activityKey(token));
      // Friend visited entries are TTL-scoped; clearing all would require prefix scan
      // They expire naturally in 10 min — acceptable
    }
    setFriendOverlayData({});
  }, [token]);

  return {
    leaderboard,
    activity,
    friendOverlayData,
    loading,
    loadLeaderboard,
    loadActivity,
    loadFriendVisited,
    loadOverlayData,
    clearCache,
    FRIEND_COLORS,
  };
}
