import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import LAYERS from '../config/mapLayers.json';

export default function MapLayerControl({ onLayerChange }) {
  const [active, setActive] = useState('clean');
  const [open, setOpen] = useState(false);
  const { dark } = useTheme();

  const handleSelect = (layer) => {
    setActive(layer.id);
    onLayerChange(dark ? layer.dark : layer.light);
    setOpen(false);
  };

  return (
    <div className="layer-control">
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
          {LAYERS.map((l) => (
            <button
              key={l.id}
              className={`layer-option ${l.id === active ? 'active' : ''}`}
              onClick={() => handleSelect(l)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { LAYERS };
