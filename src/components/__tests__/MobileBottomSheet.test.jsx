import { act, fireEvent, render, screen } from '@testing-library/react';
import MobileBottomSheet from '../MobileBottomSheet';

function setViewport(width, height) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height,
  });
}

function renderSheet(props = {}) {
  return render(
    <MobileBottomSheet peekContent={<span>Peek</span>} {...props}>
      <div>Sheet body</div>
    </MobileBottomSheet>
  );
}

describe('MobileBottomSheet', () => {
  beforeEach(() => {
    setViewport(390, 800);
    document.documentElement.style.removeProperty('--sheet-height');
  });

  it('uses portrait snap points and toggles from peek to half on tap', () => {
    renderSheet();

    const sheet = screen.getByTestId('mobile-bottom-sheet');

    expect(sheet.dataset.snapKey).toBe('peek');
    expect(parseFloat(sheet.style.height)).toBeCloseTo(160, 1);
    expect(document.documentElement.style.getPropertyValue('--sheet-height')).toBe('160px');

    fireEvent.click(screen.getByText('Peek'));

    expect(sheet.dataset.snapKey).toBe('half');
    expect(parseFloat(sheet.style.height)).toBeCloseTo(400, 1);
    expect(document.documentElement.style.getPropertyValue('--sheet-height')).toBe('400px');
  });

  it('recomputes snap height for landscape on resize', () => {
    const onSnapChange = vi.fn();
    renderSheet({ onSnapChange });

    const sheet = screen.getByTestId('mobile-bottom-sheet');
    fireEvent.click(screen.getByText('Peek'));

    setViewport(800, 390);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(sheet.dataset.snapKey).toBe('half');
    expect(sheet.dataset.snap).toBe('64');
    expect(parseFloat(sheet.style.height)).toBeCloseTo(249.6, 1);
    expect(onSnapChange).toHaveBeenLastCalledWith(64);
  });

  it('snaps back to the starting snap when a touch drag is cancelled', () => {
    renderSheet();

    const sheet = screen.getByTestId('mobile-bottom-sheet');
    const handle = screen.getByTestId('sheet-handle-area');

    fireEvent.touchStart(handle, {
      touches: [{ clientY: 700 }],
    });

    fireEvent.touchMove(handle, {
      touches: [{ clientY: 500 }],
    });

    expect(parseFloat(sheet.style.height)).toBeCloseTo(360, 1);

    fireEvent.touchCancel(handle);

    expect(sheet.dataset.snapKey).toBe('peek');
    expect(parseFloat(sheet.style.height)).toBeCloseTo(160, 1);
    expect(document.documentElement.style.getPropertyValue('--sheet-height')).toBe('160px');
  });
});
