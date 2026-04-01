import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Icon from '../Icon';

describe('Icon', () => {
  it('renders an image for a valid icon name', () => {
    render(<Icon name="ui/friends" alt="Friends icon" size={20} />);

    const img = screen.getByRole('img', { name: 'Friends icon' });
    expect(img.getAttribute('src')).toBe('/icons/ui/friends.svg');
    expect(img).toHaveAttribute('width', '20');
    expect(img).toHaveAttribute('height', '20');
  });

  it('falls back to an accessible emoji when loading fails and alt text is provided', () => {
    render(<Icon name="ui/unknown" alt="Fallback icon" fallback="🧭" />);

    fireEvent.error(screen.getByRole('img', { name: 'Fallback icon' }));

    expect(screen.getByRole('img', { name: 'Fallback icon' })).toHaveTextContent('🧭');
  });

  it('keeps fallback icons decorative when alt text is empty', () => {
    render(<Icon name="ui/missing" fallback="⭐" />);

    fireEvent.error(document.querySelector('img'));

    expect(screen.getByText('⭐')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('resets failed state when the icon name changes', () => {
    const { rerender } = render(<Icon name="ui/missing" alt="Old icon" fallback="⭐" />);

    fireEvent.error(screen.getByRole('img', { name: 'Old icon' }));
    expect(screen.getByText('⭐')).toBeInTheDocument();

    rerender(<Icon name="ui/friends" alt="Friends icon" fallback="⭐" />);

    const img = screen.getByRole('img', { name: 'Friends icon' });
    expect(img.getAttribute('src')).toBe('/icons/ui/friends.svg');
    expect(screen.queryByText('⭐')).not.toBeInTheDocument();
  });
});
