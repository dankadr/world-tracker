import { useEffect, useRef } from 'react';
import { haptics } from '../utils/haptics';

const TAB_ORDER = ['map', 'explore', 'social', 'profile'];
const MIN_DELTA_X = 60;
const HORIZONTAL_BIAS = 1.5; // deltaX must be > deltaY * 1.5
const SNAP_PEEK = 20; // MobileBottomSheet peek snap point

/**
 * useTabSwipe — horizontal swipe gesture to switch between bottom tabs.
 *
 * Attaches touchstart/touchend listeners to the window. Guards against:
 *   - Sheet not at peek (sheet drag takes priority)
 *   - Touches that start inside a horizontally-scrollable element
 *
 * @param {string}   activeTab   — current tab id
 * @param {Function} onTabChange — switchTab callback
 * @param {number}   sheetSnap   — current sheet snap value (20 = peek)
 */
export default function useTabSwipe(activeTab, onTabChange, sheetSnap) {
  const touchStart = useRef(null);

  useEffect(() => {
    function isInsideHorizontalScroll(el) {
      let node = el;
      while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth + 4) return true;
        node = node.parentElement;
      }
      return false;
    }

    function handleTouchStart(e) {
      // Ignore if sheet is expanded (sheet drag takes priority)
      if (sheetSnap !== SNAP_PEEK) return;
      // Ignore touches starting on horizontal scrollables (carousels, etc.)
      if (isInsideHorizontalScroll(e.target)) return;

      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(e) {
      if (!touchStart.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = Math.abs(touch.clientY - touchStart.current.y);
      touchStart.current = null;

      // Must exceed threshold and be mostly horizontal
      if (Math.abs(dx) < MIN_DELTA_X || Math.abs(dx) < dy * HORIZONTAL_BIAS) return;

      const idx = TAB_ORDER.indexOf(activeTab);
      if (idx === -1) return;

      if (dx < 0 && idx < TAB_ORDER.length - 1) {
        haptics.selection();
        onTabChange(TAB_ORDER[idx + 1]);
      } else if (dx > 0 && idx > 0) {
        haptics.selection();
        onTabChange(TAB_ORDER[idx - 1]);
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeTab, onTabChange, sheetSnap]);
}
