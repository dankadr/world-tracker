import { useCallback, useRef, useState } from 'react';

const DEFAULT_THRESHOLD = 68;
const DEFAULT_MAX_PULL = 104;

function getEffectiveScrollTop(target, boundary) {
  if (!target || !boundary) return 0;
  let node = typeof Element !== 'undefined' && target instanceof Element ? target : null;
  while (node && node !== boundary) {
    if (node.scrollHeight > node.clientHeight + 1) {
      return node.scrollTop;
    }
    node = node.parentElement;
  }
  return boundary.scrollTop;
}

/**
 * Lightweight pull-to-refresh for scroll containers.
 * Attaches touch handlers and triggers `onRefresh` when pulled past threshold.
 */
export default function usePullToRefresh(onRefresh, options = {}) {
  const {
    threshold = DEFAULT_THRESHOLD,
    maxPull = DEFAULT_MAX_PULL,
    enabled = true,
  } = options;

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const activeRef = useRef(false);
  const refreshingRef = useRef(false);

  const beginRefresh = useCallback(async () => {
    if (!onRefresh || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        refreshingRef.current = false;
        setIsRefreshing(false);
        setPullDistance(0);
      }, 220);
    }
  }, [onRefresh]);

  const onTouchStart = useCallback((e) => {
    if (!enabled || refreshingRef.current || e.touches.length !== 1) return;
    const target = e.currentTarget;
    if (!target || getEffectiveScrollTop(e.target, target) > 0) return;
    startYRef.current = e.touches[0].clientY;
    activeRef.current = true;
  }, [enabled]);

  const onTouchMove = useCallback((e) => {
    if (!enabled || !activeRef.current || startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - startYRef.current;
    if (dy <= 0) {
      setPullDistance(0);
      return;
    }
    const dampened = Math.min(maxPull, Math.round(dy * 0.45));
    setPullDistance(dampened);
  }, [enabled, maxPull]);

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;
    activeRef.current = false;
    startYRef.current = null;
    if (pullDistance >= threshold) {
      beginRefresh();
      return;
    }
    setPullDistance(0);
  }, [enabled, pullDistance, threshold, beginRefresh]);

  return {
    pullDistance,
    isRefreshing,
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}
