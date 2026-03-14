import { useState } from 'react';
import FriendsPanel from './FriendsPanel';
import ChallengesPanel from './ChallengesPanel';
import { useFriends } from '../context/FriendsContext';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { withTouchFeedback } from '../utils/touchFeedback';
import './SocialScreen.css';

export default function SocialScreen({ onCompare, comparisonFriendId }) {
  const [tab, setTab] = useState('friends');
  const [compactHeader, setCompactHeader] = useState(false);
  const { refresh } = useFriends();
  const { pullDistance, isRefreshing, bind } = usePullToRefresh(async () => {
    await refresh();
  });

  return (
    <div className="tab-screen social-screen">
      <div className={`social-large-header${compactHeader ? ' compact' : ''}`}>
        <p className="social-kicker">Social</p>
        <h1>{tab === 'friends' ? 'Friends' : 'Challenges'}</h1>
      </div>
      <div className="social-seg-header">
        <div className="social-seg-control" role="tablist" aria-label="Social navigation">
          <button
            role="tab"
            aria-selected={tab === 'friends'}
            className={withTouchFeedback(`social-seg-btn${tab === 'friends' ? ' active' : ''}`)}
            onClick={() => setTab('friends')}
          >
            Friends
          </button>
          <button
            role="tab"
            aria-selected={tab === 'challenges'}
            className={withTouchFeedback(`social-seg-btn${tab === 'challenges' ? ' active' : ''}`)}
            onClick={() => setTab('challenges')}
          >
            Challenges
          </button>
        </div>
      </div>

      <div
        className="social-tab-pane"
        onScroll={(e) => setCompactHeader((e.target?.scrollTop ?? e.currentTarget.scrollTop) > 24)}
        {...bind}
      >
        <div className={`pull-refresh-indicator${isRefreshing ? ' refreshing' : ''}`} style={{ height: pullDistance }}>
          <span>{isRefreshing ? 'Refreshing…' : 'Pull to refresh'}</span>
        </div>

        <div style={tab !== 'friends' ? { display: 'none' } : undefined}>
          <FriendsPanel onCompare={onCompare} comparisonFriendId={comparisonFriendId} mode="friends" />
        </div>
        <div style={tab !== 'challenges' ? { display: 'none' } : undefined}>
          <ChallengesPanel />
        </div>
      </div>
    </div>
  );
}
