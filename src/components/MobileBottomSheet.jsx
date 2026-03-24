import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MobileBottomSheet — a draggable bottom-sheet container for mobile.
 *
 * Snap points are orientation-aware to avoid awkward half/full heights in
 * landscape where the viewport is short but wide.
 */

const SNAP_POINTS = {
  portrait: { peek: 20, half: 50, full: 92 },
  landscape: { peek: 28, half: 64, full: 86 },
};

const SPRING_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

function getOrientation() {
  if (typeof window === 'undefined') return 'portrait';
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

function getSnapPercents() {
  return SNAP_POINTS[getOrientation()];
}

function getSnapPercent(snapKey) {
  return getSnapPercents()[snapKey];
}

function getSnapHeightPx(snapKey) {
  return (getSnapPercent(snapKey) / 100) * window.innerHeight;
}

function clampHeightPx(heightPx) {
  return Math.max(0, Math.min(window.innerHeight, heightPx));
}

function getNearestSnapKey(heightPx) {
  const pct = (heightPx / window.innerHeight) * 100;
  const snapPercents = getSnapPercents();

  return Object.entries(snapPercents).reduce((bestKey, [key, value]) => {
    const bestDistance = Math.abs(snapPercents[bestKey] - pct);
    const distance = Math.abs(value - pct);
    return distance < bestDistance ? key : bestKey;
  }, 'peek');
}

export default function MobileBottomSheet({ children, peekContent, onSnapChange, expandTo }) {
  const [snapKey, setSnapKey] = useState('peek');
  const [, forceRerender] = useState(0);
  const sheetRef = useRef(null);
  const dragState = useRef(null);
  const touchHistory = useRef([]);
  const suppressTapRef = useRef(false);

  const applyHeight = useCallback((heightPx, withTransition) => {
    if (sheetRef.current) {
      sheetRef.current.style.height = `${heightPx}px`;
      sheetRef.current.style.transition = withTransition ? `height 0.45s ${SPRING_EASING}` : 'none';
    }
    document.documentElement.style.setProperty('--sheet-height', `${heightPx}px`);
  }, []);

  const animateTo = useCallback((targetKey) => {
    const heightPx = getSnapHeightPx(targetKey);
    setSnapKey(targetKey);
    onSnapChange?.(getSnapPercent(targetKey));
    applyHeight(heightPx, true);
  }, [applyHeight, onSnapChange]);

  const resolveExpandTarget = useCallback((targetPct) => {
    const snapPercents = getSnapPercents();
    return Object.entries(snapPercents).reduce((bestKey, [key, value]) => {
      const bestDistance = Math.abs(snapPercents[bestKey] - targetPct);
      const distance = Math.abs(value - targetPct);
      return distance < bestDistance ? key : bestKey;
    }, 'peek');
  }, []);

  useEffect(() => {
    applyHeight(getSnapHeightPx('peek'), false);
  }, [applyHeight]);

  useEffect(() => {
    if (expandTo != null) {
      animateTo(resolveExpandTarget(expandTo));
    }
  }, [animateTo, expandTo, resolveExpandTarget]);

  useEffect(() => {
    const handleResize = () => {
      applyHeight(getSnapHeightPx(snapKey), false);
      onSnapChange?.(getSnapPercent(snapKey));
      forceRerender((version) => version + 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [applyHeight, onSnapChange, snapKey]);

  const startDrag = useCallback((clientY) => {
    dragState.current = {
      startY: clientY,
      startSnapKey: snapKey,
      startHeightPx: getSnapHeightPx(snapKey),
    };
    suppressTapRef.current = false;
    touchHistory.current = [{ y: clientY, t: Date.now() }];
  }, [snapKey]);

  const onDrag = useCallback((clientY) => {
    if (!dragState.current) return;

    const delta = dragState.current.startY - clientY;
    if (Math.abs(delta) > 6) suppressTapRef.current = true;

    const heightPx = clampHeightPx(dragState.current.startHeightPx + delta);
    applyHeight(heightPx, false);

    const now = Date.now();
    touchHistory.current.push({ y: clientY, t: now });
    if (touchHistory.current.length > 3) touchHistory.current.shift();
  }, [applyHeight]);

  const finishDrag = useCallback((clientY) => {
    if (!dragState.current) return;

    const delta = dragState.current.startY - clientY;
    const heightPx = clampHeightPx(dragState.current.startHeightPx + delta);
    const order = Object.keys(getSnapPercents());
    let targetKey = getNearestSnapKey(heightPx);

    const history = touchHistory.current;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const dt = last.t - first.t;

      if (dt > 0) {
        const velocity = (first.y - last.y) / dt; // positive = swipe up
        if (Math.abs(velocity) > 0.3) {
          const idx = order.indexOf(targetKey);
          if (velocity > 0 && idx < order.length - 1) targetKey = order[idx + 1];
          if (velocity < 0 && idx > 0) targetKey = order[idx - 1];
        }
      }
    }

    animateTo(targetKey);
    dragState.current = null;
    touchHistory.current = [];
  }, [animateTo]);

  const cancelDrag = useCallback(() => {
    if (!dragState.current) return;
    animateTo(dragState.current.startSnapKey);
    dragState.current = null;
    touchHistory.current = [];
    suppressTapRef.current = true;
  }, [animateTo]);

  const handleTouchStart = useCallback((e) => {
    startDrag(e.touches[0].clientY);
  }, [startDrag]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    onDrag(e.touches[0].clientY);
  }, [onDrag]);

  const handleTouchEnd = useCallback((e) => {
    finishDrag(e.changedTouches[0].clientY);
  }, [finishDrag]);

  const handleTouchCancel = useCallback(() => {
    cancelDrag();
  }, [cancelDrag]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    startDrag(e.clientY);

    const onMove = (ev) => onDrag(ev.clientY);
    const onUp = (ev) => {
      finishDrag(ev.clientY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [finishDrag, onDrag, startDrag]);

  const handleTap = useCallback(() => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    animateTo(snapKey === 'peek' ? 'half' : 'peek');
  }, [animateTo, snapKey]);

  const isPeek = snapKey === 'peek';

  return (
    <div
      ref={sheetRef}
      className="mobile-bottom-sheet"
      data-snap={getSnapPercent(snapKey)}
      data-snap-key={snapKey}
      data-testid="mobile-bottom-sheet"
    >
      <div
        className="sheet-handle-area"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        data-testid="sheet-handle-area"
      >
        <div className="sheet-handle" />
        {peekContent && (
          <div className="sheet-peek-content" onClick={handleTap}>
            {peekContent}
          </div>
        )}
      </div>
      <div className="sheet-body" style={{ display: isPeek ? 'none' : 'flex' }}>
        {children}
      </div>
    </div>
  );
}
