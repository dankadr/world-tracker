import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import useKeyboardAvoidance from '../useKeyboardAvoidance';

const ORIGINAL_INNER_HEIGHT = window.innerHeight;
const ORIGINAL_MATCH_MEDIA = window.matchMedia;
const ORIGINAL_VISUAL_VIEWPORT = window.visualViewport;

function createMockVisualViewport(initialHeight) {
  let height = initialHeight;
  const listeners = new Set();

  return {
    get height() {
      return height;
    },
    set height(value) {
      height = value;
    },
    addEventListener: vi.fn((event, listener) => {
      if (event === 'resize') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((event, listener) => {
      if (event === 'resize') {
        listeners.delete(listener);
      }
    }),
    dispatchResize() {
      listeners.forEach((listener) => listener());
    },
  };
}

function KeyboardAvoidanceHarness({ style }) {
  const ref = useRef(null);
  useKeyboardAvoidance(ref);

  return <div data-testid="keyboard-target" ref={ref} style={style}>Keyboard target</div>;
}

describe('useKeyboardAvoidance', () => {
  let prefersReducedMotion;
  let visualViewport;

  beforeEach(() => {
    prefersReducedMotion = false;
    visualViewport = createMockVisualViewport(800);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 800,
    });

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: visualViewport,
    });

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: ORIGINAL_INNER_HEIGHT,
    });

    if (ORIGINAL_VISUAL_VIEWPORT === undefined) {
      delete window.visualViewport;
    } else {
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        writable: true,
        value: ORIGINAL_VISUAL_VIEWPORT,
      });
    }

    window.matchMedia = ORIGINAL_MATCH_MEDIA;
  });

  function openKeyboard(nextViewportHeight) {
    visualViewport.height = nextViewportHeight;
    act(() => {
      visualViewport.dispatchResize();
    });
  }

  it('animates keyboard padding and restores original inline styles after close', () => {
    vi.useFakeTimers();

    render(
      <KeyboardAvoidanceHarness style={{ paddingBottom: '12px', transition: 'opacity 150ms ease' }} />
    );

    const target = screen.getByTestId('keyboard-target');

    expect(target.style.paddingBottom).toBe('12px');
    expect(target.style.transition).toBe('opacity 150ms ease');

    openKeyboard(520);

    expect(target.style.paddingBottom).toBe('280px');
    expect(target.style.transition).toContain('opacity 150ms ease');
    expect(target.style.transition).toContain('padding-bottom 0.3s');

    openKeyboard(800);

    expect(target.style.paddingBottom).toBe('12px');
    expect(target.style.transition).toContain('padding-bottom 0.25s');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(target.style.transition).toBe('opacity 150ms ease');
  });

  it('restores original inline styles on cleanup while the keyboard is open', () => {
    const { unmount } = render(
      <KeyboardAvoidanceHarness style={{ paddingBottom: '12px', transition: 'opacity 150ms ease' }} />
    );

    const target = screen.getByTestId('keyboard-target');

    openKeyboard(520);

    expect(target.style.paddingBottom).toBe('280px');
    expect(target.style.transition).toContain('padding-bottom 0.3s');

    unmount();

    expect(target.style.paddingBottom).toBe('12px');
    expect(target.style.transition).toBe('opacity 150ms ease');
  });

  it('skips keyboard padding animation when reduced motion is enabled', () => {
    prefersReducedMotion = true;

    render(
      <KeyboardAvoidanceHarness style={{ paddingBottom: '12px', transition: 'opacity 150ms ease' }} />
    );

    const target = screen.getByTestId('keyboard-target');

    openKeyboard(520);

    expect(target.style.paddingBottom).toBe('280px');
    expect(target.style.transition).toBe('opacity 150ms ease');

    openKeyboard(800);

    expect(target.style.paddingBottom).toBe('12px');
    expect(target.style.transition).toBe('opacity 150ms ease');
  });
});
