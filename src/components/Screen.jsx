import { useEffect, useRef, useState } from 'react';
import { haptics } from '../utils/haptics';
import './Screen.css';

function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

/**
 * Screen — iOS-style push screen wrapper.
 *
 * Props:
 *   title       string    — nav bar title (compact nav bar)
 *   largeTitle  string    — when set, renders a 34px large title above content
 *                           that collapses into the nav bar on scroll
 *   onBack      () => void — called when back button or swipe-back triggers
 *   backLabel   string    — label next to back chevron (default "Back")
 *   children    ReactNode
 *   rightAction ReactNode  — optional right-side nav bar element
 */
export default function Screen({ title, largeTitle, onBack, backLabel = 'Back', children, rightAction }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const edgeRef = useRef(null);
  const largeTitleRef = useRef(null);
  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);

  // Slide in on mount
  useEffect(() => {
    // Tiny delay so the initial translateX(100%) renders before transition fires
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // IntersectionObserver: fade compact title in when large title leaves viewport
  useEffect(() => {
    if (!largeTitle || !largeTitleRef.current) return;
    const el = largeTitleRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderCompact(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [largeTitle]);

  // Left-edge swipe-back gesture
  useEffect(() => {
    const edge = edgeRef.current;
    if (!edge || !onBack) return;

    function onTouchStart(e) {
      const touch = e.touches[0];
      swipeStartX.current = touch.clientX;
      swipeStartY.current = touch.clientY;
    }

    function onTouchEnd(e) {
      if (swipeStartX.current === null) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - swipeStartX.current;
      const dy = Math.abs(touch.clientY - swipeStartY.current);
      swipeStartX.current = null;
      swipeStartY.current = null;
      // Swipe right ≥ 60px and mostly horizontal → go back
      if (dx >= 60 && dy < 60) {
        handleBack();
      }
    }

    edge.addEventListener('touchstart', onTouchStart, { passive: true });
    edge.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      edge.removeEventListener('touchstart', onTouchStart);
      edge.removeEventListener('touchend', onTouchEnd);
    };
  }, [onBack]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBack() {
    if (!onBack) return;
    haptics.selection();
    setExiting(true);
    setVisible(false);
    // Wait for exit animation then call onBack
    setTimeout(() => onBack(), 280);
  }

  return (
    <div className={`screen${visible ? ' screen-visible' : ''}${exiting ? ' screen-exiting' : ''}`}>
      <header className={`screen-header${largeTitle ? ' screen-header--large-title' : ''}${headerCompact ? ' header-compact' : ''}`}>
        {onBack && (
          <button className="screen-back-btn" onClick={handleBack} aria-label={`Back to ${backLabel}`}>
            <BackChevron />
            {backLabel}
          </button>
        )}
        <h1 className="screen-title">{title}</h1>
        {rightAction && <div className="screen-right-action">{rightAction}</div>}
      </header>

      <div className="screen-content">
        {largeTitle && (
          <h2 className="screen-large-title" ref={largeTitleRef}>{largeTitle}</h2>
        )}
        {children}
      </div>

      {/* Invisible left-edge swipe zone */}
      {onBack && <div className="screen-edge-swipe" ref={edgeRef} aria-hidden="true" />}
    </div>
  );
}
