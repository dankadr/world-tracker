import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ActionSheet.css';

export default function ActionSheet({ isOpen, title, message, actions = [], onCancel, ariaLabel }) {
  const titleId = useId();
  const messageId = useId();
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancelRef.current?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    onCancel?.();
  };

  const handleContainerClick = (e) => {
    e.stopPropagation();
  };

  return createPortal(
    <div className="action-sheet-overlay" onClick={handleOverlayClick}>
      <div
        className="action-sheet-container"
        role="dialog"
        aria-modal="true"
        aria-label={!title ? (ariaLabel ?? 'Action sheet') : undefined}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={message ? messageId : undefined}
        onClick={handleContainerClick}
      >
        <div className="action-sheet-main">
          {(title || message) && (
            <div className="action-sheet-header">
              {title && <div id={titleId} className="action-sheet-title">{title}</div>}
              {message && <div id={messageId} className="action-sheet-message">{message}</div>}
            </div>
          )}
          <div className="action-sheet-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                className={`action-sheet-btn${action.destructive ? ' destructive' : ''}`}
                onClick={async () => {
                  try {
                    if (action.onPress) {
                      await Promise.resolve(action.onPress());
                    }
                  } catch (error) {
                    console.error('Error in ActionSheet action onPress', error);
                  } finally {
                    onCancel?.();
                  }
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
