import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import WorldSidebar from '../WorldSidebar';

vi.mock('../AuthButton', () => ({ default: () => <div>Auth</div> }));
vi.mock('../AvatarCanvas', () => ({ default: () => <div>Avatar</div> }));
vi.mock('../AvatarEditor', () => ({ default: () => <div>Avatar Editor</div> }));
vi.mock('../Achievements', () => ({ default: () => <div>Achievements</div> }));
vi.mock('../StatsModal', () => ({ default: () => <div>Stats Modal</div> }));
vi.mock('../UnescoPanel', () => ({ default: () => <div>UNESCO</div> }));
vi.mock('../AdminPanel', () => ({ default: () => <div>Admin Panel</div> }));
vi.mock('../SwipeableModal', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../SettingsPanel', () => ({
  default: ({ onResetAll, onShowOnboarding }) => (
    <div>
      <div>Settings Panel</div>
      {onShowOnboarding && <button onClick={onShowOnboarding}>Show Onboarding</button>}
      {onResetAll && <button onClick={onResetAll}>Reset Everything</button>}
    </div>
  ),
}));
vi.mock('../ConfirmDialog', () => ({
  default: ({ isOpen, onConfirm }) => (
    isOpen ? <button onClick={onConfirm}>Confirm Reset</button> : null
  ),
}));
vi.mock('../../hooks/useAvatar', () => ({
  default: () => ({
    config: {},
    setPart: vi.fn(),
    resetAvatar: vi.fn(),
  }),
}));
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    dark: false,
    toggle: vi.fn(),
  }),
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
  }),
}));
vi.mock('../../utils/easterEggs', () => ({
  isGreaterIsraelEnabled: () => false,
  toggleGreaterIsrael: vi.fn(),
}));

describe('WorldSidebar', () => {
  it('shows a desktop header settings button and opens the settings panel', async () => {
    const user = userEvent.setup();

    render(
      <WorldSidebar
        visited={new Set()}
        onToggle={vi.fn()}
        onExploreCountry={vi.fn()}
        collapsed={false}
        onOpenFriends={vi.fn()}
        friendsPendingCount={0}
        isMobile={false}
        onResetAll={vi.fn()}
        onShowOnboarding={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /open settings/i }));

    expect(screen.getByText('Settings Panel')).toBeInTheDocument();
  });

  it('routes reset everything through confirmation before calling the handler', async () => {
    const user = userEvent.setup();
    const onResetAll = vi.fn();

    render(
      <WorldSidebar
        visited={new Set()}
        onToggle={vi.fn()}
        onExploreCountry={vi.fn()}
        collapsed={false}
        onOpenFriends={vi.fn()}
        friendsPendingCount={0}
        isMobile={false}
        onResetAll={onResetAll}
        onShowOnboarding={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('button', { name: /reset everything/i }));
    await user.click(screen.getByRole('button', { name: /confirm reset/i }));

    expect(onResetAll).toHaveBeenCalledTimes(1);
  });
});
