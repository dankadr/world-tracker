import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import MapLayerControl, { LAYERS } from './MapLayerControl';
import FriendOverlayLegend from './FriendOverlayLegend';
import ComparisonLegend from './ComparisonLegend';

const UNVISITED_STYLE = {
  fillColor: '#cfd8dc',
  fillOpacity: 0.4,
  color: 'rgba(0, 0, 0, 0.1)',
  weight: 0.5,
  lineJoin: 'round',
  lineCap: 'round',
};

function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

function pulseLayer(layer, isPoint, isPointMode, finalStyle) {
  if (isPoint) {
    layer.setStyle({ radius: isPointMode ? 12 : 9, fillOpacity: 1, weight: 3 });
    setTimeout(() => layer.setStyle({ radius: isPointMode ? 10 : 7, fillOpacity: 0.9, weight: 2.5 }), 120);
    setTimeout(() => layer.setStyle({ radius: isPointMode ? 8 : 6, fillOpacity: 0.85, weight: 2 }), 250);
    setTimeout(() => layer.setStyle(finalStyle), 400);
  } else {
    layer.setStyle({ fillOpacity: 0.85, weight: 2, color: 'rgba(255,255,255,0.7)' });
    setTimeout(() => layer.setStyle({ fillOpacity: 0.7, weight: 1.5, color: 'rgba(255,255,255,0.4)' }), 120);
    setTimeout(() => layer.setStyle({ fillOpacity: 0.6, weight: 1 }), 250);
    setTimeout(() => layer.setStyle(finalStyle), 400);
  }
}

function FriendsRegionOverlay({ country, friendOverlayData }) {
  // Build map: regionId -> [{ name, color }]
  const friendsByRegion = useMemo(() => {
    const map = {};
    Object.entries(friendOverlayData).forEach(([, data]) => {
      const regions = data.regions || [];
      // Filter to current country's regions
      const countryRegions = regions
        .filter((r) => r.country_id === country.id)
        .flatMap((r) => r.regions || []);
      countryRegions.forEach((regionId) => {
        if (!map[regionId]) map[regionId] = [];
        map[regionId].push({ name: data.name || 'Friend', color: data.color });
      });
    });
    return map;
  }, [friendOverlayData, country.id]);

  const overlayData = useMemo(() => ({
    type: 'FeatureCollection',
    features: country.data.features.filter(
      (f) => !f.properties.isBorough && friendsByRegion[f.properties.id]
    ),
  }), [country.data.features, friendsByRegion]);

  const getStyle = useCallback((feature) => {
    const friends = friendsByRegion[feature.properties.id];
    if (!friends || friends.length === 0) return { fillOpacity: 0, weight: 0 };
    return {
      fillColor: friends[0].color,
      fillOpacity: 0.3,
      color: friends[0].color,
      weight: 1,
      dashArray: '4 3',
    };
  }, [friendsByRegion]);

  const pointToLayer = useCallback((feature, latlng) => {
    const friends = friendsByRegion[feature.properties.id];
    if (!friends || friends.length === 0) return L.circleMarker(latlng, { radius: 0, fillOpacity: 0 });
    return L.circleMarker(latlng, {
      radius: 5,
      fillColor: friends[0].color,
      fillOpacity: 0.4,
      color: friends[0].color,
      weight: 1,
      dashArray: '3 2',
    });
  }, [friendsByRegion]);

  const onEachFeature = useCallback((feature, layer) => {
    const friends = friendsByRegion[feature.properties.id];
    if (!friends) return;
    const names = friends.map((f) => f.name).join(', ');
    layer.bindTooltip(`${feature.properties.name}<br/><span style="opacity:0.7;font-size:0.85em">Visited by: ${names}</span>`, {
      sticky: true,
      className: 'canton-tooltip',
      direction: 'top',
      offset: [0, -10],
    });
    layer.on('click', (e) => { L.DomEvent.stopPropagation(e); });
  }, [friendsByRegion]);

  if (overlayData.features.length === 0) return null;

  return (
    <GeoJSON
      key={`friends-region-overlay-${country.id}-${JSON.stringify(Object.keys(friendOverlayData))}`}
      data={overlayData}
      style={getStyle}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
      pane="overlayPane"
    />
  );
}

const COMPARISON_COLORS = {
  both: '#27AE60',
  onlyMe: '#3498DB',
  onlyFriend: '#E74C3C',
};

function ComparisonRegionOverlay({ country, visited, friendVisited, friendName }) {
  const friendSet = useMemo(() => new Set(friendVisited || []), [friendVisited]);

  const classify = useCallback((id) => {
    const me = visited.has(id);
    const them = friendSet.has(id);
    if (me && them) return 'both';
    if (me) return 'onlyMe';
    if (them) return 'onlyFriend';
    return null;
  }, [visited, friendSet]);

  const overlayData = useMemo(() => ({
    type: 'FeatureCollection',
    features: country.data.features.filter(
      (f) => !f.properties.isBorough && classify(f.properties.id) !== null
    ),
  }), [country.data.features, classify]);

  const getStyle = useCallback((feature) => {
    const cat = classify(feature.properties.id);
    if (!cat) return { fillOpacity: 0, weight: 0 };
    return {
      fillColor: COMPARISON_COLORS[cat],
      fillOpacity: 0.45,
      color: COMPARISON_COLORS[cat],
      weight: 1,
    };
  }, [classify]);

  const pointToLayer = useCallback((feature, latlng) => {
    const cat = classify(feature.properties.id);
    if (!cat) return L.circleMarker(latlng, { radius: 0, fillOpacity: 0 });
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: COMPARISON_COLORS[cat],
      fillOpacity: 0.5,
      color: COMPARISON_COLORS[cat],
      weight: 1.5,
    });
  }, [classify]);

  const onEachFeature = useCallback((feature, layer) => {
    const cat = classify(feature.properties.id);
    const labels = { both: 'Both visited', onlyMe: 'Only you', onlyFriend: `Only ${friendName?.split(' ')[0] || 'friend'}` };
    layer.bindTooltip(
      `${feature.properties.name}<br/><span style="opacity:0.7;font-size:0.85em">${labels[cat] || ''}</span>`,
      { sticky: true, className: 'canton-tooltip', direction: 'top', offset: [0, -10] }
    );
    layer.on('click', (e) => { L.DomEvent.stopPropagation(e); });
  }, [classify, friendName]);

  if (overlayData.features.length === 0) return null;

  return (
    <GeoJSON
      key={`comparison-region-overlay-${country.id}-${visited.size}-${friendSet.size}`}
      data={overlayData}
      style={getStyle}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
      pane="overlayPane"
    />
  );
}

export default function RegionMap({ country, visited, onToggle, wishlist, dates, notes, friendsActive, onFriendsToggle, friendOverlayData, comparisonFriend, onExitComparison, comparisonMode }) {
  const geoJsonRef = useRef(null);
  // Use a ref so the click handler always reads the current value even with stale closures
  const comparisonModeRef = useRef(comparisonMode);
  useEffect(() => { comparisonModeRef.current = comparisonMode; }, [comparisonMode]);
  const isPointMode = country.pointMode;
  const { dark } = useTheme();
  const [tileUrl, setTileUrl] = useState(
    dark ? LAYERS[0].dark : LAYERS[0].light
  );
  const [wishlistActive, setWishlistActive] = useState(true);

  useEffect(() => {
    setTileUrl((prev) => {
      const layer = LAYERS.find((l) => l.light === prev || l.dark === prev);
      if (layer) return dark ? layer.dark : layer.light;
      return dark ? LAYERS[0].dark : LAYERS[0].light;
    });
  }, [dark]);

  const visitedStyle = {
    fillColor: country.visitedColor,
    fillOpacity: 0.5,
    color: 'transparent',
    weight: 0,
    lineJoin: 'round',
    lineCap: 'round',
  };

  const wishlistStyle = {
    fillColor: country.visitedColor,
    fillOpacity: 0.15,
    color: 'rgba(0, 0, 0, 0.08)',
    weight: 0.5,
    dashArray: '5 4',
    lineJoin: 'round',
    lineCap: 'round',
  };

  const hoverVisited = {
    fillColor: country.visitedHover,
    fillOpacity: 0.7,
    color: 'rgba(255, 255, 255, 0.9)',
    weight: 2,
    lineJoin: 'round',
    lineCap: 'round',
  };

  const hoverUnvisited = {
    fillColor: '#b0bec5',
    fillOpacity: 0.55,
    color: 'rgba(255, 255, 255, 0.8)',
    weight: 2,
    lineJoin: 'round',
    lineCap: 'round',
  };

  const hoverWishlist = {
    fillColor: country.visitedColor,
    fillOpacity: 0.3,
    color: 'rgba(255, 255, 255, 0.7)',
    weight: 2,
    dashArray: '5 4',
    lineJoin: 'round',
    lineCap: 'round',
  };

  const style = useCallback(
    (feature) => {
      if (feature.geometry.type === 'Point') return {};
      const id = feature.properties.id;
      if (visited.has(id)) return { ...visitedStyle };
      if (wishlistActive && wishlist?.has(id)) return { ...wishlistStyle };
      return { ...UNVISITED_STYLE };
    },
    [visited, wishlist, country.visitedColor, wishlistActive]
  );

  const pointToLayer = useCallback(
    (feature, latlng) => {
      const id = feature.properties.id;
      const isVisited = visited.has(id);
      const isWishlisted = wishlistActive && wishlist?.has(id);
      const radius = isPointMode ? 7 : 5;
      return L.circleMarker(latlng, {
        radius,
        fillColor: isVisited ? country.visitedColor : isWishlisted ? country.visitedColor : '#b0bec5',
        fillOpacity: isVisited ? 0.8 : isWishlisted ? 0.3 : 0.5,
        color: isVisited ? 'rgba(255,255,255,0.9)' : isWishlisted ? country.visitedColor : 'rgba(255,255,255,0.7)',
        weight: isVisited ? 2 : 1.5,
        dashArray: isWishlisted && !isVisited ? '3 3' : null,
      });
    },
    [visited, wishlist, country.visitedColor, isPointMode]
  );

  const onEachFeature = useCallback(
    (feature, layer) => {
      const { id, name } = feature.properties;
      const isPoint = feature.geometry.type === 'Point';

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
          if (isPoint) {
            target.setStyle({ radius: isPointMode ? 10 : 7, fillOpacity: 0.9, weight: 2.5 });
          } else {
            const isVisited = visited.has(id);
              const isWishlisted = wishlistActive && wishlist?.has(id);
            if (isVisited) target.setStyle(hoverVisited);
            else if (isWishlisted) target.setStyle(hoverWishlist);
            else target.setStyle(hoverUnvisited);
            target.bringToFront();
          }
        },
        mouseout: (e) => {
          const target = e.target;
          if (isPoint) {
            const isVisited = visited.has(id);
            const isWishlisted = wishlistActive && wishlist?.has(id);
            target.setStyle({
              radius: isPointMode ? 7 : 5,
              fillColor: isVisited ? country.visitedColor : isWishlisted ? country.visitedColor : '#b0bec5',
              fillOpacity: isVisited ? 0.8 : isWishlisted ? 0.3 : 0.5,
              weight: isVisited ? 2 : 1.5,
            });
          } else {
            const isVisited = visited.has(id);
            const isWishlisted = wishlistActive && wishlist?.has(id);
            if (isVisited) target.setStyle(visitedStyle);
            else if (isWishlisted) target.setStyle(wishlistStyle);
            else target.setStyle(UNVISITED_STYLE);
          }
        },
        click: (e) => {
          if (comparisonModeRef.current) return;
          const isVisited = visited.has(id);
          if (isVisited && (dates?.[id] || notes?.[id])) {
            const dateStr = dates?.[id] ? `<div style="font-size:0.75rem;color:#95a5a6;margin-top:4px">${dates[id]}</div>` : '';
            const noteStr = notes?.[id] ? `<div style="font-size:0.78rem;margin-top:4px;font-style:italic;color:#7f8c9b">${notes[id]}</div>` : '';
            const html = `<div style="min-width:180px"><strong style="font-size:0.95rem">${name}</strong>${dateStr}${noteStr}<button onclick="this.parentElement.closest('.leaflet-popup').remove();document.dispatchEvent(new CustomEvent('region-uncheck',{detail:'${id}'}))" style="margin-top:8px;font-size:0.82rem;border:none;background:rgba(211,47,47,0.1);color:#d32f2f;padding:10px 16px;border-radius:8px;cursor:pointer;min-height:44px;width:100%;font-weight:600;-webkit-tap-highlight-color:rgba(211,47,47,0.2)">Uncheck</button></div>`;
            L.popup({ className: 'region-popup', closeButton: true, offset: [0, -5] })
              .setLatLng(e.latlng)
              .setContent(html)
              .openOn(e.target._map);
            return;
          }
          onToggle(id);
          const target = e.target;
          const willBeVisited = !isVisited;
          const finalStyle = isPoint
            ? {
                radius: isPointMode ? 7 : 5,
                fillColor: willBeVisited ? country.visitedColor : '#b0bec5',
                fillOpacity: willBeVisited ? 0.8 : 0.5,
                weight: willBeVisited ? 2 : 1.5,
              }
            : willBeVisited ? visitedStyle : UNVISITED_STYLE;
          pulseLayer(target, isPoint, isPointMode, finalStyle);
        },
      });
    },
    [visited, wishlist, onToggle, country.visitedColor, isPointMode, dates, notes, wishlistActive]
  );

  useEffect(() => {
    function handleUncheck(e) {
      onToggle(e.detail);
    }
    document.addEventListener('region-uncheck', handleUncheck);
    return () => document.removeEventListener('region-uncheck', handleUncheck);
  }, [onToggle]);

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
    color: dark ? 'rgba(236, 240, 241, 0.6)' : 'rgba(26, 26, 46, 0.5)',
    weight: 2,
    lineJoin: 'round',
    lineCap: 'round',
  };

  const boroughOnEach = useCallback((feature, layer) => {
    layer.bindTooltip(feature.properties.name, {
      sticky: false,
      className: 'canton-tooltip',
      direction: 'center',
    });
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
        key={country.id + '-' + JSON.stringify([...visited]) + '-' + JSON.stringify([...(wishlist || [])]) + '-' + wishlistActive}
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
      <MapLayerControl
        onLayerChange={setTileUrl}
        onFriendsToggle={onFriendsToggle}
        friendsActive={friendsActive}
        onWishlistToggle={setWishlistActive}
        wishlistActive={wishlistActive}
      />
      {friendsActive && !comparisonFriend && friendOverlayData && (
        <FriendsRegionOverlay
          country={country}
          friendOverlayData={friendOverlayData}
        />
      )}
      {comparisonFriend && (
        <ComparisonRegionOverlay
          country={country}
          visited={visited}
          friendVisited={comparisonFriend.visitedRegions}
          friendName={comparisonFriend.name}
        />
      )}
      {friendsActive && !comparisonFriend && friendOverlayData && Object.keys(friendOverlayData).length > 0 && (
        <FriendOverlayLegend friendOverlayData={friendOverlayData} />
      )}
      {comparisonFriend && (
        <ComparisonLegend
          friendName={comparisonFriend.name}
          friendPicture={comparisonFriend.picture}
          onClose={onExitComparison}
        />
      )}
    </MapContainer>
  );
}
