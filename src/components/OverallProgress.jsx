import { useState } from 'react';
import { countryList } from '../data/countries';

const STORAGE_PREFIX = 'swiss-tracker-visited-';

function getVisitedCount(countryId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + countryId);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.length;
      if (typeof data === 'object') return Object.keys(data).length;
    }
  } catch { /* ignore */ }
  return 0;
}

export default function OverallProgress() {
  const [open, setOpen] = useState(false);

  const stats = countryList.map((c) => {
    const total = c.data.features.length;
    const visited = getVisitedCount(c.id);
    return { ...c, total, visited, pct: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });

  const totalAll = stats.reduce((s, c) => s + c.total, 0);
  const visitedAll = stats.reduce((s, c) => s + c.visited, 0);
  const pctAll = totalAll > 0 ? Math.round((visitedAll / totalAll) * 100) : 0;

  return (
    <div className="overall-progress">
      <button className="overall-toggle" onClick={() => setOpen(!open)}>
        <span className="overall-summary">
          <span className="overall-label">Overall</span>
          <span className="overall-nums">{visitedAll}/{totalAll}</span>
        </span>
        <div className="overall-bar">
          <div className="overall-bar-fill" style={{ width: `${pctAll}%` }} />
        </div>
        <span className="overall-pct">{pctAll}%</span>
        <span className={`overall-chevron ${open ? 'open' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <div className="overall-detail">
          {stats.map((s) => (
            <div className="overall-row" key={s.id}>
              <span className="overall-row-flag">{s.flag}</span>
              <span className="overall-row-name">{s.name}</span>
              <div className="overall-row-bar">
                <div
                  className="overall-row-bar-fill"
                  style={{ width: `${s.pct}%`, background: s.visitedColor }}
                />
              </div>
              <span className="overall-row-nums">{s.visited}/{s.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
