import { createPortal } from 'react-dom';
import './ActionSheet.css';

export default function ActionSheet({ isOpen, title, message, actions = [], onCancel }) {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onCancel?.();
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return createPortal(
    <div className="action-sheet-overlay" onClick={handleOverlayClick}>
      <div className="action-sheet-container" onClick={handleContainerClick}>
        <div className="action-sheet-main">
          {(title || message) && (
            <div className="action-sheet-header">
              {title && <div className="action-sheet-title">{title}</div>}
              {message && <div className="action-sheet-message">{message}</div>}
            </div>
          )}
          <div className="action-sheet-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`action-sheet-btn${action.destructive ? ' destructive' : ''}`}
                onClick={() => {
                  action.onPress?.();
                  onCancel?.();
                }}
              >
                {action.icon && <span className="action-sheet-btn-icon">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        </div>
        <button className="action-sheet-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
