import { useRef, useCallback } from 'react';

/**
 * useSwipeToDismiss — adds swipe-down-to-dismiss behavior to modals.
 *
 * Returns handlers to attach to the modal's drag handle area.
 * When the user drags down past the threshold (30% of modal height),
 * `onDismiss` is called.
 *
 * Usage:
 *   const { handleRef, dragHandlers } = useSwipeToDismiss(onClose);
 *   <div className="modal-content" ref={handleRef}>
 *     <div className="modal-header" {...dragHandlers}>...</div>
 *   </div>
 */
export default function useSwipeToDismiss(onDismiss) {
  const modalRef = useRef(null);
  const dragState = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (!e.touches?.length) return;
    dragState.current = {
      startY: e.touches[0].clientY,
      moved: false,
    };
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragState.current || !modalRef.current) return;
    const deltaY = e.touches[0].clientY - dragState.current.startY;

    // Only track downward movement
    if (deltaY <= 0) {
      modalRef.current.style.transform = '';
      modalRef.current.style.opacity = '';
      return;
    }

    dragState.current.moved = true;
    const modalHeight = modalRef.current.offsetHeight;
    const progress = Math.min(deltaY / modalHeight, 1);

    modalRef.current.style.transition = 'none';
    modalRef.current.style.transform = `translateY(${deltaY}px)`;
    modalRef.current.style.opacity = `${1 - progress * 0.5}`;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!dragState.current || !modalRef.current) return;
    const deltaY = e.changedTouches[0].clientY - dragState.current.startY;
    const modalHeight = modalRef.current.offsetHeight;
    const progress = deltaY / modalHeight;

    if (progress > 0.3 && dragState.current.moved) {
      // Dismiss — animate out
      modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease';
      modalRef.current.style.transform = `translateY(${modalHeight}px)`;
      modalRef.current.style.opacity = '0';
      setTimeout(() => onDismiss(), 300);
    } else {
      // Snap back
      modalRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease';
      modalRef.current.style.transform = '';
      modalRef.current.style.opacity = '';
    }

    dragState.current = null;
  }, [onDismiss]);

  return {
    handleRef: modalRef,
    dragHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
