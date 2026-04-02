import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EmailPreferences from '../EmailPreferences';

const authState = {
  isLoggedIn: true,
  token: 'jwt-token',
  user: { email: 'traveler@example.com' },
};

const fetchEmailPreferences = vi.fn();
const updateEmailPreferences = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('../../utils/api', () => ({
  fetchEmailPreferences: (...args) => fetchEmailPreferences(...args),
  updateEmailPreferences: (...args) => updateEmailPreferences(...args),
}));

describe('EmailPreferences', () => {
  beforeEach(() => {
    fetchEmailPreferences.mockReset();
    updateEmailPreferences.mockReset();
    authState.isLoggedIn = true;
    authState.token = 'jwt-token';
    authState.user = { email: 'traveler@example.com' };
  });

  it('shows a sign-in prompt when the user is logged out', () => {
    authState.isLoggedIn = false;
    authState.token = null;

    render(<EmailPreferences />);

    expect(screen.getByText(/sign in to manage emails/i)).toBeInTheDocument();
  });

  it('loads preferences and updates a toggle optimistically', async () => {
    const user = userEvent.setup();
    fetchEmailPreferences.mockResolvedValue({
      weekly_digest: true,
      monthly_recap: false,
      friend_notifications: true,
      challenge_notifications: true,
      bucket_list_reminders: true,
      milestone_celebrations: false,
      marketing: false,
    });
    updateEmailPreferences.mockResolvedValue({
      weekly_digest: false,
      monthly_recap: false,
      friend_notifications: true,
      challenge_notifications: true,
      bucket_list_reminders: true,
      milestone_celebrations: false,
      marketing: false,
    });

    render(<EmailPreferences />);

    await waitFor(() => {
      expect(fetchEmailPreferences).toHaveBeenCalledWith('jwt-token');
    });

    const weeklyDigestToggle = await screen.findByTestId('email-toggle-weekly_digest');
    expect(weeklyDigestToggle).toHaveClass('on');

    await user.click(weeklyDigestToggle);

    await waitFor(() => {
      expect(updateEmailPreferences).toHaveBeenCalledWith('jwt-token', { weekly_digest: false });
    });
    expect(weeklyDigestToggle).not.toHaveClass('on');
  });
});
