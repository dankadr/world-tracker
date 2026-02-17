import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { defaultAvatar } from '../config/avatarParts';

function storageKey(userId) {
  return userId ? `swiss-tracker-u${userId}-avatar` : 'swiss-tracker-avatar';
}

function loadAvatar(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const data = JSON.parse(raw);
      return { ...defaultAvatar, ...data };
    }
  } catch { /* ignore */ }
  return { ...defaultAvatar };
}

function saveAvatar(userId, config) {
  localStorage.setItem(storageKey(userId), JSON.stringify(config));
}

export default function useAvatar() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [config, setConfig] = useState(() => loadAvatar(userId));
  const [currentUserId, setCurrentUserId] = useState(userId);

  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    setConfig(loadAvatar(userId));
  }

  const setPart = useCallback((category, value) => {
    setConfig((prev) => {
      const next = { ...prev, [category]: value };
      saveAvatar(userId, next);
      return next;
    });
  }, [userId]);

  const resetAvatar = useCallback(() => {
    const fresh = { ...defaultAvatar };
    saveAvatar(userId, fresh);
    setConfig(fresh);
  }, [userId]);

  return { config, setPart, resetAvatar };
}
