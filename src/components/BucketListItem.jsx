import { useState } from 'react';

const PRIORITY_LABELS = { high: '🔴', medium: '🟡', low: '🟢' };
const CATEGORY_LABELS = { solo: '🧑', friends: '👥', family: '👨‍👩‍👧', work: '💼' };
const CATEGORY_NAMES = { solo: 'Solo', friends: 'Friends', family: 'Family', work: 'Work' };

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const [year, month] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1);
  const now = new Date();
  const diffMs = target - now;
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  if (diffMonths < 0) return `${Math.abs(diffMonths)}mo ago`;
  if (diffMonths === 0) return 'this month';
  if (diffMonths === 1) return 'next month';
  if (diffMonths < 12) return `in ${diffMonths}mo`;
  const years = Math.floor(diffMonths / 12);
  const remaining = diffMonths % 12;
  if (remaining === 0) return `in ${years}y`;
  return `in ${years}y ${remaining}mo`;
}

export default function BucketListItem({
  item,
  regionName,
  trackerFlag,
  onUpdate,
  onDelete,
  onMarkVisited,
}) {
  const [editing, setEditing] = useState(false);
  const [editPriority, setEditPriority] = useState(item.priority);
  const [editDate, setEditDate] = useState(item.target_date || '');
  const [editNotes, setEditNotes] = useState(item.notes || '');
  const [editCategory, setEditCategory] = useState(item.category || 'solo');
  const [expanded, setExpanded] = useState(false);

  const handleSave = () => {
    onUpdate(item.tracker_id, item.region_id, {
      priority: editPriority,
      target_date: editDate || null,
      notes: editNotes || null,
      category: editCategory,
    });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditPriority(item.priority);
    setEditDate(item.target_date || '');
    setEditNotes(item.notes || '');
    setEditCategory(item.category || 'solo');
    setEditing(false);
  };

  const rel = relativeTime(item.target_date);

  if (editing) {
    return (
      <div className="bucket-item bucket-item-editing">
        <div className="bucket-item-header">
          <span className="bucket-item-flag">{trackerFlag}</span>
          <span className="bucket-item-name">{regionName}</span>
        </div>
        <div className="bucket-edit-fields">
          <div className="bucket-edit-row">
            <label className="bucket-edit-label">Priority</label>
            <div className="bucket-priority-picker">
              {['high', 'medium', 'low'].map((p) => (
                <button
                  key={p}
                  className={`bucket-priority-btn ${editPriority === p ? 'active' : ''}`}
                  onClick={() => setEditPriority(p)}
                >
                  {PRIORITY_LABELS[p]} {p}
                </button>
              ))}
            </div>
          </div>
          <div className="bucket-edit-row">
            <label className="bucket-edit-label">Target date</label>
            <input
              type="month"
              className="bucket-date-input"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
          </div>
          <div className="bucket-edit-row">
            <label className="bucket-edit-label">Category</label>
            <div className="bucket-category-picker">
              {Object.entries(CATEGORY_NAMES).map(([key, name]) => (
                <button
                  key={key}
                  className={`bucket-category-btn ${editCategory === key ? 'active' : ''}`}
                  onClick={() => setEditCategory(key)}
                >
                  {CATEGORY_LABELS[key]} {name}
                </button>
              ))}
            </div>
          </div>
          <div className="bucket-edit-row">
            <label className="bucket-edit-label">Notes</label>
            <textarea
              className="bucket-notes-input"
              placeholder="Add travel notes..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="bucket-edit-actions">
            <button className="bucket-btn bucket-btn-save" onClick={handleSave}>Save</button>
            <button className="bucket-btn bucket-btn-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bucket-item bucket-priority-${item.priority}`}>
      <div className="bucket-item-main" onClick={() => setExpanded(!expanded)}>
        <span className="bucket-item-priority">{PRIORITY_LABELS[item.priority]}</span>
        <div className="bucket-item-info">
          <div className="bucket-item-top">
            <span className="bucket-item-flag">{trackerFlag}</span>
            <span className="bucket-item-name">{regionName}</span>
          </div>
          <div className="bucket-item-meta">
            {item.target_date && (
              <span className="bucket-item-date" title={item.target_date}>
                📅 {rel}
              </span>
            )}
            {item.category && item.category !== 'solo' && (
              <span className="bucket-item-category">
                {CATEGORY_LABELS[item.category]} {CATEGORY_NAMES[item.category]}
              </span>
            )}
            {item.notes && <span className="bucket-item-has-notes">📝</span>}
          </div>
        </div>
        <span className="bucket-item-expand">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="bucket-item-details">
          {item.notes && <p className="bucket-item-notes-preview">{item.notes}</p>}
          <div className="bucket-item-actions">
            <button className="bucket-btn bucket-btn-visit" onClick={() => onMarkVisited(item.tracker_id, item.region_id)}>
              ✓ Mark Visited
            </button>
            <button className="bucket-btn bucket-btn-edit" onClick={() => setEditing(true)}>
              ✏️ Edit
            </button>
            <button className="bucket-btn bucket-btn-delete" onClick={() => onDelete(item.tracker_id, item.region_id)}>
              🗑️ Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
