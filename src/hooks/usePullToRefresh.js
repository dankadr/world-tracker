import { useCallback, useMemo, useRef, useState } from 'react';
import useReducedMotion from './useReducedMotion';

const DEFAULT_THRESHOLD = 64;
const DEFAULT_MAX_PULL = 96;
const DAMPING = 0.45;

export default function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
} = {}) {
  const prefersReducedMotion = useReducedMotion();
  const startYRef = useRef(null);
  const pullActiveRef = useRef(false);
  const readyRef = useRef(false);
  const refreshingRef = useRef(false);

  const [pullDistance, setPullDistance] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    pullActiveRef.current = false;
    startYRef.current = null;
    readyRef.current = false;
    setIsReady(false);
    setIsDragging(false);
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback((event) => {
    if (disabled || refreshingRef.current || event.touches.length !== 1) {
      return;
    }

    const target = event.currentTarget;
    if (target.scrollTop > 0) {
      return;
    }

    pullActiveRef.current = true;
    setIsDragging(true);
    startYRef.current = event.touches[0].clientY;
  }, [disabled]);

  const handleTouchMove = useCallback((event) => {
    if (!pullActiveRef.current || disabled || refreshingRef.current || event.touches.length !== 1) {
      return;
    }

    const touchY = event.touches[0].clientY;
    const delta = touchY - (startYRef.current || touchY);
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    const nextDistance = Math.min(maxPull, delta * DAMPING);
    event.preventDefault();
    setPullDistance(nextDistance);

    const nextReady = nextDistance >= threshold;
    if (nextReady !== readyRef.current) {
      readyRef.current = nextReady;
      setIsReady(nextReady);
    }
  }, [disabled, maxPull, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullActiveRef.current) {
      return;
    }

    pullActiveRef.current = false;
    startYRef.current = null;
    setIsDragging(false);

    if (!readyRef.current || typeof onRefresh !== 'function' || disabled || refreshingRef.current) {
      readyRef.current = false;
      setIsReady(false);
      setPullDistance(0);
      return;
    }

    refreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(Math.min(maxPull * 0.6, threshold * 0.8));

    try {
      await onRefresh();
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      readyRef.current = false;
      setIsReady(false);
      setPullDistance(0);
    }
  }, [disabled, maxPull, onRefresh, threshold]);

  const contentStyle = useMemo(() => ({
    transform: `translate3d(0, ${pullDistance}px, 0)`,
    transition: isDragging
      ? 'none'
      : (prefersReducedMotion ? 'none' : 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)'),
    willChange: pullDistance > 0 ? 'transform' : 'auto',
  }), [isDragging, prefersReducedMotion, pullDistance]);

  return {
    pullDistance,
    isReady,
    isRefreshing,
    indicatorText: isRefreshing
      ? 'Refreshing…'
      : (isReady ? 'Release to refresh' : 'Pull to refresh'),
    bind: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    contentStyle,
    reset,
  };
}
