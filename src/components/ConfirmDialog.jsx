import { createPortal } from 'react-dom';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';
import { haptics } from '../utils/haptics';
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
  const handleCancel = () => {
    haptics.selection();
    onCancel?.();
  };

  const handleConfirm = () => {
    haptics.confirmation();
    onConfirm?.();
  };

  const { handleRef, dragHandlers } = useSwipeToDismiss(handleCancel);

  if (!isOpen) return null;

  return createPortal(
    <div className="confirm-dialog-overlay" onClick={handleCancel}>
      <div className="confirm-dialog" ref={handleRef} onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-handle" {...dragHandlers} />
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-btn cancel" onClick={handleCancel}>
            {cancelLabel}
          </button>
          <button
            className={`confirm-dialog-btn confirm ${destructive ? 'destructive' : ''}`}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
