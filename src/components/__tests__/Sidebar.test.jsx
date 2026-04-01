import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from '../Sidebar';

const { mockCountryList } = vi.hoisted(() => ({
  mockCountryList: [
    {
      id: 'ch',
      name: 'Switzerland',
      flag: '🇨🇭',
    },
    {
      id: 'us',
      name: 'United States',
      flag: '🇺🇸',
    },
  ],
}));

vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    dark: false,
    toggle: vi.fn(),
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'dan kadr', email: 'dan@example.com' },
  }),
}));

vi.mock('../../hooks/useAvatar', () => ({
  default: () => ({
    config: {},
    setPart: vi.fn(),
    resetAvatar: vi.fn(),
  }),
}));

vi.mock('../../data/countries', () => ({
  countryList: mockCountryList,
}));

vi.mock('../AuthButton', () => ({ default: () => <div>Auth</div> }));
vi.mock('../CitySearch', () => ({ default: () => <div>City Search</div> }));
vi.mock('../OverallProgress', () => ({ default: () => <div>Overall Progress</div> }));
vi.mock('../Achievements', () => ({ default: () => <div>Achievements</div> }));
vi.mock('../ShareButton', () => ({ default: () => <div>Share</div> }));
vi.mock('../StatsModal', () => ({ default: () => <div>Stats Modal</div> }));
vi.mock('../AvatarCanvas', () => ({ default: () => <div>Avatar</div> }));
vi.mock('../AvatarEditor', () => ({ default: () => <div>Avatar Editor</div> }));
vi.mock('../LevelBadge', () => ({ default: () => <div>Level</div> }));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));
vi.mock('../AddToBucketListModal', () => ({ default: () => null }));
vi.mock('../SettingsPanel', () => ({ default: () => <div>Settings Panel</div> }));
vi.mock('../SwipeableModal', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../AdminPanel', () => ({ default: () => <div>Admin Panel</div> }));

const country = {
  id: 'ch',
  name: 'Switzerland',
  flag: '🇨🇭',
  regionLabel: 'Cantons',
  visitedColor: '#c9a84c',
  visitedHover: '#b08c2a',
  data: {
    features: [
      { properties: { id: 'ag', name: 'Aargau' } },
      { properties: { id: 'be', name: 'Bern' } },
      { properties: { id: 'fr', name: 'Fribourg' } },
    ],
  },
};

describe('Sidebar mobile detail list focus', () => {
  it('collapses the mobile chrome when the regions list is scrolled and restores it on tap', async () => {
    const onListFocus = vi.fn();
    const { container } = render(
      <Sidebar
        country={country}
        visited={new Set(['ag'])}
        onToggle={vi.fn()}
        onReset={vi.fn()}
        onResetAll={vi.fn()}
        onCountryChange={vi.fn()}
        readOnly={false}
        dates={{}}
        onSetDate={vi.fn()}
        notes={{}}
        onSetNote={vi.fn()}
        customColor=""
        onSetColor={vi.fn()}
        collapsed={false}
        wishlist={new Set()}
        onToggleWishlist={vi.fn()}
        searchRef={{ current: null }}
        onBackToWorld={vi.fn()}
        onSearchFocus={vi.fn()}
        onOpenFriends={vi.fn()}
        friendsPendingCount={0}
        onOpenBucketList={vi.fn()}
        bucketListItems={[]}
        onAddToBucketList={vi.fn()}
        isMobile
        onShowOnboarding={vi.fn()}
        onListFocus={onListFocus}
      />
    );

    const sidebar = container.querySelector('.sidebar');
    const list = container.querySelector('.canton-list');
    list.scrollTo = vi.fn();

    Object.defineProperty(list, 'scrollTop', {
      value: 48,
      writable: true,
      configurable: true,
    });

    fireEvent.scroll(list);

    await waitFor(() => expect(sidebar).toHaveClass('mobile-chrome-collapsed'));
    expect(onListFocus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /show switzerland controls/i }));

    await waitFor(() => expect(sidebar).not.toHaveClass('mobile-chrome-collapsed'));
    expect(list.scrollTo).toHaveBeenCalledWith({ top: 0 });
  });
});
