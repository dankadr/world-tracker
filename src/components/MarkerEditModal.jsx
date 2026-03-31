import { useState, useEffect } from 'react';
import './MarkerEditModal.css';

const PRESET_EMOJIS = ['📍', '🏕️', '❤️', '⭐', '🎯', '🍽️', '🏖️', '🗻', '🏔️', '🌊', '🎭', '🏛️'];
const PRESET_COLORS = ['#c9a84c', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22'];

export default function MarkerEditModal({ marker, onSave, onDelete, onClose }) {
  const isEditing = !!marker?.id;
  const [label, setLabel] = useState(marker?.label || '');
  const [icon, setIcon] = useState(marker?.icon || '📍');
  const [color, setColor] = useState(marker?.color || '#c9a84c');

  useEffect(() => {
    if (marker) {
      setLabel(marker.label || '');
      setIcon(marker.icon || '📍');
      setColor(marker.color || '#c9a84c');
    }
  }, [marker]);

  if (!marker) return null;

  const handleSave = () => {
    onSave({ label: label.trim() || null, icon, color });
  };

  const handleDelete = () => {
    if (onDelete) onDelete();
  };

  return (
    <div className="marker-modal-overlay" onClick={onClose}>
      <div className="marker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="marker-modal-header">
          <span className="marker-modal-title">{isEditing ? 'Edit Marker' : 'Add Marker'}</span>
          <button className="marker-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="marker-modal-preview">
          <div className="marker-preview-dot" style={{ background: color }}>
            <span>{icon}</span>
          </div>
        </div>

        <div className="marker-modal-field">
          <label className="marker-modal-label" htmlFor="marker-label">Label</label>
          <input
            id="marker-label"
            className="marker-modal-input"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Optional label…"
            maxLength={80}
          />
        </div>

        <div className="marker-modal-field">
          <label className="marker-modal-label">Icon</label>
          <div className="marker-emoji-grid">
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                className={`marker-emoji-btn ${icon === e ? 'selected' : ''}`}
                onClick={() => setIcon(e)}
                aria-label={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="marker-modal-field">
          <label className="marker-modal-label">Color</label>
          <div className="marker-color-grid">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`marker-color-btn ${color === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="marker-modal-actions">
          {isEditing && (
            <button className="marker-btn marker-btn-delete" onClick={handleDelete}>
              Delete
            </button>
          )}
          <button className="marker-btn marker-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="marker-btn marker-btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
