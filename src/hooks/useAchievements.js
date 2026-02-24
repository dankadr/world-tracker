// src/hooks/useAchievements.js
// Custom React hook to manage achievement progress logic on the frontend
// Moves progress calculation and XP logic from backend to client-side

import { useState, useEffect } from 'react';
import { getAchievements, getUserData } from '../utils/cache';

export default function useAchievements(userId) {
  const [achievements, setAchievements] = useState([]);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    // Try to load from cache first
    const cached = getAchievements(userId);
    if (cached) {
      setAchievements(cached.achievements);
      setXp(cached.xp);
      setLevel(cached.level);
      return;
    }
    // Fallback: fetch from API (pseudo-code)
    fetch(`/api/achievements?user=${userId}`)
      .then(res => res.json())
      .then(data => {
        setAchievements(data.achievements);
        setXp(data.xp);
        setLevel(data.level);
      });
  }, [userId]);

  // Example: compute progress locally
  function computeProgress() {
    let total = 0;
    let earned = 0;
    achievements.forEach(a => {
      total += a.goal;
      earned += a.progress;
    });
    return total ? Math.round((earned / total) * 100) : 0;
  }

  // Example: update XP and level locally
  function addXp(amount) {
    setXp(x => {
      const newXp = x + amount;
      const newLevel = Math.floor(newXp / 1000) + 1;
      setLevel(newLevel);
      return newXp;
    });
  }

  return { achievements, xp, level, computeProgress, addXp };
}
