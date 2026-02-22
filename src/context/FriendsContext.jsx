import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchFriends,
  fetchFriendRequests,
  sendFriendRequest as apiSendRequest,
  acceptFriendRequest as apiAcceptRequest,
  declineFriendRequest as apiDeclineRequest,
  cancelFriendRequest as apiCancelRequest,
  removeFriend as apiRemoveFriend,
  fetchMe,
} from '../utils/api';

const FriendsContext = createContext(null);

export function FriendsProvider({ children }) {
  const { token, isLoggedIn } = useAuth();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const pendingCount = requests.incoming.length;

  // Load profile
  const loadProfile = useCallback(async () => {
    if (!token) return;
    try {
      const profile = await fetchMe(token);
      setMyProfile(profile);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, [token]);

  // Load friends list
  const loadFriends = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchFriends(token);
      setFriends(data);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  }, [token]);

  // Load pending requests
  const loadRequests = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchFriendRequests(token);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  }, [token]);

  // Refresh all friends data
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadFriends(), loadRequests(), loadProfile()]);
    setLoading(false);
  }, [loadFriends, loadRequests, loadProfile]);

  // Actions
  const sendRequest = useCallback(async (friendCode) => {
    const result = await apiSendRequest(token, friendCode);
    await loadRequests();
    return result;
  }, [token, loadRequests]);

  const acceptRequest = useCallback(async (requestId) => {
    const result = await apiAcceptRequest(token, requestId);
    await Promise.all([loadFriends(), loadRequests()]);
    return result;
  }, [token, loadFriends, loadRequests]);

  const declineRequest = useCallback(async (requestId) => {
    const result = await apiDeclineRequest(token, requestId);
    await loadRequests();
    return result;
  }, [token, loadRequests]);

  const cancelRequest = useCallback(async (requestId) => {
    const result = await apiCancelRequest(token, requestId);
    await loadRequests();
    return result;
  }, [token, loadRequests]);

  const removeFriendAction = useCallback(async (friendId) => {
    const result = await apiRemoveFriend(token, friendId);
    await loadFriends();
    return result;
  }, [token, loadFriends]);

  // Initial load & polling
  useEffect(() => {
    if (!isLoggedIn) {
      setFriends([]);
      setRequests({ incoming: [], outgoing: [] });
      setMyProfile(null);
      return;
    }

    refresh();

    // Poll for new requests every 60s
    pollRef.current = setInterval(() => {
      loadRequests();
    }, 60_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn, refresh, loadRequests]);

  return (
    <FriendsContext.Provider value={{
      friends,
      requests,
      myProfile,
      pendingCount,
      loading,
      refresh,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      removeFriend: removeFriendAction,
    }}>
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used within FriendsProvider');
  return ctx;
}
