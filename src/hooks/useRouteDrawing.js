import { useState, useCallback, useMemo } from 'react';
import { greatCircleDistance } from '../utils/geo';

function storageKey(userId) {
  return userId ? `n${userId}-route-points` : 'swiss-tracker-route-points';
}

function loadStoredPoints(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePoints(key, points) {
  try {
    localStorage.setItem(key, JSON.stringify(points));
  } catch { /* ignore */ }
}

export default function useRouteDrawing(userId = null) {
  const key = storageKey(userId);
  const [routeMode, setRouteMode] = useState(false);
  const [routePoints, setRoutePoints] = useState(() => loadStoredPoints(key));

  const toggleRouteMode = useCallback(() => {
    setRouteMode((prev) => !prev);
  }, []);

  const addPoint = useCallback((point) => {
    setRoutePoints((prev) => {
      const next = [...prev, point];
      savePoints(key, next);
      return next;
    });
  }, [key]);

  const clearRoute = useCallback(() => {
    setRoutePoints([]);
    savePoints(key, []);
  }, [key]);

  const totalDistanceKm = useMemo(() => {
    if (routePoints.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < routePoints.length; i++) {
      total += greatCircleDistance(
        routePoints[i - 1].lat, routePoints[i - 1].lng,
        routePoints[i].lat, routePoints[i].lng
      );
    }
    return Math.round(total);
  }, [routePoints]);

  return { routeMode, routePoints, toggleRouteMode, addPoint, clearRoute, totalDistanceKm };
}
