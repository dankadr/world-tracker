import { useState, useCallback, useEffect } from 'react';
import FriendsPanel from './FriendsPanel';
import ChallengesPanel from './ChallengesPanel';
import useTouchFeedback from '../hooks/useTouchFeedback';
import { haptics } from '../utils/haptics';
import './SocialScreen.css';
import './iosPrimitives.css';

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

function FriendsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" />
      <path d="M2.5 20v-1a4.5 4.5 0 0 1 9 0v1" />
      <circle cx="16.5" cy="7.5" r="2.5" />
      <path d="M14 20v-.8a3.8 3.8 0 0 1 5.5-3.4" />
    </svg>
  );
}

function ChallengesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 7H5a2 2 0 0 0 0 4h2" />
      <path d="M17 7h2a2 2 0 0 1 0 4h-2" />
    </svg>
  );
}

export default function SocialScreen({ onCompare, comparisonFriendId }) {
  const [tab, setTab] = useState('friends');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  const friendsTouch = useTouchFeedback();
  const challengesTouch = useTouchFeedback();

  const handleTabChange = useCallback((nextTab) => {
    haptics.selection();
    setTab(nextTab);
    setHeaderCollapsed(false);
  }, []);

  // Scroll-to-top when the already-active Social tab is re-tapped
  useEffect(() => {
    const handler = (e) => {
      if (e.detail !== 'social') return;
      const sel = tab === 'friends' ? '.fp-scrollable' : '.ch-scrollable';
      document.querySelector(sel)?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('tab-reselect', handler);
    return () => window.removeEventListener('tab-reselect', handler);
  }, [tab]);

  const handleScrollPositionChange = useCallback((scrollTop) => {
    setHeaderCollapsed(scrollTop > 22);
  }, []);

  return (
    <div className="tab-screen social-screen">
      <header className={`social-large-header${headerCollapsed ? ' is-collapsed' : ''}`}>
        <div className="social-large-title-row">
          <span className="social-large-icon" aria-hidden="true">
            <SocialIcon />
          </span>
          <h1 className="social-large-title">Social</h1>
        </div>
        <p className="social-large-subtitle">
          Connect with friends and stay on top of shared challenges.
        </p>
      </header>

      <div className="social-seg-header">
        <div className="social-seg-control" role="tablist" aria-label="Social navigation">
          <button
            role="tab"
            aria-selected={tab === 'friends'}
            className={`social-seg-btn ${friendsTouch.touchClassName}${tab === 'friends' ? ' active' : ''}`}
            onClick={() => handleTabChange('friends')}
            {...friendsTouch.touchHandlers}
          >
            <span className="social-seg-btn-icon"><FriendsIcon /></span>
            Friends
          </button>
          <button
            role="tab"
            aria-selected={tab === 'challenges'}
            className={`social-seg-btn ${challengesTouch.touchClassName}${tab === 'challenges' ? ' active' : ''}`}
            onClick={() => handleTabChange('challenges')}
            {...challengesTouch.touchHandlers}
          >
            <span className="social-seg-btn-icon"><ChallengesIcon /></span>
            Challenges
          </button>
        </div>
      </div>

      {/* Both panels stay mounted so state (open modals, form input) is preserved */}
      <div className="social-tab-pane" style={tab !== 'friends' ? { display: 'none' } : undefined}>
        <FriendsPanel
          onCompare={onCompare}
          comparisonFriendId={comparisonFriendId}
          showTabNavigation={false}
          showHeader={false}
          onScrollPositionChange={handleScrollPositionChange}
        />
      </div>
      <div className="social-tab-pane" style={tab !== 'challenges' ? { display: 'none' } : undefined}>
        <ChallengesPanel
          showHeader={false}
          onScrollPositionChange={handleScrollPositionChange}
        />
      </div>
    </div>
  );
}
