import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import getAchievements from '../data/achievements';
import { computeProgress } from '../utils/achievementProgress';
import AchievementCard from './AchievementCard';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';

export default function Achievements() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const userId = user?.id || null;

  const achievements = getAchievements(userId);

  // First pass: compute unlocked status
  const baseResults = achievements.map((a) => ({
    ...a,
    unlocked: a.check(),
  }));

  // Second pass: compute progress (needs baseResults for meta-achievements)
  const results = baseResults.map((a) => ({
    ...a,
    progress: computeProgress(a.rule, userId, baseResults),
  }));

  const unlockedCount = results.filter((r) => r.unlocked).length;
  const { handleRef, dragHandlers } = useSwipeToDismiss(() => setOpen(false));

  const groups = {};
  results.forEach((a) => {
    const cat = a.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  });

  // Sort within each group: in-progress first, then completed, then locked (0 progress)
  Object.values(groups).forEach((badges) => {
    badges.sort((a, b) => {
      const aScore = a.unlocked ? 1 : a.progress.pct > 0 ? 2 : 0;
      const bScore = b.unlocked ? 1 : b.progress.pct > 0 ? 2 : 0;
      // in-progress (2) first, then completed (1), then locked (0)
      if (aScore !== bScore) return bScore - aScore;
      // Within same group, sort by progress percentage descending
      return b.progress.pct - a.progress.pct;
    });
  });

  return (
    <>
      <div className="achievements">
        <button className="achievements-toggle" onClick={() => setOpen(true)}>
          <span className="achievements-label">Achievements</span>
          <span className="achievements-count">{unlockedCount}/{results.length}</span>
          <span className="overall-chevron">&#9656;</span>
        </button>
      </div>

      {open && createPortal(
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content achievements-modal" ref={handleRef} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" {...dragHandlers}>
              <div className="drag-handle" />
              <h2>Achievements ({unlockedCount}/{results.length})</h2>
              <button className="modal-close" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <div className="achievements-modal-body">
              {Object.entries(groups).map(([cat, badges]) => {
                const catUnlocked = badges.filter((b) => b.unlocked).length;
                return (
                  <div key={cat} className="achievement-category">
                    <h3 className="achievement-cat-heading">
                      {cat}
                      <span className="achievement-cat-count">{catUnlocked}/{badges.length}</span>
                    </h3>
                    <div className="achievements-grid">
                      {badges.map((a) => (
                        <AchievementCard key={a.id} achievement={a} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
