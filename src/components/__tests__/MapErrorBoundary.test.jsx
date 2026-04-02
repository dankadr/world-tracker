import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapErrorBoundary from '../MapErrorBoundary';

function ThrowingComponent() {
  throw new Error('map crash');
}

describe('MapErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <MapErrorBoundary>
        <div>map content</div>
      </MapErrorBoundary>
    );
    expect(screen.getByText('map content')).toBeTruthy();
  });

  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MapErrorBoundary>
        <ThrowingComponent />
      </MapErrorBoundary>
    );
    expect(screen.getByText('Failed to load map')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    spy.mockRestore();
  });

  it('re-mounts children after clicking "Try again"', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error('map crash');
      return <div>map recovered</div>;
    }

    render(
      <MapErrorBoundary>
        <MaybeThrow />
      </MapErrorBoundary>
    );

    expect(screen.getByText('Failed to load map')).toBeTruthy();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('map recovered')).toBeTruthy();
    spy.mockRestore();
  });
});
