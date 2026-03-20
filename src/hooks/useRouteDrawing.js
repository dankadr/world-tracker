import { useState, useCallback, useMemo } from 'react';
import { greatCircleDistance } from '../utils/geo';

const STORAGE_KEY = 'swiss-tracker-route-points';

function loadStoredPoints() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePoints(points) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
  } catch { /* ignore */ }
}

export default function useRouteDrawing() {
  const [routeMode, setRouteMode] = useState(false);
  const [routePoints, setRoutePoints] = useState(() => loadStoredPoints());

  const toggleRouteMode = useCallback(() => {
    setRouteMode((prev) => !prev);
  }, []);

  const addPoint = useCallback((point) => {
    setRoutePoints((prev) => {
      const next = [...prev, point];
      savePoints(next);
      return next;
    });
  }, []);

  const clearRoute = useCallback(() => {
    setRoutePoints([]);
    savePoints([]);
  }, []);

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
