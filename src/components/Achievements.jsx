import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import getAchievements from '../data/achievements';

export default function Achievements() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const userId = user?.id || null;

  const achievements = getAchievements(userId);
  const results = achievements.map((a) => ({
    ...a,
    unlocked: a.check(),
  }));

  const unlockedCount = results.filter((r) => r.unlocked).length;

  const groups = {};
  results.forEach((a) => {
    const cat = a.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
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
          <div className="modal-content achievements-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
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
                        <div
                          key={a.id}
                          className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}
                        >
                          <span className="badge-icon">{a.icon}</span>
                          <span className="badge-title">{a.title}</span>
                          <span className="badge-desc">{a.desc}</span>
                        </div>
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
