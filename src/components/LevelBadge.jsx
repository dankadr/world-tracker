import { getLevelTier } from '../utils/xpSystem';
import useXp from '../hooks/useXp';

/**
 * Circular level badge with XP progress ring.
 * Props:
 *   level   - override level (for displaying friend levels)
 *   xpPct   - override progress % (0–1)
 *   size    - badge diameter in px (default 32)
 *   inline  - if true, renders smaller inline variant
 */
export default function LevelBadge({ level: levelOverride, xpPct: xpPctOverride, size = 32, inline = false }) {
  const { level: myLevel, currentXp, nextLevelXp } = useXp();
  const level = levelOverride ?? myLevel;
  const progress = xpPctOverride ?? (nextLevelXp > 0 ? currentXp / nextLevelXp : 0);
  const tier = getLevelTier(level);

  const r = (size / 2) - 3;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  if (inline) {
    return (
      <span
        className="level-badge-inline"
        style={{ '--tier-color': tier.color }}
        title={`Level ${level} — ${tier.name}`}
      >
        Lv.{level}
      </span>
    );
  }

  return (
    <div
      className="level-badge"
      style={{ width: size, height: size, '--tier-color': tier.color, '--tier-bg': tier.bg }}
      title={`Level ${level} — ${tier.name} (${currentXp}/${nextLevelXp} XP)`}
    >
      <svg className="level-badge-ring" viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tier-bg, #333)"
          strokeWidth="3"
          opacity="0.4"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tier-color)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="level-badge-progress"
        />
      </svg>
      <span className="level-badge-number">{level}</span>
    </div>
  );
}
