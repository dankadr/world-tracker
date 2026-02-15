import { useState, useCallback } from 'react';

const STORAGE_KEY = 'swiss-tracker-colors';

function loadColors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveColors(colors) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

// Darken a hex color by a factor (0-1)
function darken(hex, factor = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

export default function useCustomColors() {
  const [colors, setColors] = useState(() => loadColors());

  const setColor = useCallback((countryId, color) => {
    setColors((prev) => {
      const next = { ...prev };
      if (color) {
        next[countryId] = color;
      } else {
        delete next[countryId];
      }
      saveColors(next);
      return next;
    });
  }, []);

  // Apply custom colors to a country config
  const applyColors = useCallback(
    (country) => {
      const custom = colors[country.id];
      if (!custom) return country;
      return {
        ...country,
        visitedColor: custom,
        visitedHover: darken(custom),
      };
    },
    [colors]
  );

  return { colors, setColor, applyColors };
}
