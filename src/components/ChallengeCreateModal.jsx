import { useState, useCallback } from 'react';
import { useFriends } from '../context/FriendsContext';
import countries, { countryList } from '../data/countries';
import './ChallengesPanel.css';

const TRACKER_OPTIONS = [
  { id: 'world', flag: '🌍', name: 'World (Countries)' },
  ...countryList.map((c) => ({ id: c.id, flag: c.flag, name: c.name })),
];

export default function ChallengeCreateModal({ onClose, onCreate }) {
  const { friends } = useFriends();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trackerId, setTrackerId] = useState('world');
  const [challengeType, setChallengeType] = useState('collaborative');
  const [useAllRegions, setUseAllRegions] = useState(true);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [selectedFriends, setSelectedFriends] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [regionSearch, setRegionSearch] = useState('');

  // Get available regions for the selected tracker
  const availableRegions = trackerId === 'world'
    ? [] // World tracker uses country codes, managed differently
    : (countries[trackerId]?.data?.features || [])
        .filter((f) => !f.properties.isBorough)
        .map((f) => ({ id: f.properties.id, name: f.properties.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

  const filteredRegions = regionSearch
    ? availableRegions.filter((r) => r.name.toLowerCase().includes(regionSearch.toLowerCase()))
    : availableRegions;

  const toggleRegion = useCallback((regionId) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  }, []);

  const toggleFriend = useCallback((friendId) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || null,
        tracker_id: trackerId,
        target_regions: useAllRegions ? ['*'] : Array.from(selectedRegions),
        challenge_type: challengeType,
        invite_friend_ids: Array.from(selectedFriends),
      });
    } catch (err) {
      setError(err.message || 'Failed to create challenge');
      setSubmitting(false);
    }
  }, [title, description, trackerId, useAllRegions, selectedRegions, challengeType, selectedFriends, onCreate]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ch-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ch-create-header">
          <h3>Create Challenge</h3>
          <button className="ch-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ch-create-body">
          {/* Title */}
          <div className="ch-field">
            <label className="ch-label">Title *</label>
            <input
              className="ch-input"
              type="text"
              placeholder="e.g., Visit all Nordic countries"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="ch-field">
            <label className="ch-label">Description</label>
            <textarea
              className="ch-textarea"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {/* Tracker */}
          <div className="ch-field">
            <label className="ch-label">Tracker</label>
            <div className="ch-tracker-grid">
              {TRACKER_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  className={`ch-tracker-option ${trackerId === t.id ? 'active' : ''}`}
                  onClick={() => {
                    setTrackerId(t.id);
                    setSelectedRegions(new Set());
                    setUseAllRegions(true);
                  }}
                >
                  <span>{t.flag}</span>
                  <span className="ch-tracker-name">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Challenge Type */}
          <div className="ch-field">
            <label className="ch-label">Type</label>
            <div className="ch-type-toggle">
              <button
                className={`ch-type-btn ${challengeType === 'collaborative' ? 'active' : ''}`}
                onClick={() => setChallengeType('collaborative')}
              >
                <span>🤝</span>
                <span>Team</span>
                <span className="ch-type-desc">Group progress</span>
              </button>
              <button
                className={`ch-type-btn ${challengeType === 'race' ? 'active' : ''}`}
                onClick={() => setChallengeType('race')}
              >
                <span>🏁</span>
                <span>Race</span>
                <span className="ch-type-desc">Individual leaderboard</span>
              </button>
            </div>
          </div>

          {/* Region Selection (non-world trackers) */}
          {trackerId !== 'world' && availableRegions.length > 0 && (
            <div className="ch-field">
              <label className="ch-label">Target Regions</label>
              <div className="ch-region-toggle">
                <label className="ch-radio-label">
                  <input
                    type="radio"
                    checked={useAllRegions}
                    onChange={() => setUseAllRegions(true)}
                  />
                  <span>All regions ({availableRegions.length})</span>
                </label>
                <label className="ch-radio-label">
                  <input
                    type="radio"
                    checked={!useAllRegions}
                    onChange={() => setUseAllRegions(false)}
                  />
                  <span>Custom selection</span>
                </label>
              </div>

              {!useAllRegions && (
                <div className="ch-region-picker">
                  <input
                    className="ch-input ch-region-search"
                    type="text"
                    placeholder="Search regions..."
                    value={regionSearch}
                    onChange={(e) => setRegionSearch(e.target.value)}
                  />
                  <div className="ch-region-list">
                    {filteredRegions.map((r) => (
                      <label key={r.id} className={`ch-region-item ${selectedRegions.has(r.id) ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedRegions.has(r.id)}
                          onChange={() => toggleRegion(r.id)}
                        />
                        <span>{r.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedRegions.size > 0 && (
                    <span className="ch-region-count">{selectedRegions.size} selected</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invite Friends */}
          {friends.length > 0 && (
            <div className="ch-field">
              <label className="ch-label">Invite Friends</label>
              <div className="ch-friend-list">
                {friends.map((f) => (
                  <label key={f.id} className={`ch-friend-item ${selectedFriends.has(f.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedFriends.has(f.id)}
                      onChange={() => toggleFriend(f.id)}
                    />
                    {f.picture ? (
                      <img className="ch-friend-avatar" src={f.picture} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="ch-friend-avatar ch-friend-avatar-placeholder">
                        {(f.name || '?')[0]}
                      </span>
                    )}
                    <span className="ch-friend-name">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="ch-error">{error}</p>}
        </div>

        <div className="ch-create-footer">
          <button className="ch-cancel-btn" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="ch-submit-btn" onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? 'Creating...' : 'Create Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}
