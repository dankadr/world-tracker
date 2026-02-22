import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFriends } from '../context/FriendsContext';
import { lookupFriendCode } from '../utils/api';
import AuthButton from './AuthButton';
import ConfirmDialog from './ConfirmDialog';
import ChallengesPanel from './ChallengesPanel';
import './FriendsPanel.css';
import './ChallengesPanel.css';

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
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="fp-avatar fp-avatar-initials" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

export default function FriendsPanel({ onClose, onCompare, comparisonFriendId }) {
  const { user, token, isLoggedIn } = useAuth();
  const { friends, requests, myProfile, loading, sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriend } = useFriends();
  const [activeTab, setActiveTab] = useState('friends');  const [friendCode, setFriendCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const handleCopy = useCallback(async () => {
    if (!myProfile?.friend_code) return;
    try {
      await navigator.clipboard.writeText(myProfile.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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

  const handleRemove = useCallback(async () => {
    if (!confirmRemove) return;
    setActionLoading(`remove-${confirmRemove.id}`);
    try {
      await removeFriend(confirmRemove.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
      setConfirmRemove(null);
    }
  }, [confirmRemove, removeFriend]);

  if (!isLoggedIn) {
    return (
      <div className="friends-panel">
        <div className="fp-header">
          <h2 className="fp-title">👥 Friends</h2>
          {onClose && <button className="fp-close" onClick={onClose} aria-label="Close">&times;</button>}
        </div>
        <div className="fp-login-prompt">
          <p>Sign in to connect with friends, compare stats, and see what they've explored!</p>
          <AuthButton />
        </div>
      </div>
    );
  }

  const totalRequests = requests.incoming.length + requests.outgoing.length;

  return (
    <div className="friends-panel">
      <div className="fp-header">
        <h2 className="fp-title">{activeTab === 'friends' ? '👥 Friends' : '🏆 Challenges'}</h2>
        {onClose && <button className="fp-close" onClick={onClose} aria-label="Close">&times;</button>}
      </div>

      {/* Tab Bar */}
      <div className="fp-tab-bar">
        <button
          className={`fp-tab ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          👥 Friends
          {totalRequests > 0 && <span className="fp-tab-badge">{totalRequests}</span>}
        </button>
        <button
          className={`fp-tab ${activeTab === 'challenges' ? 'active' : ''}`}
          onClick={() => setActiveTab('challenges')}
        >
          🏆 Challenges
        </button>
      </div>

      {activeTab === 'challenges' ? (
        <ChallengesPanel />
      ) : (
      <div className="fp-scrollable">
        {/* My Friend Code */}
        <div className="fp-section">
          <h3 className="fp-section-title">My Code</h3>
          <div className="fp-code-row">
            <span className="fp-code">{myProfile?.friend_code || '...'}</span>
            <button
              className={`fp-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              disabled={!myProfile?.friend_code}
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>
        </div>

        {/* Add Friend */}
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
              className="fp-search-btn"
              onClick={handleSearch}
              disabled={!friendCode.trim() || previewLoading}
            >
              {previewLoading ? '...' : '🔍'}
            </button>
          </div>

          {error && <p className="fp-error">{error}</p>}

          {preview && (
            <div className="fp-preview">
              <Avatar user={preview} />
              <span className="fp-preview-name">{preview.name}</span>
              <button
                className="fp-add-btn"
                onClick={handleSendRequest}
                disabled={actionLoading === 'send'}
              >
                {actionLoading === 'send' ? '...' : 'Add'}
              </button>
            </div>
          )}
        </div>

        {/* Pending Requests */}
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
                    className="fp-accept-btn"
                    onClick={() => handleAccept(req.id)}
                    disabled={actionLoading === `accept-${req.id}`}
                  >
                    {actionLoading === `accept-${req.id}` ? '...' : 'Accept'}
                  </button>
                  <button
                    className="fp-decline-btn"
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
                  className="fp-cancel-btn"
                  onClick={() => handleCancel(req.id)}
                  disabled={actionLoading === `cancel-${req.id}`}
                >
                  {actionLoading === `cancel-${req.id}` ? '...' : 'Cancel'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Friends List */}
        <div className="fp-section">
          <h3 className="fp-section-title">Friends ({friends.length})</h3>
          {loading && friends.length === 0 && <p className="fp-empty">Loading...</p>}
          {!loading && friends.length === 0 && (
            <p className="fp-empty">No friends yet. Share your code or add someone!</p>
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
                    className={`fp-compare-btn ${comparisonFriendId === friend.id ? 'active' : ''}`}
                    onClick={() => onCompare(comparisonFriendId === friend.id ? null : friend)}
                    title={comparisonFriendId === friend.id ? 'Exit comparison' : 'Compare maps'}
                  >
                    {comparisonFriendId === friend.id ? '✕ Exit' : '⚔️ Compare'}
                  </button>
                )}
                <button
                  className="fp-remove-btn"
                  onClick={() => setConfirmRemove(friend)}
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
      )}

      <ConfirmDialog
        isOpen={!!confirmRemove}
        message={`Remove ${confirmRemove?.name || 'this friend'} from your friends list?`}
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
        destructive
      />
    </div>
  );
}
