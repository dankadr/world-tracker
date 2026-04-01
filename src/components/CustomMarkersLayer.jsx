import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import MarkerEditModal from './MarkerEditModal';
import './CustomMarkersLayer.css';

const LONG_PRESS_MS = 500;
const PANE_NAME = 'customMarkersPane';

function makeIcon(icon, color) {
  return L.divIcon({
    html: `<div class="cm-dot" style="background:${color}"><span class="cm-emoji">${icon}</span></div>`,
    className: 'cm-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export default function CustomMarkersLayer({ markers, visible, onAdd, onUpdate, onDelete }) {
  const map = useMap();
  const layerGroupRef = useRef(null);
  const longPressRef = useRef(null);
  const [modalState, setModalState] = useState(null); // { mode: 'add'|'edit', lat, lng, marker }

  // Create pane once
  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME);
      map.getPane(PANE_NAME).style.zIndex = 620;
    }
    const group = L.layerGroup([], { pane: PANE_NAME });
    map.addLayer(group);
    layerGroupRef.current = group;
    return () => {
      map.removeLayer(group);
    };
  }, [map]);

  // Sync markers to the layer group
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!visible) return;

    (markers || []).forEach((m) => {
      const leafletMarker = L.marker([m.lat, m.lng], {
        icon: makeIcon(m.icon || '📍', m.color || '#c9a84c'),
        pane: PANE_NAME,
      });
      leafletMarker.on('click', () => {
        setModalState({ mode: 'edit', marker: m });
      });
      leafletMarker.addTo(group);
    });
  }, [markers, visible, map]);

  // Long-press handler on map container to add a marker
  useEffect(() => {
    const container = map.getContainer();

    function onContextMenu(e) {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const latlng = map.containerPointToLatLng(L.point(e.clientX - rect.left, e.clientY - rect.top));
      setModalState({ mode: 'add', lat: latlng.lat, lng: latlng.lng, marker: null });
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      longPressRef.current = setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const latlng = map.containerPointToLatLng(L.point(startX - rect.left, startY - rect.top));
        setModalState({ mode: 'add', lat: latlng.lat, lng: latlng.lng, marker: null });
        longPressRef.current = null;
      }, LONG_PRESS_MS);
    }

    function onTouchMove() {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }

    function onTouchEnd() {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }

    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [map]);

  const handleSave = async ({ label, icon, color }) => {
    if (!modalState) return;
    if (modalState.mode === 'add') {
      await onAdd({ lat: modalState.lat, lng: modalState.lng, label, icon, color });
    } else if (modalState.mode === 'edit') {
      await onUpdate(modalState.marker.id, { label, icon, color });
    }
    setModalState(null);
  };

  const handleDelete = async () => {
    if (!modalState?.marker) return;
    await onDelete(modalState.marker.id);
    setModalState(null);
  };

  const modalMarker = modalState?.mode === 'add'
    ? { lat: modalState.lat, lng: modalState.lng, icon: '📍', color: '#c9a84c', label: '' }
    : modalState?.marker;

  return modalState ? (
    <MarkerEditModal
      marker={modalMarker}
      onSave={handleSave}
      onDelete={modalState.mode === 'edit' ? handleDelete : undefined}
      onClose={() => setModalState(null)}
    />
  ) : null;
}
