import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { avatarCategories, hairColorOptions } from '../config/avatarParts';
import getAchievements from '../data/achievements';
import AvatarCanvas from './AvatarCanvas';
import ConfirmDialog from './ConfirmDialog';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';

const categoryOrder = ['background', 'body', 'hair', 'eyes', 'shirt', 'hat', 'accessory', 'shoes', 'glasses', 'cape', 'badge', 'pet'];

export default function AvatarEditor({ config, onSetPart, onReset, onClose }) {
  const [activeTab, setActiveTab] = useState('body');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { user } = useAuth();
  const userId = user?.id || null;
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);

  const achievements = getAchievements(userId);
  const unlockedIds = new Set(achievements.filter((a) => a.check()).map((a) => a.id));

  function isUnlocked(part) {
    if (!part.requires) return true;
    return unlockedIds.has(part.requires);
  }

  function getAchievementName(id) {
    const a = achievements.find((x) => x.id === id);
    return a ? `${a.icon} ${a.title}` : id;
  }

  const category = avatarCategories[activeTab];
  const parts = category?.parts || [];

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content avatar-editor-modal" ref={handleRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" {...dragHandlers}>
          <div className="drag-handle" />
          <h2>Customize Avatar</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="avatar-editor-preview">
          <AvatarCanvas config={config} size={128} />
        </div>

        <div className="avatar-category-tabs">
          {categoryOrder.map((key) => (
            <button
              key={key}
              className={`avatar-cat-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {avatarCategories[key].label}
            </button>
          ))}
        </div>

        <div className="avatar-parts-grid-container">
          {activeTab === 'hair' && (
            <div className="avatar-hair-colors">
              <span className="avatar-color-label">Color:</span>
              {hairColorOptions.map((hc, i) => (
                <button
                  key={hc.id}
                  className={`avatar-color-swatch ${config.hairColor === i ? 'active' : ''}`}
                  style={{ background: hc.color }}
                  onClick={() => onSetPart('hairColor', i)}
                  title={hc.name}
                />
              ))}
            </div>
          )}

          {category?.comingSoon ? (
            <div className="avatar-coming-soon">
              <span className="avatar-coming-soon-icon">🔮</span>
              <h3 className="avatar-coming-soon-title">Coming Soon</h3>
              <p className="avatar-coming-soon-desc">New {category.label.toLowerCase()} will be available in a future update!</p>
              <div className="avatar-coming-soon-items">
                {parts.filter(p => p.requires).map((part) => (
                  <div key={part.id} className="avatar-coming-soon-item">
                    <span className="lock-icon">&#128274;</span>
                    <span>{part.name}</span>
                    <span className="avatar-coming-soon-req">Requires: {getAchievementName(part.requires)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div className="avatar-parts-grid">
            {parts.map((part, i) => {
              const unlocked = isUnlocked(part);
              const isSelected = config[activeTab] === i;
              const previewConfig = { ...config, [activeTab]: i };
              return (
                <button
                  key={part.id}
                  className={`avatar-part-option ${isSelected ? 'selected' : ''} ${!unlocked ? 'locked' : ''}`}
                  onClick={() => unlocked && onSetPart(activeTab, i)}
                  disabled={!unlocked}
                  title={unlocked ? part.name : `Locked: ${getAchievementName(part.requires)}`}
                >
                  <AvatarCanvas config={previewConfig} size={48} />
                  <span className="avatar-part-name">{part.name}</span>
                  {!unlocked && (
                    <span className="avatar-part-lock">
                      <span className="lock-icon">&#128274;</span>
                      <span className="lock-req">{getAchievementName(part.requires)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>

        <div className="avatar-editor-footer">
          <button className="avatar-reset-btn" onClick={() => setShowResetConfirm(true)}>
            Reset Avatar
          </button>
        </div>
        <ConfirmDialog
          isOpen={showResetConfirm}
          message="Reset avatar to default?"
          confirmLabel="Reset"
          onConfirm={() => { onReset(); setShowResetConfirm(false); }}
          onCancel={() => setShowResetConfirm(false)}
        />
      </div>
    </div>,
    document.body
  );
}
