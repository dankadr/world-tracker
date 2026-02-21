import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MobileBottomSheet — a draggable bottom-sheet container for mobile.
 *
 * Snap points (% of viewport height):
 *   collapsed  : shows only grab handle + mini stats  (  ~8vh )
 *   half       : shows list + tabs                    ( 50vh )
 *   full       : shows everything                     ( 92vh )
 */

const SNAP_COLLAPSED = 8;
const SNAP_HALF = 50;
const SNAP_FULL = 92;

export default function MobileBottomSheet({ children, miniContent }) {
  const [snap, setSnap] = useState(SNAP_COLLAPSED); // current snap height %
  const sheetRef = useRef(null);
  const dragState = useRef(null);

  const startDrag = useCallback((clientY) => {
    dragState.current = {
      startY: clientY,
      startSnap: snap,
      startH: (snap / 100) * window.innerHeight,
    };
  }, [snap]);

  const onDrag = useCallback((clientY) => {
    if (!dragState.current || !sheetRef.current) return;
    const delta = dragState.current.startY - clientY;
    const newH = Math.max(0, Math.min(window.innerHeight, dragState.current.startH + delta));
    const pct = (newH / window.innerHeight) * 100;
    sheetRef.current.style.height = `${pct}vh`;
    sheetRef.current.style.transition = 'none';
  }, []);

  const endDrag = useCallback((clientY) => {
    if (!dragState.current) return;
    const delta = dragState.current.startY - clientY;
    const newH = dragState.current.startH + delta;
    const pct = (newH / window.innerHeight) * 100;

    // Find nearest snap point
    const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
    let target = snaps[0];
    let minDist = Infinity;
    for (const s of snaps) {
      const d = Math.abs(pct - s);
      if (d < minDist) {
        minDist = d;
        target = s;
      }
    }

    // Velocity: if user swiped fast, go to next snap in direction
    const velocity = delta / (Date.now() - (dragState.current.ts || Date.now()) || 1);
    if (Math.abs(velocity) > 0.3) {
      const idx = snaps.indexOf(target);
      if (velocity > 0 && idx < snaps.length - 1) target = snaps[idx + 1];
      if (velocity < 0 && idx > 0) target = snaps[idx - 1];
    }

    setSnap(target);
    if (sheetRef.current) {
      sheetRef.current.style.height = `${target}vh`;
      sheetRef.current.style.transition = 'height 0.35s cubic-bezier(.4,0,.2,1)';
    }
    dragState.current = null;
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    startDrag(e.touches[0].clientY);
    dragState.current.ts = Date.now();
  }, [startDrag]);

  const handleTouchMove = useCallback((e) => {
    onDrag(e.touches[0].clientY);
  }, [onDrag]);

  const handleTouchEnd = useCallback((e) => {
    endDrag(e.changedTouches[0].clientY);
  }, [endDrag]);

  // Mouse handlers (for testing on desktop)
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    startDrag(e.clientY);
    dragState.current.ts = Date.now();

    const onMove = (ev) => onDrag(ev.clientY);
    const onUp = (ev) => {
      endDrag(ev.clientY);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [startDrag, onDrag, endDrag]);

  // Quick tap on handle toggles between collapsed/half
  const handleTap = useCallback(() => {
    setSnap((prev) => {
      const next = prev === SNAP_COLLAPSED ? SNAP_HALF : SNAP_COLLAPSED;
      if (sheetRef.current) {
        sheetRef.current.style.height = `${next}vh`;
        sheetRef.current.style.transition = 'height 0.35s cubic-bezier(.4,0,.2,1)';
      }
      return next;
    });
  }, []);

  // Set initial height
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.height = `${snap}vh`;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isCollapsed = snap === SNAP_COLLAPSED;

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
        {isCollapsed && miniContent && (
          <div className="sheet-mini-content" onClick={handleTap}>
            {miniContent}
          </div>
        )}
      </div>
      <div className="sheet-body" style={{ display: isCollapsed ? 'none' : 'flex' }}>
        {children}
      </div>
    </div>
  );
}
