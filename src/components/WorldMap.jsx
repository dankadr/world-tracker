import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import MapLayerControl, { LAYERS } from './MapLayerControl';
import worldData from '../data/world.json';
import { applyEasterEggModifications, isGreaterIsraelEnabled } from '../utils/easterEggs';

const VISITED_COLOR = '#2ecc71';
const VISITED_HOVER = '#27ae60';

const TRACKED_COUNTRY_IDS = {
  ch: 'ch',
  us: 'us',
  no: 'no',
  ca: 'ca',
};

const UNVISITED_STYLE = {
  fillColor: '#cfd8dc',
  fillOpacity: 0.4,
  color: 'rgba(0, 0, 0, 0.1)',
  weight: 0.5,
  lineJoin: 'round',
  lineCap: 'round',
};

const VISITED_STYLE = {
  fillColor: VISITED_COLOR,
  fillOpacity: 0.5,
  color: 'transparent',
  weight: 0,
  lineJoin: 'round',
  lineCap: 'round',
};

const TRACKED_STYLE = {
  fillColor: '#cfd8dc',
  fillOpacity: 0.4,
  color: 'rgba(52, 152, 219, 0.6)',
  weight: 2,
  dashArray: '4 3',
  lineJoin: 'round',
  lineCap: 'round',
};

const TRACKED_VISITED_STYLE = {
  fillColor: VISITED_COLOR,
  fillOpacity: 0.5,
  color: 'rgba(52, 152, 219, 0.6)',
  weight: 2,
  dashArray: '4 3',
  lineJoin: 'round',
  lineCap: 'round',
};

function MapController({ center, zoom }) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      map.setView(center, zoom);
      initialized.current = true;
    }
  }, [map, center, zoom]);
  return null;
}

export default function WorldMap({ visited, onToggle, onExploreCountry }) {
  const geoJsonRef = useRef(null);
  const { dark } = useTheme();
  const [tileUrl, setTileUrl] = useState(
    dark ? LAYERS[0].dark : LAYERS[0].light
  );
  const [greaterIsraelEnabled, setGreaterIsraelEnabled] = useState(() => isGreaterIsraelEnabled());

  // Listen for easter egg toggles
  useEffect(() => {
    function handleEasterEggToggle(e) {
      if (e.detail === 'greater-israel') {
        setGreaterIsraelEnabled(isGreaterIsraelEnabled());
      }
    }
    window.addEventListener('easter-egg-toggle', handleEasterEggToggle);
    return () => window.removeEventListener('easter-egg-toggle', handleEasterEggToggle);
  }, []);

  useEffect(() => {
    setTileUrl((prev) => {
      const layer = LAYERS.find((l) => l.light === prev || l.dark === prev);
      if (layer) return dark ? layer.dark : layer.light;
      return dark ? LAYERS[0].dark : LAYERS[0].light;
    });
  }, [dark]);

  // Apply easter egg modifications to world data
  const modifiedWorldData = useMemo(
    () => applyEasterEggModifications(worldData, greaterIsraelEnabled),
    [greaterIsraelEnabled]
  );

  // Update GeoJSON styles when visited set changes (without remounting)
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.eachLayer((l) => {
      const id = l.feature?.properties?.id;
      if (!id) return;
      const isVisited = visited.has(id);
      const isTracked = id in TRACKED_COUNTRY_IDS;
      const isGreaterIsrael = greaterIsraelEnabled && id === 'il';
      let style;
      if (isVisited && isTracked) style = TRACKED_VISITED_STYLE;
      else if (isVisited) style = VISITED_STYLE;
      else if (isTracked) style = TRACKED_STYLE;
      else style = UNVISITED_STYLE;
      if (isGreaterIsrael) {
        style = { ...style, color: 'transparent', weight: 0 };
      }
      l.setStyle(style);
    });
  }, [visited, greaterIsraelEnabled]);

  const getStyle = useCallback(
    (feature) => {
      const id = feature.properties.id;
      const isVisited = visited.has(id);
      const isTracked = id in TRACKED_COUNTRY_IDS;
      const isGreaterIsrael = greaterIsraelEnabled && id === 'il';

      let style;
      if (isVisited && isTracked) style = { ...TRACKED_VISITED_STYLE };
      else if (isVisited) style = { ...VISITED_STYLE };
      else if (isTracked) style = { ...TRACKED_STYLE };
      else style = { ...UNVISITED_STYLE };

      if (isGreaterIsrael) {
        style.color = 'transparent';
        style.weight = 0;
      }

      return style;
    },
    [visited, greaterIsraelEnabled]
  );

  const onEachFeature = useCallback(
    (feature, layer) => {
      const { id, name } = feature.properties;
      const isTracked = id in TRACKED_COUNTRY_IDS;
      const isGreaterIsrael = greaterIsraelEnabled && id === 'il';

      layer.bindTooltip(name, {
        sticky: true,
        className: 'canton-tooltip',
        direction: 'top',
        offset: [0, -10],
      });

      layer.on({
        mouseover: (e) => {
          const target = e.target;
          const isVisited = visited.has(id);
          target.setStyle({
            fillColor: isVisited ? VISITED_HOVER : '#b0bec5',
            fillOpacity: isVisited ? 0.7 : 0.55,
            color: isGreaterIsrael ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
            weight: isGreaterIsrael ? 0 : 2,
          });
          target.bringToFront();
        },
        mouseout: (e) => {
          const target = e.target;
          const isVisited = visited.has(id);
          let style;
          if (isVisited && isTracked) style = TRACKED_VISITED_STYLE;
          else if (isVisited) style = VISITED_STYLE;
          else if (isTracked) style = TRACKED_STYLE;
          else style = UNVISITED_STYLE;
          if (isGreaterIsrael) {
            style = { ...style, color: 'transparent', weight: 0 };
          }
          target.setStyle(style);
        },
        click: (e) => {
          if (isTracked) {
            const isVisited = visited.has(id);
            const trackerId = TRACKED_COUNTRY_IDS[id];
            const statusHtml = isVisited
              ? '<span class="world-popup-status visited">Visited</span>'
              : '<span class="world-popup-status">Not visited</span>';
            const html = `<div class="world-popup-content">
              <strong class="world-popup-name">${name}</strong>
              ${statusHtml}
              <div class="world-popup-actions">
                <button class="world-popup-toggle" onclick="document.dispatchEvent(new CustomEvent('world-toggle',{detail:'${id}'}))">${isVisited ? 'Mark unvisited' : 'Mark visited'}</button>
                <button class="world-popup-explore" onclick="document.dispatchEvent(new CustomEvent('world-explore',{detail:'${trackerId}'}))">Explore Regions &rarr;</button>
              </div>
            </div>`;
            L.popup({ className: 'world-country-popup', closeButton: true, offset: [0, -5] })
              .setLatLng(e.latlng)
              .setContent(html)
              .openOn(e.target._map);
          } else {
            onToggle(id);
            const target = e.target;
            const willBeVisited = !visited.has(id);
            const finalStyle = willBeVisited ? VISITED_STYLE : UNVISITED_STYLE;
            target.setStyle({
              fillOpacity: 0.85,
              weight: 2,
              color: 'rgba(255,255,255,0.7)',
            });
            setTimeout(() => target.setStyle({ fillOpacity: 0.7, weight: 1.5 }), 120);
            setTimeout(() => target.setStyle({ fillOpacity: 0.6, weight: 1 }), 250);
            setTimeout(() => target.setStyle(finalStyle), 400);
          }
        },
      });
    },
    [visited, onToggle]
  );

  useEffect(() => {
    function handleToggle(e) {
      onToggle(e.detail);
    }
    function handleExplore(e) {
      onExploreCountry(e.detail);
    }
    document.addEventListener('world-toggle', handleToggle);
    document.addEventListener('world-explore', handleExplore);
    return () => {
      document.removeEventListener('world-toggle', handleToggle);
      document.removeEventListener('world-explore', handleExplore);
    };
  }, [onToggle, onExploreCountry]);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="swiss-map world-map"
      zoomControl={true}
      scrollWheelZoom={true}
      minZoom={2}
      maxZoom={8}
    >
      <MapController center={[20, 0]} zoom={2} />
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        url={tileUrl}
      />
      <GeoJSON
        key={`world-geojson-${greaterIsraelEnabled}`}
        ref={geoJsonRef}
        data={modifiedWorldData}
        style={getStyle}
        onEachFeature={onEachFeature}
      />
      <MapLayerControl onLayerChange={setTileUrl} />
    </MapContainer>
  );
}
