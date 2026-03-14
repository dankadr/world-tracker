import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import useXp from '../hooks/useXp';
import { hapticSelection, hapticSuccess } from '../utils/haptics';

const REASON_LABELS = {
  visit_region: 'Region visited',
  visit_country: 'Country visited',
  complete_tracker: 'Tracker completed',
  unlock_achievement: 'Achievement unlocked',
  complete_challenge: 'Challenge completed',
  first_tracker_visit: 'New tracker started',
};

/**
 * XP notification toasts — shows "+10 XP" popups and level-up celebrations.
 */
export default function XpNotification() {
  const { notifications, dismissNotification } = useXp();
  const seenRef = useRef(new Set());

  useEffect(() => {
    notifications.forEach((n) => {
      if (seenRef.current.has(n.id)) return;
      seenRef.current.add(n.id);
      if (n.levelUp) {
        hapticSuccess();
      } else if (n.reason === 'unlock_achievement') {
        hapticSelection();
      }
    });
  }, [notifications]);

  if (notifications.length === 0) return null;

  return createPortal(
    <div className="xp-toast-container">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`xp-toast ${n.levelUp ? 'xp-toast-levelup' : ''}`}
          onClick={() => dismissNotification(n.id)}
        >
          {n.levelUp ? (
            <>
              <span className="xp-toast-levelup-icon">⭐</span>
              <div className="xp-toast-text">
                <span className="xp-toast-label">Level Up!</span>
                <span className="xp-toast-title">You reached Level {n.levelUp}!</span>
                <span className="xp-toast-xp">+{n.amount} XP</span>
              </div>
            </>
          ) : (
            <>
              <span className="xp-toast-icon">✦</span>
              <div className="xp-toast-text">
                <span className="xp-toast-xp">+{n.amount} XP</span>
                <span className="xp-toast-reason">{REASON_LABELS[n.reason] || n.reason}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>,
    document.body
  );
}
