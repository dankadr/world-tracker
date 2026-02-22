import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchChallenges as apiFetchChallenges,
  createChallenge as apiCreateChallenge,
  fetchChallengeDetail as apiFetchDetail,
  joinChallenge as apiJoin,
  leaveChallenge as apiLeave,
  deleteChallenge as apiDelete,
} from '../utils/api';

export default function useChallenges() {
  const { token, isLoggedIn } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const loadChallenges = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetchChallenges(token);
      setChallenges(data);
    } catch (err) {
      console.error('Failed to load challenges:', err);
    }
  }, [token]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadChallenges();
    setLoading(false);
  }, [loadChallenges]);

  const create = useCallback(async (data) => {
    const result = await apiCreateChallenge(token, data);
    await loadChallenges();
    return result;
  }, [token, loadChallenges]);

  const getDetail = useCallback(async (challengeId) => {
    return apiFetchDetail(token, challengeId);
  }, [token]);

  const join = useCallback(async (challengeId) => {
    const result = await apiJoin(token, challengeId);
    await loadChallenges();
    return result;
  }, [token, loadChallenges]);

  const leave = useCallback(async (challengeId) => {
    const result = await apiLeave(token, challengeId);
    await loadChallenges();
    return result;
  }, [token, loadChallenges]);

  const remove = useCallback(async (challengeId) => {
    const result = await apiDelete(token, challengeId);
    await loadChallenges();
    return result;
  }, [token, loadChallenges]);

  useEffect(() => {
    if (!isLoggedIn) {
      setChallenges([]);
      return;
    }
    refresh();

    // Poll every 2 minutes
    pollRef.current = setInterval(loadChallenges, 120_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    challenges,
    loading,
    refresh,
    create,
    getDetail,
    join,
    leave,
    remove,
  };
}
