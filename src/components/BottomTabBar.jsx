import './BottomTabBar.css';
import './iosPrimitives.css';
import useTouchFeedback from '../hooks/useTouchFeedback';
import { haptics } from '../utils/haptics';

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

// BASE_TABS is module-level (outside the component) so it is stable across renders.
const BASE_TABS = [
  { id: 'map', label: 'Map', Icon: MapIcon },
  { id: 'explore', label: 'Explore', Icon: ExploreIcon },
  { id: 'social', label: 'Social', Icon: SocialIcon },
  { id: 'profile', label: 'Profile', Icon: ProfileIcon },
];

export default function BottomTabBar({ activeTab, onTabChange, socialBadge = 0, isAdmin = false }) {
  const tabs = isAdmin
    ? [...BASE_TABS, { id: 'admin', label: 'Admin', Icon: WrenchIcon }]
    : BASE_TABS;

  return (
    <nav className="bottom-tab-bar" role="tablist" aria-label="Main navigation">
      {tabs.map(({ id, label, Icon }) => (
        <TabBarButton
          key={id}
          id={id}
          label={label}
          Icon={Icon}
          active={activeTab === id}
          socialBadge={socialBadge}
          onTabChange={onTabChange}
        />
      ))}
    </nav>
  );
}

function TabBarButton({ id, label, Icon, active, socialBadge, onTabChange }) {
  const { touchClassName, touchHandlers } = useTouchFeedback();

  return (
    <button
      role="tab"
      aria-selected={active}
      aria-label={label}
      className={`tab-bar-item ${touchClassName}${active ? ' active' : ''}`}
      onClick={() => {
        haptics.selection();
        if (active) {
          // Re-tapping the active tab: scroll to top
          window.dispatchEvent(new CustomEvent('tab-reselect', { detail: id }));
        }
        onTabChange(id);
      }}
      {...touchHandlers}
    >
      <span className="tab-bar-icon">
        <Icon />
        {id === 'social' && socialBadge > 0 && (
          <span className="tab-bar-badge">{socialBadge > 9 ? '9+' : socialBadge}</span>
        )}
      </span>
      <span className="tab-bar-label">{label}</span>
    </button>
  );
}
