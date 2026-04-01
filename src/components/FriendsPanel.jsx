import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../context/FriendsContext';
import { lookupFriendCode } from '../utils/api';
import usePullToRefresh from '../hooks/usePullToRefresh';
import AuthButton from './AuthButton';
import { useActionSheet } from '../context/ActionSheetContext';
import ChallengesPanel from './ChallengesPanel';
import { haptics } from '../utils/haptics';
import './FriendsPanel.css';
import './ChallengesPanel.css';
import './iosPrimitives.css';

function FriendsHeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" />
      <path d="M2.5 20v-1a4.5 4.5 0 0 1 9 0v1" />
      <circle cx="16.5" cy="7.5" r="2.5" />
      <path d="M14 20v-.8a3.8 3.8 0 0 1 5.5-3.4" />
    </svg>
  );
}

function ChallengeHeaderIcon() {
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4v14" />
      <path d="m4 15 3 3 3-3" />
      <path d="M17 20V6" />
      <path d="m14 9 3-3 3 3" />
    </svg>
  );
}

function PullArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12" />
      <path d="m7 11 5 5 5-5" />
    </svg>
  );
}

function Avatar({ user, size = 32 }) {
  if (user?.picture) {
    return (
      <img
        className="fp-avatar"
        src={user.picture}
        alt={user.name || ''}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="fp-avatar fp-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

function FriendsListSkeleton() {
  return (
    <div className="fp-skeleton-list" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="fp-skeleton-row">
          <span className="ios-skeleton fp-skeleton-avatar" />
          <div className="fp-skeleton-text">
            <span className="ios-skeleton fp-skeleton-line fp-skeleton-line-name" />
            <span className="ios-skeleton fp-skeleton-line fp-skeleton-line-sub" />
          </div>
          <span className="ios-skeleton fp-skeleton-action" />
        </div>
      ))}
    </div>
  );
}

export default function FriendsPanel({
  onClose,
  onCompare,
  comparisonFriendId,
  showTabNavigation = true,
  showHeader = true,
  onScrollPositionChange,
}) {
  const { token, isLoggedIn } = useAuth();
  const { showActionSheet } = useActionSheet();
  const {
    friends,
    requests,
    myProfile,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    removeFriend,
    refresh,
  } = useFriends();

  const [activeTab, setActiveTab] = useState('friends');
  const [friendCode, setFriendCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (isLoggedIn && refresh) {
      refresh();
    }
  }, [isLoggedIn, refresh]);

  const totalRequests = requests.incoming.length + requests.outgoing.length;
  const currentView = showTabNavigation ? activeTab : 'friends';

  const handleCopy = useCallback(async () => {
    if (!myProfile?.friend_code) return;
    try {
      await navigator.clipboard.writeText(myProfile.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = myProfile.friend_code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [myProfile?.friend_code]);

  const handleSearch = useCallback(async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    setError('');
    setPreview(null);
    setPreviewLoading(true);
    try {
      const result = await lookupFriendCode(token, code);
      setPreview(result);
    } catch (err) {
      setError(err.message || 'User not found');
    } finally {
      setPreviewLoading(false);
    }
  }, [friendCode, token]);

  const handleSendRequest = useCallback(async () => {
    if (!preview) return;
    setActionLoading('send');
    setError('');
    try {
      await sendRequest(friendCode.trim().toUpperCase());
      setFriendCode('');
      setPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  }, [preview, friendCode, sendRequest]);

  const handleAccept = useCallback(async (id) => {
    setActionLoading(`accept-${id}`);
    try {
      await acceptRequest(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [acceptRequest]);

  const handleDecline = useCallback(async (id) => {
    setActionLoading(`decline-${id}`);
    try {
      await declineRequest(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [declineRequest]);

  const handleCancel = useCallback(async (id) => {
    setActionLoading(`cancel-${id}`);
    try {
      await cancelRequest(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [cancelRequest]);

  const handleRemove = useCallback((friend) => {
    showActionSheet({
      title: 'Remove Friend',
      message: `Remove ${friend.name} from your friends list?`,
      actions: [
        {
          label: 'Remove',
          destructive: true,
          onPress: async () => {
            setActionLoading(`remove-${friend.id}`);
            try {
              await removeFriend(friend.id);
            } catch (err) {
              setError(err.message);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    });
  }, [showActionSheet, removeFriend]);

  const handleRefresh = useCallback(async () => {
    if (refresh) {
      await refresh();
    }
  }, [refresh]);

  const handleTabSwitch = useCallback((nextTab) => {
    haptics.selection();
    setActiveTab(nextTab);
  }, []);

  const pullToRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled: !isLoggedIn || currentView !== 'friends',
  });

  const handleScrollableScroll = useCallback((event) => {
    onScrollPositionChange?.(event.currentTarget.scrollTop);
  }, [onScrollPositionChange]);

  useEffect(() => {
    onScrollPositionChange?.(0);
  }, [onScrollPositionChange]);

  if (!isLoggedIn) {
    return (
      <div className="friends-panel">
        {showHeader && (
          <div className="fp-header">
            <h2 className="fp-title">
              <span className="fp-title-icon"><FriendsHeaderIcon /></span>
              Friends
            </h2>
            {onClose && <button className="fp-close ios-touch-feedback" onClick={onClose} aria-label="Close">&times;</button>}
          </div>
        )}
        <div className="fp-login-prompt">
          <p>Sign in to connect with friends, compare stats, and see what they&apos;ve explored.</p>
          <AuthButton />
        </div>
      </div>
    );
  }

  return (
    <div className="friends-panel">
      {showHeader && (
        <div className="fp-header">
          <h2 className="fp-title">
            <span className="fp-title-icon">
              {currentView === 'friends' ? <FriendsHeaderIcon /> : <ChallengeHeaderIcon />}
            </span>
            {currentView === 'friends' ? 'Friends' : 'Challenges'}
          </h2>
          {onClose && <button className="fp-close ios-touch-feedback" onClick={onClose} aria-label="Close">&times;</button>}
        </div>
      )}

      {showTabNavigation && (
        <div className="fp-tab-bar">
          <button
            className={`fp-tab ios-touch-feedback ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('friends')}
          >
            <span className="fp-tab-icon"><FriendsHeaderIcon /></span>
            Friends
            {totalRequests > 0 && <span className="fp-tab-badge">{totalRequests}</span>}
          </button>
          <button
            className={`fp-tab ios-touch-feedback ${activeTab === 'challenges' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('challenges')}
          >
            <span className="fp-tab-icon"><ChallengeHeaderIcon /></span>
            Challenges
          </button>
        </div>
      )}

      {currentView === 'challenges' ? (
        <ChallengesPanel
          showHeader={!showTabNavigation}
          onScrollPositionChange={onScrollPositionChange}
        />
      ) : (
        <div className="fp-scrollable" ref={pullToRefresh.containerRef} {...pullToRefresh.bind} onScroll={handleScrollableScroll}>
          <div className={`ios-pull-indicator${pullToRefresh.pullDistance > 4 || pullToRefresh.isRefreshing ? ' visible' : ''}${pullToRefresh.isReady ? ' ready' : ''}${pullToRefresh.isRefreshing ? ' refreshing' : ''}`}>
            <PullArrowIcon />
            <span>{pullToRefresh.indicatorText}</span>
          </div>

          <div className="fp-scroll-content" style={pullToRefresh.contentStyle}>
            <div className="fp-section">
              <h3 className="fp-section-title">My Code</h3>
              <div className="fp-code-row">
                <span className="fp-code">{myProfile?.friend_code || '...'}</span>
                <button
                  className={`fp-copy-btn ios-touch-feedback ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  disabled={!myProfile?.friend_code}
                  aria-label="Copy friend code"
                >
                  {copied ? '✓' : <CopyIcon />}
                </button>
              </div>
            </div>

            <div className="fp-section">
              <h3 className="fp-section-title">Add Friend</h3>
              <div className="fp-add-row">
                <input
                  className="fp-input"
                  type="text"
                  placeholder="Enter friend code"
                  value={friendCode}
                  onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  maxLength={12}
                />
                <button
                  className="fp-search-btn ios-touch-feedback"
                  onClick={handleSearch}
                  disabled={!friendCode.trim() || previewLoading}
                  aria-label="Search friend code"
                >
                  {previewLoading ? '...' : <SearchIcon />}
                </button>
              </div>

              {error && <p className="fp-error">{error}</p>}

              {preview && (
                <div className="fp-preview">
                  <Avatar user={preview} />
                  <span className="fp-preview-name">{preview.name}</span>
                  <button
                    className="fp-add-btn ios-touch-feedback"
                    onClick={handleSendRequest}
                    disabled={actionLoading === 'send'}
                  >
                    {actionLoading === 'send' ? '...' : 'Add'}
                  </button>
                </div>
              )}
            </div>

            {totalRequests > 0 && (
              <div className="fp-section">
                <h3 className="fp-section-title">Pending Requests ({totalRequests})</h3>

                {requests.incoming.map((req) => (
                  <div key={req.id} className="fp-request incoming">
                    <span className="fp-request-arrow">←</span>
                    <Avatar user={req.from_user} size={28} />
                    <span className="fp-request-name">{req.from_user?.name || 'Someone'}</span>
                    <div className="fp-request-actions">
                      <button
                        className="fp-accept-btn ios-touch-feedback"
                        onClick={() => handleAccept(req.id)}
                        disabled={actionLoading === `accept-${req.id}`}
                      >
                        {actionLoading === `accept-${req.id}` ? '...' : 'Accept'}
                      </button>
                      <button
                        className="fp-decline-btn ios-touch-feedback"
                        onClick={() => handleDecline(req.id)}
                        disabled={actionLoading === `decline-${req.id}`}
                      >
                        {actionLoading === `decline-${req.id}` ? '...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                ))}

                {requests.outgoing.map((req) => (
                  <div key={req.id} className="fp-request outgoing">
                    <span className="fp-request-arrow">→</span>
                    <Avatar user={req.to_user} size={28} />
                    <span className="fp-request-name">{req.to_user?.name || 'Someone'}</span>
                    <button
                      className="fp-cancel-btn ios-touch-feedback"
                      onClick={() => handleCancel(req.id)}
                      disabled={actionLoading === `cancel-${req.id}`}
                    >
                      {actionLoading === `cancel-${req.id}` ? '...' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="fp-section">
              <h3 className="fp-section-title">Friends ({friends.length})</h3>
              {loading && friends.length === 0 && <FriendsListSkeleton />}
              {!loading && friends.length === 0 && (
                <p className="fp-empty">No friends yet. Share your code or add someone.</p>
              )}
              {friends.map((friend) => (
                <div key={friend.id} className="fp-friend">
                  <Avatar user={friend} />
                  <div className="fp-friend-info">
                    <span className="fp-friend-name">{friend.name}</span>
                    {friend.world_countries != null && (
                      <span className="fp-friend-stat">{friend.world_countries} countries</span>
                    )}
                  </div>
                  <div className="fp-friend-actions">
                    {onCompare && (
                      <button
                        className={`fp-compare-btn ios-touch-feedback ${comparisonFriendId === friend.id ? 'active' : ''}`}
                        onClick={() => onCompare(comparisonFriendId === friend.id ? null : friend)}
                        title={comparisonFriendId === friend.id ? 'Exit comparison' : 'Compare maps'}
                      >
                        <span className="fp-compare-icon"><CompareIcon /></span>
                        {comparisonFriendId === friend.id ? 'Exit' : 'Compare'}
                      </button>
                    )}
                    <button
                      className="fp-remove-btn ios-touch-feedback"
                      onClick={() => handleRemove(friend)}
                      disabled={actionLoading === `remove-${friend.id}`}
                      title="Remove friend"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
