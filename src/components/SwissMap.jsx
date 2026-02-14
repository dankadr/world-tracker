import { useRef, useCallback, useEffect } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

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

  // Style for polygons
  const style = useCallback(
    (feature) => {
      if (feature.geometry.type === 'Point') return {};
      const id = feature.properties.id;
      return visited.has(id) ? { ...visitedStyle } : { ...UNVISITED_STYLE };
    },
    [visited, country.visitedColor]
  );

  // Convert Point features to circle markers
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

      layer.bindTooltip(name, {
        sticky: true,
        className: 'canton-tooltip',
        direction: 'top',
        offset: [0, -10],
      });

      layer.on({
        mouseover: (e) => {
          const target = e.target;
          if (feature.geometry.type === 'Point') {
            target.setStyle({
              radius: isPointMode ? 11 : 8,
              fillOpacity: 0.9,
              weight: 3,
            });
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
        click: () => {
          onToggle(id);
        },
      });
    },
    [visited, onToggle, country.visitedColor, isPointMode]
  );

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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
      />
      <GeoJSON
        key={country.id + '-' + JSON.stringify([...visited])}
        ref={geoJsonRef}
        data={country.data}
        style={style}
        pointToLayer={pointToLayer}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
