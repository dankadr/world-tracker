import { useState } from 'react';
import FriendsPanel from './FriendsPanel';
import ChallengesPanel from './ChallengesPanel';
import './SocialScreen.css';

export default function SocialScreen({ onCompare, comparisonFriendId }) {
  const [tab, setTab] = useState('friends');

  return (
    <div className="tab-screen social-screen">
      <div className="social-seg-header">
        <div className="social-seg-control" role="tablist" aria-label="Social navigation">
          <button
            role="tab"
            aria-selected={tab === 'friends'}
            className={`social-seg-btn${tab === 'friends' ? ' active' : ''}`}
            onClick={() => setTab('friends')}
          >
            Friends
          </button>
          <button
            role="tab"
            aria-selected={tab === 'challenges'}
            className={`social-seg-btn${tab === 'challenges' ? ' active' : ''}`}
            onClick={() => setTab('challenges')}
          >
            Challenges
          </button>
        </div>
      </div>

      {/* Both panels stay mounted so state (open modals, form input) is preserved */}
      <div className="social-tab-pane" style={tab !== 'friends' ? { display: 'none' } : undefined}>
        <FriendsPanel onCompare={onCompare} comparisonFriendId={comparisonFriendId} />
      </div>
      <div className="social-tab-pane" style={tab !== 'challenges' ? { display: 'none' } : undefined}>
        <ChallengesPanel />
      </div>
    </div>
  );
}
