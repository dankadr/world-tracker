import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchLeaderboard, fetchFriendVisited, fetchActivity } from '../utils/api';

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
  const cache = useRef({});

  const loadLeaderboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchLeaderboard(token);
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadActivity = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchActivity(token);
      setActivity(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
  }, [token]);

  const loadFriendVisited = useCallback(async (friendId) => {
    if (!token) return null;

    // Return cached if available (cache for 5 min)
    const cached = cache.current[friendId];
    if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
      return cached.data;
    }

    try {
      const data = await fetchFriendVisited(token, friendId);
      cache.current[friendId] = { data, time: Date.now() };
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
    cache.current = {};
    setFriendOverlayData({});
  }, []);

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
