import { getDetailItems } from '../utils/achievementDetail';
import { formatProgressText } from '../utils/achievementProgress';
import './AchievementCard.css';

const MAX_CHIPS = 8;

function ChipList({ items, variant }) {
  const shown = items.slice(0, MAX_CHIPS);
  const overflow = items.length - MAX_CHIPS;
  return (
    <div className="achievement-chip-list">
      {shown.map(name => (
        <span key={name} className={`achievement-chip achievement-chip-${variant}`}>{name}</span>
      ))}
      {overflow > 0 && (
        <span className="achievement-chip achievement-chip-more">+{overflow} more</span>
      )}
    </div>
  );
}

export default function AchievementCard({ achievement, isExpanded, onToggle }) {
  const { id, icon, title, desc, unlocked, progress, rule } = achievement;
  const { current, target, pct } = progress;
  const ruleType = rule?.type;

  const showProgressBar = target > 1 || (target === 1 && current === 0);

  const statusLabel = unlocked ? '✓ Unlocked' : current > 0 ? 'In progress' : 'Locked';
  const statusClass = unlocked ? 'unlocked' : current > 0 ? 'in-progress' : 'locked';

  // Compute detail items only when expanded (avoids work on every render)
  const detail = isExpanded ? getDetailItems(rule, achievement._userId ?? null) : null;

  const remaining = target - Math.min(current, target);
  // Suppress raw "N to go" for types whose target is a large number (area, population)
  const showRemainingCount = remaining > 0 && ruleType !== 'worldAreaVisited' && ruleType !== 'worldPopulationVisited';

  return (
    <div
      className={`achievement-badge ${unlocked ? 'unlocked' : current > 0 ? 'in-progress' : 'locked'}${isExpanded ? ' achievement-badge-expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    >
      {/* Collapsed header — always visible */}
      <span className="badge-icon">{icon}</span>
      <span className="badge-title">{title}</span>
      {!isExpanded && <span className="badge-desc">{desc}</span>}

      {/* Collapsed progress — hidden when expanded */}
      {!isExpanded && showProgressBar && (
        <div className="badge-progress">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress-text">{formatProgressText(current, target, ruleType)}</span>
        </div>
      )}
      {!isExpanded && !showProgressBar && unlocked && (
        <span className="progress-text progress-done">✓</span>
      )}

      {/* ── Expanded detail panel ── */}
      {isExpanded && (
        <div className="achievement-detail">
          {/* Close button — 44×44px tap target */}
          <button
            className="achievement-detail-close"
            onClick={e => { e.stopPropagation(); onToggle(); }}
            aria-label="Close detail"
          >
            ✕
          </button>

          {/* Description + status pill */}
          <p className="achievement-detail-desc">{desc}</p>
          <span className={`achievement-detail-pill achievement-detail-pill-${statusClass}`}>
            {statusLabel}
          </span>

          {/* Progress bar */}
          <div className="achievement-detail-bar-wrap">
            <div className="achievement-detail-bar-track">
              <div className="achievement-detail-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="achievement-detail-bar-label">
              {formatProgressText(current, target, ruleType)}
              {showRemainingCount && ` · ${remaining} to go`}
            </span>
          </div>

          {/* Region lists or hint */}
          {detail?.isListable ? (
            <>
              {detail.visited.length > 0 && (
                <>
                  <div className="achievement-detail-section">
                    <span className="achievement-detail-section-label">Visited</span>
                    <span className="achievement-detail-section-count">{detail.visited.length}</span>
                  </div>
                  <ChipList items={detail.visited} variant="visited" />
                </>
              )}
              {detail.remaining.length > 0 && (
                <>
                  <div className="achievement-detail-section">
                    <span className="achievement-detail-section-label">Still needed</span>
                    <span className="achievement-detail-section-count">{detail.remaining.length}</span>
                  </div>
                  <ChipList items={detail.remaining} variant="remaining" />
                </>
              )}
            </>
          ) : (
            <p className="achievement-detail-hint">
              {ruleType === 'achievementsUnlocked' || ruleType === 'categoryComplete'
                ? 'Unlock more badges to progress.'
                : ruleType === 'gameCompleted'
                ? 'Complete geography mini-games to unlock.'
                : 'Keep exploring any tracker to progress.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
