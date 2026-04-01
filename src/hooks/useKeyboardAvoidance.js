import { useEffect } from 'react';
import useReducedMotion from './useReducedMotion';

const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OPEN_DURATION_MS = 300;
const CLOSE_DURATION_MS = 250;
const OPEN_TRANSITION = `padding-bottom ${OPEN_DURATION_MS / 1000}s ${SPRING}`;
const CLOSE_TRANSITION = `padding-bottom ${CLOSE_DURATION_MS / 1000}s ${SPRING}`;

function mergeTransitions(originalTransition, keyboardTransition) {
  return originalTransition ? `${originalTransition}, ${keyboardTransition}` : keyboardTransition;
}

/**
 * useKeyboardAvoidance — pushes a container's bottom padding up when the
 * iOS virtual keyboard appears, so focused inputs stay visible.
 *
 * Uses the visualViewport API (iOS 13+). No-ops if not available (SSR, desktop).
 *
 * @param {React.RefObject} containerRef — the element to adjust paddingBottom on
 */
export default function useKeyboardAvoidance(containerRef) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return undefined;

    const viewport = window.visualViewport;
    let trackedElement = null;
    let originalTransition = '';
    let originalPaddingBottom = '';
    let restoreTimerId;

    function clearRestoreTimer() {
      if (restoreTimerId) {
        window.clearTimeout(restoreTimerId);
        restoreTimerId = undefined;
      }
    }

    function captureOriginalStyles(el) {
      if (trackedElement === el) return;
      trackedElement = el;
      originalTransition = el.style.transition;
      originalPaddingBottom = el.style.paddingBottom;
    }

    function restoreOriginalStyles(el) {
      if (!el || trackedElement !== el) return;
      clearRestoreTimer();
      el.style.transition = originalTransition;
      el.style.paddingBottom = originalPaddingBottom;
    }

    function scheduleTransitionRestore(el, durationMs) {
      clearRestoreTimer();
      restoreTimerId = window.setTimeout(() => {
        if (trackedElement === el) {
          el.style.transition = originalTransition;
        }
      }, durationMs);
    }

    function handleResize() {
      const el = containerRef.current;
      if (!el) return;
      captureOriginalStyles(el);

      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);
      if (keyboardHeight > 100) {
        clearRestoreTimer();
        el.style.transition = prefersReducedMotion
          ? originalTransition
          : mergeTransitions(originalTransition, OPEN_TRANSITION);
        el.style.paddingBottom = `${keyboardHeight}px`;
        return;
      }

      if (el.style.paddingBottom === originalPaddingBottom) {
        el.style.transition = originalTransition;
        return;
      }

      if (prefersReducedMotion) {
        restoreOriginalStyles(el);
        return;
      }

      el.style.transition = mergeTransitions(originalTransition, CLOSE_TRANSITION);
      el.style.paddingBottom = originalPaddingBottom;
      scheduleTransitionRestore(el, CLOSE_DURATION_MS);
    }

    viewport.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      clearRestoreTimer();
      viewport.removeEventListener('resize', handleResize);
      restoreOriginalStyles(containerRef.current ?? trackedElement);
    };
  }, [containerRef, prefersReducedMotion]);
}
