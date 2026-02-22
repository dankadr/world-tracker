import { formatProgressText } from '../utils/achievementProgress';

export default function AchievementCard({ achievement }) {
  const { icon, title, desc, unlocked, progress } = achievement;
  const { current, target, pct } = progress;
  const ruleType = achievement.rule?.type;

  // Hide progress bar for simple boolean achievements (0/1 targets like easter eggs, specific visits)
  const showProgressBar = target > 1 || (target === 1 && current === 0);

  return (
    <div className={`achievement-badge ${unlocked ? 'unlocked' : current > 0 ? 'in-progress' : 'locked'}`}>
      <span className="badge-icon">{icon}</span>
      <span className="badge-title">{title}</span>
      <span className="badge-desc">{desc}</span>
      {showProgressBar && (
        <div className="badge-progress">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="progress-text">
            {formatProgressText(current, target, ruleType)}
          </span>
        </div>
      )}
      {!showProgressBar && unlocked && (
        <span className="progress-text progress-done">✓</span>
      )}
    </div>
  );
}
