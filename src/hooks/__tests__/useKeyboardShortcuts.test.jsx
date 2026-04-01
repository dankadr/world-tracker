import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import useKeyboardShortcuts from '../useKeyboardShortcuts';

function TestHarness(props) {
  useKeyboardShortcuts(props);
  return <input aria-label="keyboard-target" />;
}

describe('useKeyboardShortcuts', () => {
  it('opens global search on Ctrl+K even while typing in an input', () => {
    const onOpenGlobalSearch = vi.fn();

    render(
      <TestHarness
        countryId="ch"
        setCountryId={vi.fn()}
        closeModals={vi.fn()}
        onOpenGlobalSearch={onOpenGlobalSearch}
      />
    );

    const input = document.querySelector('input');
    input.focus();

    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });

    expect(onOpenGlobalSearch).toHaveBeenCalledTimes(1);
  });
});
