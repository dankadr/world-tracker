import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function ThrowingComponent() {
  throw new Error('test error');
}

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders fallback UI when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reload/i })).toBeTruthy();
    spy.mockRestore();
  });
});
