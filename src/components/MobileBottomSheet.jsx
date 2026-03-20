import { useState, useRef, useCallback, useEffect } from 'react';
import useKeyboardAvoidance from '../hooks/useKeyboardAvoidance';

/**
 * MobileBottomSheet — a draggable bottom-sheet container for mobile.
 *
 * Snap points (% of viewport height):
 *   peek       : shows grab handle + header info + quick actions  ( 20dvh )
 *   half       : shows list + tabs                                ( 50dvh )
 *   full       : shows everything                                 ( 92dvh )
 */

const SNAP_PEEK = 20;
const SNAP_HALF = 50;
const SNAP_FULL = 92;

const SPRING_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

export default function MobileBottomSheet({ children, peekContent, onSnapChange, expandTo }) {
  const [snap, setSnap] = useState(SNAP_PEEK);
  const sheetRef = useRef(null);
  const sheetBodyRef = useRef(null);
  const dragState = useRef(null);

  useKeyboardAvoidance(sheetBodyRef);
  // Rolling window of last 3 touch positions for velocity calc
  const touchHistory = useRef([]);

  const animateTo = useCallback((target) => {
    setSnap(target);
    if (onSnapChange) onSnapChange(target);
    if (sheetRef.current) {
      sheetRef.current.style.height = `${target}dvh`;
      sheetRef.current.style.transition = `height 0.45s ${SPRING_EASING}`;
    }
    // Set CSS custom property for map controls positioning
    document.documentElement.style.setProperty('--sheet-height', `${target}dvh`);
  }, [onSnapChange]);

  // Allow parent to programmatically expand (e.g. search focus -> half)
  useEffect(() => {
    if (expandTo && expandTo !== snap) {
      animateTo(expandTo);
    }
  }, [expandTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = useCallback((clientY) => {
    dragState.current = {
      startY: clientY,
      startSnap: snap,
      startH: (snap / 100) * window.innerHeight,
    };
    touchHistory.current = [{ y: clientY, t: Date.now() }];
  }, [snap]);

  const onDrag = useCallback((clientY) => {
    if (!dragState.current || !sheetRef.current) return;
    const delta = dragState.current.startY - clientY;
    const newH = Math.max(0, Math.min(window.innerHeight, dragState.current.startH + delta));
    const pct = (newH / window.innerHeight) * 100;
    sheetRef.current.style.height = `${pct}dvh`;
    sheetRef.current.style.transition = 'none';

    // Keep rolling window of last 3 positions
    const now = Date.now();
    touchHistory.current.push({ y: clientY, t: now });
    if (touchHistory.current.length > 3) {
      touchHistory.current.shift();
    }
  }, []);

  const endDrag = useCallback((clientY) => {
    if (!dragState.current) return;
    const delta = dragState.current.startY - clientY;
    const newH = dragState.current.startH + delta;
    const pct = (newH / window.innerHeight) * 100;

    // Find nearest snap point
    const snaps = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];
    let target = snaps[0];
    let minDist = Infinity;
    for (const s of snaps) {
      const d = Math.abs(pct - s);
      if (d < minDist) {
        minDist = d;
        target = s;
      }
    }

    // Velocity from rolling window (last 3 points)
    const history = touchHistory.current;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) {
        const velocity = (first.y - last.y) / dt; // positive = swipe up
        if (Math.abs(velocity) > 0.3) {
          const idx = snaps.indexOf(target);
          if (velocity > 0 && idx < snaps.length - 1) target = snaps[idx + 1];
          if (velocity < 0 && idx > 0) target = snaps[idx - 1];
        }
      }
    }

    animateTo(target);
    dragState.current = null;
    touchHistory.current = [];
  }, [animateTo]);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    startDrag(e.touches[0].clientY);
  }, [startDrag]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    onDrag(e.touches[0].clientY);
  }, [onDrag]);

  const handleTouchEnd = useCallback((e) => {
    endDrag(e.changedTouches[0].clientY);
  }, [endDrag]);

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    startDrag(e.clientY);

    const onMove = (ev) => onDrag(ev.clientY);
    const onUp = (ev) => {
      endDrag(ev.clientY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [startDrag, onDrag, endDrag]);

  // Quick tap on handle area cycles: peek -> half -> peek
  const handleTap = useCallback(() => {
    const next = snap === SNAP_PEEK ? SNAP_HALF : SNAP_PEEK;
    animateTo(next);
  }, [snap, animateTo]);

  // Set initial height
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.height = `${SNAP_PEEK}dvh`;
    }
    document.documentElement.style.setProperty('--sheet-height', `${SNAP_PEEK}dvh`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isPeek = snap === SNAP_PEEK;

  return (
    <div ref={sheetRef} className="mobile-bottom-sheet" data-snap={snap}>
      <div
        className="sheet-handle-area"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="sheet-handle" />
        {peekContent && (
          <div className="sheet-peek-content" onClick={handleTap}>
            {peekContent}
          </div>
        )}
      </div>
      <div className="sheet-body" ref={sheetBodyRef} style={{ display: isPeek ? 'none' : 'flex' }}>
        {children}
      </div>
    </div>
  );
}
