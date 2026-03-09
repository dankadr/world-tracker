import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import LAYERS from '../config/mapLayers.json';

const BASE_LAYERS = LAYERS.filter((l) => !l.overlay);
const OVERLAY_LAYERS = LAYERS.filter((l) => l.overlay);

export default function MapLayerControl({
  onLayerChange,
  onFriendsToggle,
  friendsActive,
  onWishlistToggle,
  wishlistActive,
  onUnescoToggle,
  unescoActive,
}) {
  const [active, setActive] = useState('labels');
  const [open, setOpen] = useState(false);
  const { dark } = useTheme();
  const wrapperRef = useRef(null);

  // Click outside to close dropdown
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open]);

  const handleSelect = (layer) => {
    setActive(layer.id);
    onLayerChange(dark ? layer.dark : layer.light);
    setOpen(false);
  };

  return (
    <div className="layer-control" ref={wrapperRef}>
      <button
        className="layer-control-btn"
        onClick={() => setOpen(!open)}
        title="Map style"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      </button>
      {open && (
        <div className="layer-options">
          {BASE_LAYERS.map((l) => (
            <button
              key={l.id}
              className={`layer-option ${l.id === active ? 'active' : ''}`}
              onClick={() => handleSelect(l)}
            >
              {l.label}
            </button>
          ))}
          {OVERLAY_LAYERS.map((l) => {
            const handlers = {
              friends: onFriendsToggle,
              wishlist: onWishlistToggle,
              unesco: onUnescoToggle,
            };
            const states = {
              friends: friendsActive,
              wishlist: wishlistActive,
              unesco: unescoActive,
            };
            const handler = handlers[l.id];
            if (!handler) return null;
            return (
              <button
                key={l.id}
                className={`layer-option layer-option-overlay ${states[l.id] ? 'active' : ''}`}
                onClick={() => handler(!states[l.id])}
              >
                {l.icon && <span className="layer-option-icon">{l.icon}</span>}
                {l.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { LAYERS };
