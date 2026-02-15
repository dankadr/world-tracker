import { useRef, useCallback, useEffect, useState } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import MapLayerControl, { LAYERS } from './MapLayerControl';

const UNVISITED_STYLE = {
  fillColor: '#d5dbe0',
  fillOpacity: 0.6,
  color: '#ffffff',
  weight: 2,
};

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function RegionMap({ country, visited, onToggle }) {
  const geoJsonRef = useRef(null);
  const isPointMode = country.pointMode;
  const { dark } = useTheme();
  const [tileUrl, setTileUrl] = useState(
    dark ? LAYERS[0].dark : LAYERS[0].light
  );

  // Sync default tile when theme changes
  useEffect(() => {
    setTileUrl((prev) => {
      const layer = LAYERS.find((l) => l.light === prev || l.dark === prev);
      if (layer) return dark ? layer.dark : layer.light;
      return dark ? LAYERS[0].dark : LAYERS[0].light;
    });
  }, [dark]);

  const visitedStyle = {
    fillColor: country.visitedColor,
    fillOpacity: 0.55,
    color: '#ffffff',
    weight: 2,
  };

  const hoverVisited = {
    fillColor: country.visitedHover,
    fillOpacity: 0.75,
    weight: 3,
  };

  const hoverUnvisited = {
    fillColor: '#bdc3c7',
    fillOpacity: 0.75,
    weight: 3,
  };

  const style = useCallback(
    (feature) => {
      if (feature.geometry.type === 'Point') return {};
      const id = feature.properties.id;
      return visited.has(id) ? { ...visitedStyle } : { ...UNVISITED_STYLE };
    },
    [visited, country.visitedColor]
  );

  const pointToLayer = useCallback(
    (feature, latlng) => {
      const id = feature.properties.id;
      const isVisited = visited.has(id);
      const radius = isPointMode ? 8 : 6;
      return L.circleMarker(latlng, {
        radius,
        fillColor: isVisited ? country.visitedColor : '#d5dbe0',
        fillOpacity: isVisited ? 0.85 : 0.6,
        color: '#ffffff',
        weight: 2,
      });
    },
    [visited, country.visitedColor, isPointMode]
  );

  const onEachFeature = useCallback(
    (feature, layer) => {
      const { id, name } = feature.properties;

      const tooltipText = feature.properties.borough
        ? `${name} (${feature.properties.borough})`
        : name;

      layer.bindTooltip(tooltipText, {
        sticky: true,
        className: 'canton-tooltip',
        direction: 'top',
        offset: [0, -10],
      });

      layer.on({
        mouseover: (e) => {
          const target = e.target;
          if (feature.geometry.type === 'Point') {
            target.setStyle({ radius: isPointMode ? 11 : 8, fillOpacity: 0.9, weight: 3 });
          } else {
            target.setStyle(visited.has(id) ? hoverVisited : hoverUnvisited);
            target.bringToFront();
          }
        },
        mouseout: (e) => {
          const target = e.target;
          if (feature.geometry.type === 'Point') {
            const isVisited = visited.has(id);
            target.setStyle({
              radius: isPointMode ? 8 : 6,
              fillColor: isVisited ? country.visitedColor : '#d5dbe0',
              fillOpacity: isVisited ? 0.85 : 0.6,
              weight: 2,
            });
          } else {
            target.setStyle(visited.has(id) ? visitedStyle : UNVISITED_STYLE);
          }
        },
        click: () => { onToggle(id); },
      });
    },
    [visited, onToggle, country.visitedColor, isPointMode]
  );

  // Split data: regions (interactive) vs borough outlines (non-interactive)
  const regionData = {
    type: 'FeatureCollection',
    features: country.data.features.filter((f) => !f.properties.isBorough),
  };
  const boroughData = {
    type: 'FeatureCollection',
    features: country.data.features.filter((f) => f.properties.isBorough),
  };
  const hasBoroughs = boroughData.features.length > 0;

  const boroughStyle = {
    fillColor: 'transparent',
    fillOpacity: 0,
    color: dark ? '#ecf0f1' : '#1a1a2e',
    weight: 3,
  };

  const boroughOnEach = useCallback((feature, layer) => {
    layer.bindTooltip(feature.properties.name, {
      sticky: false,
      className: 'canton-tooltip',
      direction: 'center',
    });
    // Make non-interactive: clicks pass through to regions below
    layer.options.interactive = false;
  }, []);

  return (
    <MapContainer
      center={country.center}
      zoom={country.zoom}
      className="swiss-map"
      zoomControl={true}
      scrollWheelZoom={true}
      minZoom={country.minZoom}
      maxZoom={country.maxZoom}
    >
      <MapController center={country.center} zoom={country.zoom} />
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        url={tileUrl}
      />
      <GeoJSON
        key={country.id + '-' + JSON.stringify([...visited])}
        ref={geoJsonRef}
        data={regionData}
        style={style}
        pointToLayer={pointToLayer}
        onEachFeature={onEachFeature}
      />
      {hasBoroughs && (
        <GeoJSON
          key={country.id + '-boroughs'}
          data={boroughData}
          style={() => boroughStyle}
          onEachFeature={boroughOnEach}
        />
      )}
      <MapLayerControl onLayerChange={setTileUrl} />
    </MapContainer>
  );
}
