import { createPortal } from 'react-dom';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  isOpen,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = true,
}) {
  const { handleRef, dragHandlers } = useSwipeToDismiss(onCancel);

  if (!isOpen) return null;

  return createPortal(
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" ref={handleRef} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-handle" {...dragHandlers} />
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`confirm-dialog-btn confirm ${destructive ? 'destructive' : ''}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
