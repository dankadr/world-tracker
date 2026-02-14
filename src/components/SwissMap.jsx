import { useRef, useCallback, useEffect } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';

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
      const id = feature.properties.id;
      return visited.has(id) ? { ...visitedStyle } : { ...UNVISITED_STYLE };
    },
    [visited, country.visitedColor]
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
          target.setStyle(visited.has(id) ? hoverVisited : hoverUnvisited);
          target.bringToFront();
        },
        mouseout: (e) => {
          const target = e.target;
          target.setStyle(visited.has(id) ? visitedStyle : UNVISITED_STYLE);
        },
        click: () => {
          onToggle(id);
        },
      });
    },
    [visited, onToggle, country.visitedColor]
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
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  );
}
