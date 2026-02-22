import { useState } from 'react';

const PRIORITY_LABELS = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
const CATEGORY_OPTIONS = [
  { key: 'solo', label: '🧑 Solo' },
  { key: 'friends', label: '👥 Friends' },
  { key: 'family', label: '👨‍👩‍👧 Family' },
  { key: 'work', label: '💼 Work' },
];

export default function AddToBucketListModal({ isOpen, onClose, onAdd, regionName, trackerId, regionId, trackerFlag }) {
  const [priority, setPriority] = useState('medium');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('solo');

  if (!isOpen) return null;

  const handleAdd = () => {
    onAdd(trackerId, regionId, {
      priority,
      target_date: targetDate || null,
      notes: notes.trim() || null,
      category,
    });
    // Reset
    setPriority('medium');
    setTargetDate('');
    setNotes('');
    setCategory('solo');
    onClose();
  };

  const handleQuickAdd = () => {
    onAdd(trackerId, regionId, {
      priority: 'medium',
      target_date: null,
      notes: null,
      category: 'solo',
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bucket-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📌 Add to Bucket List</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="bucket-modal-body">
          <div className="bucket-modal-region">
            <span className="bucket-modal-flag">{trackerFlag}</span>
            <span className="bucket-modal-name">{regionName}</span>
          </div>

          <div className="bucket-modal-field">
            <label className="bucket-modal-label">Priority</label>
            <div className="bucket-priority-picker">
              {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  className={`bucket-priority-btn ${priority === key ? 'active' : ''}`}
                  onClick={() => setPriority(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bucket-modal-field">
            <label className="bucket-modal-label">Target date</label>
            <input
              type="month"
              className="bucket-date-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="bucket-modal-field">
            <label className="bucket-modal-label">Category</label>
            <div className="bucket-category-picker">
              {CATEGORY_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`bucket-category-btn ${category === key ? 'active' : ''}`}
                  onClick={() => setCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bucket-modal-field">
            <label className="bucket-modal-label">Notes</label>
            <textarea
              className="bucket-notes-input"
              placeholder="Cherry blossom season, best restaurants..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="bucket-modal-actions">
            <button className="bucket-btn bucket-btn-add" onClick={handleAdd}>
              📌 Add to Bucket List
            </button>
            <button className="bucket-btn bucket-btn-quick" onClick={handleQuickAdd}>
              ⚡ Quick Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
