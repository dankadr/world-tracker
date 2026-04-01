import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchEmailPreferences, updateEmailPreferences } from '../utils/api';

const EMAIL_TOGGLES = [
  { key: 'weekly_digest', label: 'Weekly Digest', icon: '🗓️' },
  { key: 'monthly_recap', label: 'Monthly Recap', icon: '🧭' },
  { key: 'friend_notifications', label: 'Friend Notifications', icon: '👥' },
  { key: 'challenge_notifications', label: 'Challenge Updates', icon: '🏁' },
  { key: 'bucket_list_reminders', label: 'Bucket List Reminders', icon: '📌' },
  { key: 'milestone_celebrations', label: 'Milestone Celebrations', icon: '🏆' },
  { key: 'marketing', label: 'Product News', icon: '📣' },
];

export default function EmailPreferences() {
  const { isLoggedIn, token, user } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!isLoggedIn || !token) {
      setPrefs(null);
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    fetchEmailPreferences(token)
      .then((nextPrefs) => {
        if (!cancelled) setPrefs(nextPrefs);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load email preferences right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isLoggedIn, token]);

  async function handleToggle(key) {
    if (!token || !prefs) return;

    const previous = prefs;
    const nextValue = !Boolean(previous[key]);
    const optimistic = { ...previous, [key]: nextValue };
    setPrefs(optimistic);
    setSavingKey(key);
    setError('');

    try {
      const updated = await updateEmailPreferences(token, { [key]: nextValue });
      setPrefs(updated);
    } catch {
      setPrefs(previous);
      setError('Could not save email preferences. Please try again.');
    } finally {
      setSavingKey('');
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="settings-section">
        <p className="settings-section-label">Emails</p>
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-row-icon">✉️</span>
              <div className="settings-copy-block">
                <span className="settings-row-title">Sign in to manage emails</span>
                <span className="settings-row-caption">Email preferences are only available on your account.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <p className="settings-section-label">Emails</p>
      <div className="settings-group">
        <div className="settings-row">
          <div className="settings-row-left">
            <span className="settings-row-icon">✉️</span>
            <div className="settings-copy-block">
              <span className="settings-row-title">Delivery Address</span>
              <span className="settings-row-caption">{user?.email || 'Signed-in account'}</span>
            </div>
          </div>
        </div>

        {loading && (
          <>
            <div className="settings-row-divider" />
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-icon">⏳</span>
                <span className="settings-row-title">Loading preferences…</span>
              </div>
            </div>
          </>
        )}

        {!loading && prefs && EMAIL_TOGGLES.map((item) => (
          <div key={item.key}>
            <div className="settings-row-divider" />
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-row-icon">{item.icon}</span>
                <span className="settings-row-title">{item.label}</span>
              </div>
              <button
                className={`settings-toggle ${prefs[item.key] ? 'on' : ''}`}
                onClick={() => handleToggle(item.key)}
                aria-label={prefs[item.key] ? `Disable ${item.label}` : `Enable ${item.label}`}
                disabled={savingKey === item.key}
                aria-busy={savingKey === item.key}
                data-testid={`email-toggle-${item.key}`}
              >
                <span className="settings-toggle-thumb" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="settings-helper-text">
        Every email includes a one-click unsubscribe link. Transactional account mail respects these preferences where applicable.
      </p>
      {error && <p className="settings-error-text">{error}</p>}
    </div>
  );
}
