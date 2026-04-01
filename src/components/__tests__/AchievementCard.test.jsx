import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AchievementCard from '../AchievementCard';

const baseAchievement = {
  id: 'first-steps',
  icon: '👣',
  title: 'First Steps',
  desc: 'Visit your first region',
  unlocked: false,
  progress: { current: 0, target: 1, pct: 0 },
  rule: { type: 'totalVisited', min: 1 },
};

describe('AchievementCard', () => {
  it('renders the SVG icon when iconPath is available', () => {
    const { container } = render(
      <AchievementCard
        achievement={{ ...baseAchievement, iconPath: 'achievements/first-steps' }}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    const img = container.querySelector('.badge-icon img');
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('/icons/achievements/first-steps.svg');
  });

  it('falls back to the emoji icon if the SVG asset fails to load', () => {
    const { container } = render(
      <AchievementCard
        achievement={{ ...baseAchievement, iconPath: 'achievements/first-steps' }}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    fireEvent.error(container.querySelector('.badge-icon img'));

    expect(container.querySelector('.badge-icon')).toHaveTextContent('👣');
  });

  it('keeps rendering emoji-only achievements without iconPath', () => {
    const { container } = render(
      <AchievementCard
        achievement={baseAchievement}
        isExpanded={false}
        onToggle={() => {}}
      />
    );

    expect(container.querySelector('.badge-icon')).toHaveTextContent('👣');
    expect(container.querySelector('.badge-icon img')).toBeNull();
  });
});
