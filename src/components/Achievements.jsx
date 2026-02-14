import { useState } from 'react';
import achievements from '../data/achievements';

export default function Achievements() {
  const [open, setOpen] = useState(false);

  const results = achievements.map((a) => ({
    ...a,
    unlocked: a.check(),
  }));

  const unlockedCount = results.filter((r) => r.unlocked).length;

  return (
    <div className="achievements">
      <button className="achievements-toggle" onClick={() => setOpen(!open)}>
        <span className="achievements-label">
          Achievements
        </span>
        <span className="achievements-count">{unlockedCount}/{results.length}</span>
        <span className={`overall-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <div className="achievements-grid">
          {results.map((a) => (
            <div
              key={a.id}
              className={`achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}`}
              title={a.desc}
            >
              <span className="badge-icon">{a.icon}</span>
              <span className="badge-title">{a.title}</span>
              <span className="badge-desc">{a.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
