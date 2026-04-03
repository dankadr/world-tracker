import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from '../LandingPage';

// Mock useAuth — LandingPage only needs login() and loading
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({ login: vi.fn(), loading: false })),
}));

describe('LandingPage', () => {
  it('renders the main headline', () => {
    render(<LandingPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Your travels, beautifully mapped.'
    );
  });

  it('renders the five stat cards with correct labels', () => {
    render(<LandingPage />);
    expect(screen.getByText('countries')).toBeInTheDocument();
    expect(screen.getByText('Swiss cantons')).toBeInTheDocument();
    expect(screen.getByText('US states')).toBeInTheDocument();
    expect(screen.getByText("nat'l parks")).toBeInTheDocument();
    expect(screen.getByText('UNESCO sites')).toBeInTheDocument();
  });

  it('renders all six feature cards', () => {
    render(<LandingPage />);
    expect(screen.getByText('Interactive Map')).toBeInTheDocument();
    expect(screen.getByText('Friends & Challenges')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
    expect(screen.getByText('Bucket List')).toBeInTheDocument();
    expect(screen.getByText('Works Offline')).toBeInTheDocument();
    expect(screen.getByText('Private & Secure')).toBeInTheDocument();
  });

  it('renders the closing CTA headline', () => {
    render(<LandingPage />);
    expect(
      screen.getByRole('heading', { name: /start building your visited countries map/i })
    ).toBeInTheDocument();
  });

  it('calls onGuest when "Continue without account" is clicked', () => {
    const onGuest = vi.fn();
    render(<LandingPage onGuest={onGuest} />);
    fireEvent.click(screen.getByText('Continue without account'));
    expect(onGuest).toHaveBeenCalledOnce();
  });

  it('shows a loading state on the CTA button while login is in progress', async () => {
    const { useAuth } = await import('../../context/AuthContext');
    vi.mocked(useAuth).mockReturnValueOnce({ login: vi.fn(), loading: true });
    render(<LandingPage />);
    expect(screen.getAllByText('Signing in…').length).toBeGreaterThan(0);
  });
});
