import { useState, useEffect, useCallback } from 'react';

/**
 * Device type detection hook.
 *
 * Breakpoints:
 *   mobile  : width ≤ 768px
 *   tablet  : 769px – 1024px
 *   desktop : > 1024px
 *
 * Also detects touch capability and orientation.
 */

const MOBILE_QUERY = '(max-width: 768px)';
const TABLET_QUERY = '(min-width: 769px) and (max-width: 1024px)';
const TOUCH_QUERY = '(pointer: coarse)';
const PORTRAIT_QUERY = '(orientation: portrait)';

function getDeviceType(isMobile, isTablet) {
  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

export default function useDeviceType() {
  const [state, setState] = useState(() => {
    if (typeof window === 'undefined') {
      return { device: 'desktop', isMobile: false, isTablet: false, isDesktop: true, isTouch: false, isPortrait: false };
    }
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const tablet = window.matchMedia(TABLET_QUERY).matches;
    const touch = window.matchMedia(TOUCH_QUERY).matches;
    const portrait = window.matchMedia(PORTRAIT_QUERY).matches;
    return {
      device: getDeviceType(mobile, tablet),
      isMobile: mobile,
      isTablet: tablet,
      isDesktop: !mobile && !tablet,
      isTouch: touch,
      isPortrait: portrait,
    };
  });

  const update = useCallback(() => {
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const tablet = window.matchMedia(TABLET_QUERY).matches;
    const touch = window.matchMedia(TOUCH_QUERY).matches;
    const portrait = window.matchMedia(PORTRAIT_QUERY).matches;
    setState({
      device: getDeviceType(mobile, tablet),
      isMobile: mobile,
      isTablet: tablet,
      isDesktop: !mobile && !tablet,
      isTouch: touch,
      isPortrait: portrait,
    });
  }, []);

  useEffect(() => {
    const mqlMobile = window.matchMedia(MOBILE_QUERY);
    const mqlTablet = window.matchMedia(TABLET_QUERY);
    const mqlTouch = window.matchMedia(TOUCH_QUERY);
    const mqlPortrait = window.matchMedia(PORTRAIT_QUERY);

    const queries = [mqlMobile, mqlTablet, mqlTouch, mqlPortrait];
    queries.forEach((mql) => mql.addEventListener('change', update));
    return () => queries.forEach((mql) => mql.removeEventListener('change', update));
  }, [update]);

  return state;
}
