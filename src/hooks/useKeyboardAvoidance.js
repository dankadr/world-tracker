import { useEffect } from 'react';

const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';

/**
 * useKeyboardAvoidance — pushes a container's bottom padding up when the
 * iOS virtual keyboard appears, so focused inputs stay visible.
 *
 * Uses the visualViewport API (iOS 13+). No-ops if not available (SSR, desktop).
 *
 * @param {React.RefObject} containerRef — the element to adjust paddingBottom on
 */
export default function useKeyboardAvoidance(containerRef) {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const viewport = window.visualViewport;

    function handleResize() {
      const el = containerRef.current;
      if (!el) return;
      const keyboardHeight = window.innerHeight - viewport.height;
      if (keyboardHeight > 100) {
        el.style.transition = `padding-bottom 0.3s ${SPRING}`;
        el.style.paddingBottom = `${keyboardHeight}px`;
      } else {
        el.style.transition = `padding-bottom 0.25s ${SPRING}`;
        el.style.paddingBottom = '';
      }
    }

    viewport.addEventListener('resize', handleResize);
    handleResize();
    return () => viewport.removeEventListener('resize', handleResize);
  }, [containerRef]);
}
