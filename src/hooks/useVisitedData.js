// src/hooks/useVisitedData.js
// Custom React hook to manage visited regions logic on the frontend
// Moves region stats and overlays computation to client-side

import { useState, useEffect } from 'react';
import { getVisitedRegions, setVisitedRegions } from '../utils/cache';

export default function useVisitedData(userId) {
  const [visited, setVisited] = useState([]);

  useEffect(() => {
    // Try to load from cache first
    const cached = getVisitedRegions(userId);
    if (cached) {
      setVisited(cached);
      return;
    }
    // Fallback: fetch from API (pseudo-code)
    fetch(`/api/visited?user=${userId}`)
      .then(res => res.json())
      .then(data => {
        setVisited(data.regions);
        setVisitedRegions(userId, data.regions);
      });
  }, [userId]);

  // Example: mark region as visited locally
  function markVisited(regionId) {
    setVisited(prev => {
      const updated = [...new Set([...prev, regionId])];
      setVisitedRegions(userId, updated);
      return updated;
    });
  }

  // Example: compute stats locally
  function getVisitedCount() {
    return visited.length;
  }

  return { visited, markVisited, getVisitedCount };
}
