// src/components/SwipeableModal.jsx
import { useEffect } from 'react';
import { haptics } from '../utils/haptics';
import useSwipeToDismiss from '../hooks/useSwipeToDismiss';

/**
 * SwipeableModal — drop-in replacement for the modal-overlay + modal-content
 * pattern used in App.jsx. Adds swipe-down-to-dismiss on mobile automatically.
 *
 * Usage:
 *   <SwipeableModal onClose={handleClose} height="80vh" maxWidth={420}>
 *     <MyPanel onClose={handleClose} />
 *   </SwipeableModal>
 */
export default function SwipeableModal({ onClose, children, maxWidth = 420, height = '80vh', className = '' }) {
  const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);

  useEffect(() => {
    haptics.action();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={['modal-content', className].filter(Boolean).join(' ')}
        ref={handleRef}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth, height }}
      >
        <div className="swipeable-drag-strip" {...dragHandlers}>
          <div className="drag-handle" />
        </div>
        {children}
      </div>
    </div>
  );
}
