import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import './RouteOverlay.css';

const ROUTE_COLOR = '#c9a84c';
const PANE_NAME = 'routePane';

export default function RouteOverlay({ routePoints, totalDistanceKm, onClear }) {
  const map = useMap();
  const polylineRef = useRef(null);
  const markersRef = useRef([]);

  // Create pane once
  useEffect(() => {
    if (!map.getPane(PANE_NAME)) {
      map.createPane(PANE_NAME);
      map.getPane(PANE_NAME).style.zIndex = 610;
    }
  }, [map]);

  // Draw polyline and circle markers
  useEffect(() => {
    // Remove old layers
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (!routePoints || routePoints.length === 0) return;

    const latlngs = routePoints.map((p) => [p.lat, p.lng]);

    if (latlngs.length >= 2) {
      polylineRef.current = L.polyline(latlngs, {
        color: ROUTE_COLOR,
        weight: 3,
        dashArray: '8, 12',
        opacity: 0.9,
        pane: PANE_NAME,
      }).addTo(map);
    }

    routePoints.forEach((p, i) => {
      const cm = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        fillColor: ROUTE_COLOR,
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
        pane: PANE_NAME,
      });
      if (p.label) {
        cm.bindTooltip(`${i + 1}. ${p.label}`, {
          permanent: false,
          direction: 'top',
          className: 'canton-tooltip',
          offset: [0, -10],
        });
      }
      cm.addTo(map);
      markersRef.current.push(cm);
    });

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];
    };
  }, [routePoints, map]);

  if (!routePoints || routePoints.length === 0) return null;

  return (
    <div className="route-overlay-panel">
      <div className="route-overlay-info">
        <span className="route-overlay-stops">{routePoints.length} stop{routePoints.length !== 1 ? 's' : ''}</span>
        {totalDistanceKm > 0 && (
          <span className="route-overlay-dist">
            {totalDistanceKm.toLocaleString()} km
          </span>
        )}
      </div>
      <button className="route-overlay-clear" onClick={onClear} title="Clear route">
        Clear Route
      </button>
    </div>
  );
}
