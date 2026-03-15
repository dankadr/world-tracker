import { useCallback, useMemo, useState } from 'react';
import useReducedMotion from './useReducedMotion';

export default function useTouchFeedback({ disabled = false, className = 'ios-touch-feedback' } = {}) {
  const prefersReducedMotion = useReducedMotion();
  const [isPressed, setIsPressed] = useState(false);

  const release = useCallback(() => setIsPressed(false), []);

  const pressHandlers = useMemo(() => {
    if (disabled) {
      return {};
    }

    return {
      onPointerDown: () => setIsPressed(true),
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
      onBlur: release,
    };
  }, [disabled, release]);

  const touchClassName = useMemo(() => {
    return [
      className,
      isPressed ? 'is-pressed' : '',
      prefersReducedMotion ? 'is-reduced-motion' : '',
    ].filter(Boolean).join(' ');
  }, [className, isPressed, prefersReducedMotion]);

  return { touchClassName, touchHandlers: pressHandlers };
}
