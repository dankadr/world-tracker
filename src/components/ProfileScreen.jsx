import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AvatarCanvas from './AvatarCanvas';
import AvatarEditor from './AvatarEditor';
import LevelBadge from './LevelBadge';
import AchievementCard from './AchievementCard';
import StatsModal from './StatsModal';
import SettingsPanel from './SettingsPanel';
import useAvatar from '../hooks/useAvatar';
import useXp from '../hooks/useXp';
import getAchievements from '../data/achievements';
import { computeProgress } from '../utils/achievementProgress';
import './ProfileScreen.css';

export default function ProfileScreen({ onReset, onResetAll }) {
  const [tab, setTab] = useState('profile');
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const { config, setPart, resetAvatar } = useAvatar();
  const { level, currentXp, nextLevelXp, totalXp } = useXp();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return (
    <div className="tab-screen profile-screen">
      <div className="profile-seg-header">
        <div className="profile-seg-control" role="tablist" aria-label="Profile navigation">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'achievements', label: 'Badges' },
            { id: 'settings', label: 'Settings' },
          ].map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`profile-seg-btn${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="profile-tab-body">
        {tab === 'profile' && (
          <ProfileTab
            config={config}
            level={level}
            currentXp={currentXp}
            nextLevelXp={nextLevelXp}
            totalXp={totalXp}
            user={user}
            onEditAvatar={() => setShowAvatarEditor(true)}
            onOpenStats={() => setShowStats(true)}
          />
        )}
        {tab === 'achievements' && <AchievementsTab userId={userId} />}
        {tab === 'settings' && (
          <SettingsPanel
            onReset={onReset}
            onResetAll={onResetAll}
            onShowOnboarding={() => {
              localStorage.removeItem('onboarding-dismissed');
              window.location.reload();
            }}
          />
        )}
      </div>

      {showAvatarEditor && (
        <AvatarEditor
          config={config}
          onSetPart={setPart}
          onReset={resetAvatar}
          onClose={() => setShowAvatarEditor(false)}
        />
      )}
      {showStats && <StatsModal onClose={() => setShowStats(false)} />}
    </div>
  );
}

function ProfileTab({ config, level, currentXp, nextLevelXp, totalXp, user, onEditAvatar, onOpenStats }) {
  const xpPct = nextLevelXp > 0 ? Math.min(currentXp / nextLevelXp, 1) : 0;

  return (
    <div className="profile-overview">
      <div className="profile-avatar-section">
        <button className="profile-avatar-btn" onClick={onEditAvatar} aria-label="Edit avatar">
          <AvatarCanvas config={config} size={96} />
          <span className="profile-avatar-edit-hint">Edit</span>
        </button>
        <div className="profile-user-info">
          <p className="profile-username">{user?.name || 'Traveller'}</p>
          <div className="profile-level-row">
            <LevelBadge size={36} />
            <span className="profile-level-label">Level {level}</span>
          </div>
          <div className="profile-xp-bar-wrap">
            <div className="profile-xp-bar">
              <div className="profile-xp-fill" style={{ width: `${xpPct * 100}%` }} />
            </div>
            <p className="profile-xp-label">{currentXp} / {nextLevelXp} XP to next level</p>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <p className="profile-total-xp">Total XP earned: {totalXp}</p>
        <button className="profile-stats-btn" onClick={onOpenStats}>
          View Travel Stats
        </button>
      </div>
    </div>
  );
}

function AchievementsTab({ userId }) {
  const achievements = getAchievements(userId);
  const baseResults = achievements.map(a => ({ ...a, unlocked: a.check() }));
  const results = baseResults.map(a => ({
    ...a,
    progress: computeProgress(a.rule, userId, baseResults),
  }));

  const groups = {};
  results.forEach(a => {
    const cat = a.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  });

  Object.values(groups).forEach(badges => {
    badges.sort((a, b) => {
      const aScore = a.unlocked ? 1 : a.progress.pct > 0 ? 2 : 0;
      const bScore = b.unlocked ? 1 : b.progress.pct > 0 ? 2 : 0;
      if (aScore !== bScore) return bScore - aScore;
      return b.progress.pct - a.progress.pct;
    });
  });

  const unlockedCount = results.filter(r => r.unlocked).length;

  return (
    <div className="achievements-tab-content">
      <p className="achievements-tab-summary">{unlockedCount} / {results.length} unlocked</p>
      {Object.entries(groups).map(([cat, badges]) => {
        const catUnlocked = badges.filter(b => b.unlocked).length;
        return (
          <div key={cat} className="achievement-category">
            <h3 className="achievement-cat-heading">
              {cat}
              <span className="achievement-cat-count">{catUnlocked}/{badges.length}</span>
            </h3>
            <div className="achievements-grid">
              {badges.map(a => <AchievementCard key={a.id} achievement={a} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
