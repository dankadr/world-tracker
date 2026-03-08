import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { MapContainer, GeoJSON, TileLayer, Pane, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTheme } from '../context/ThemeContext';
import MapLayerControl, { LAYERS } from './MapLayerControl';
import FriendOverlayLegend from './FriendOverlayLegend';
import ComparisonLegend from './ComparisonLegend';
import UnescoLayer from './UnescoLayer';
import worldData from '../data/world.json';
import { applyEasterEggModifications, isGreaterIsraelEnabled } from '../utils/easterEggs';

const VISITED_COLOR = '#d89648';
const VISITED_HOVER = '#c07a30';

const TRACKED_COUNTRY_IDS = {
  ch: 'ch',
  us: 'us',
  no: 'no',
  ca: 'ca',
  jp: 'jp',
  au: 'au',
  ph: 'ph',
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
  color: 'rgba(192, 122, 48, 0.45)',
  weight: 2,
  dashArray: '4 3',
  lineJoin: 'round',
  lineCap: 'round',
};

const TRACKED_VISITED_STYLE = {
  fillColor: VISITED_COLOR,
  fillOpacity: 0.5,
  color: 'rgba(192, 122, 48, 0.45)',
  weight: 2,
  dashArray: '4 3',
  lineJoin: 'round',
  lineCap: 'round',
};

const WISHLIST_STYLE = {
  fillColor: '#f1c40f',
  fillOpacity: 0.25,
  color: 'rgba(241, 196, 15, 0.7)',
  weight: 1,
  dashArray: '5 4',
  lineJoin: 'round',
  lineCap: 'round',
};

const FRIEND_LABEL_LAYERS = {
  light: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
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

function FriendsWorldOverlay({ worldData, friendOverlayData }) {
  // Build a map: countryId -> [{ name, color }]
  const friendsByCountry = useMemo(() => {
    const map = {};
    Object.entries(friendOverlayData).forEach(([, data]) => {
      const countries = data.world?.countries || [];
      countries.forEach((cId) => {
        if (!map[cId]) map[cId] = [];
        map[cId].push({ name: data.name || 'Friend', color: data.color });
      });
    });
    return map;
  }, [friendOverlayData]);

  // Filter world GeoJSON to only friend-visited countries
  const overlayData = useMemo(() => ({
    type: 'FeatureCollection',
    features: worldData.features.filter((f) => friendsByCountry[f.properties.id]),
  }), [worldData, friendsByCountry]);

  const getStyle = useCallback((feature) => {
    const friends = friendsByCountry[feature.properties.id];
    if (!friends || friends.length === 0) return { fillOpacity: 0, weight: 0 };
    // Use first friend's color with transparency
    return {
      fillColor: friends[0].color,
      fillOpacity: 0.3,
      color: friends[0].color,
      weight: 1,
      dashArray: '4 3',
    };
  }, [friendsByCountry]);

  const onEachFeature = useCallback((feature, layer) => {
    const friends = friendsByCountry[feature.properties.id];
    if (!friends) return;
    const names = friends.map((f) => f.name).join(', ');
    layer.bindTooltip(`${feature.properties.name}<br/><span style="opacity:0.7;font-size:0.85em">Visited by: ${names}</span>`, {
      sticky: true,
      className: 'canton-tooltip',
      direction: 'top',
      offset: [0, -10],
    });
    // Make non-interactive (no click)
    layer.options.interactive = true;
    layer.on('click', (e) => { L.DomEvent.stopPropagation(e); });
  }, [friendsByCountry]);

  if (overlayData.features.length === 0) return null;

  return (
    <GeoJSON
      key={`friends-overlay-${JSON.stringify(Object.keys(friendOverlayData))}`}
      data={overlayData}
      style={getStyle}
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

function ComparisonWorldOverlay({ worldData, visited, friendVisited, friendName }) {
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
    features: worldData.features.filter((f) => classify(f.properties.id) !== null),
  }), [worldData, classify]);

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
      key={`comparison-overlay-${visited.size}-${friendSet.size}`}
      data={overlayData}
      style={getStyle}
      onEachFeature={onEachFeature}
      pane="overlayPane"
    />
  );
}

export default function WorldMap({ visited, onToggle, onExploreCountry, friendsActive, onFriendsToggle, friendOverlayData, comparisonFriend, onExitComparison, wishlist, comparisonMode }) {
  const geoJsonRef = useRef(null);
  // Use refs so event handlers always read current values even with stale closures
  const comparisonModeRef = useRef(comparisonMode);
  useEffect(() => { comparisonModeRef.current = comparisonMode; }, [comparisonMode]);
  const visitedRef = useRef(visited);
  useEffect(() => { visitedRef.current = visited; }, [visited]);
  const wishlistRef = useRef(wishlist);
  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);
  const { dark } = useTheme();
  const [tileUrl, setTileUrl] = useState(
    dark ? LAYERS[0].dark : LAYERS[0].light
  );
  const [wishlistActive, setWishlistActive] = useState(true);
  const wishlistActiveRef = useRef(wishlistActive);
  useEffect(() => { wishlistActiveRef.current = wishlistActive; }, [wishlistActive]);
  const [unescoActive, setUnescoActive] = useState(false);
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
      const isWishlisted = wishlistActive && wishlist?.has(id);
      const isTracked = id in TRACKED_COUNTRY_IDS;
      const isGreaterIsrael = greaterIsraelEnabled && id === 'il';
      let style;
      if (isVisited && isTracked) style = TRACKED_VISITED_STYLE;
      else if (isVisited) style = VISITED_STYLE;
      else if (isWishlisted) style = WISHLIST_STYLE;
      else if (isTracked) style = TRACKED_STYLE;
      else style = UNVISITED_STYLE;
      if (isGreaterIsrael) {
        style = { ...style, color: 'transparent', weight: 0 };
      }
      l.setStyle(style);
    });
  }, [visited, wishlist, wishlistActive, greaterIsraelEnabled]);

  const getStyle = useCallback(
    (feature) => {
      const id = feature.properties.id;
      const isVisited = visited.has(id);
      const isWishlisted = wishlistActive && wishlist?.has(id);
      const isTracked = id in TRACKED_COUNTRY_IDS;
      const isGreaterIsrael = greaterIsraelEnabled && id === 'il';

      let style;
      if (isVisited && isTracked) style = { ...TRACKED_VISITED_STYLE };
      else if (isVisited) style = { ...VISITED_STYLE };
      else if (isWishlisted) style = { ...WISHLIST_STYLE };
      else if (isTracked) style = { ...TRACKED_STYLE };
      else style = { ...UNVISITED_STYLE };

      if (isGreaterIsrael) {
        style.color = 'transparent';
        style.weight = 0;
      }

      return style;
    },
    [visited, wishlist, wishlistActive, greaterIsraelEnabled]
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
        add: (e) => {
          const el = e.target.getElement?.();
          if (el) el.style.webkitTapHighlightColor = 'rgba(46,204,113,0.15)';
        },
        mouseover: (e) => {
          const target = e.target;
          const isVisited = visitedRef.current.has(id);
          const isWishlisted = wishlistActiveRef.current && wishlistRef.current?.has(id);
          target.setStyle({
            fillColor: isVisited ? VISITED_HOVER : isWishlisted ? '#f1c40f' : '#b0bec5',
            fillOpacity: isVisited ? 0.7 : isWishlisted ? 0.35 : 0.55,
            color: isGreaterIsrael ? 'transparent' : 'rgba(255, 255, 255, 0.9)',
            weight: isGreaterIsrael ? 0 : 2,
          });
          target.bringToFront();
        },
        mouseout: (e) => {
          const target = e.target;
          const isVisited = visitedRef.current.has(id);
          const isWishlisted = wishlistActiveRef.current && wishlistRef.current?.has(id);
          let style;
          if (isVisited && isTracked) style = TRACKED_VISITED_STYLE;
          else if (isVisited) style = VISITED_STYLE;
          else if (isWishlisted) style = WISHLIST_STYLE;
          else if (isTracked) style = TRACKED_STYLE;
          else style = UNVISITED_STYLE;
          if (isGreaterIsrael) {
            style = { ...style, color: 'transparent', weight: 0 };
          }
          target.setStyle(style);
        },
        click: (e) => {
          if (comparisonModeRef.current) return;
          onToggle(id);
          const target = e.target;
          const willBeVisited = !visitedRef.current.has(id);
          const finalStyle = willBeVisited
            ? (isTracked ? TRACKED_VISITED_STYLE : VISITED_STYLE)
            : (isTracked ? TRACKED_STYLE : UNVISITED_STYLE);
          target.setStyle({ fillOpacity: 0.85, weight: 2, color: 'rgba(255,255,255,0.7)' });
          setTimeout(() => target.setStyle({ fillOpacity: 0.7, weight: 1.5 }), 120);
          setTimeout(() => target.setStyle({ fillOpacity: 0.6, weight: 1 }), 250);
          setTimeout(() => target.setStyle(finalStyle), 400);
        },
      });
    },
    [onToggle, greaterIsraelEnabled]
  );

  useEffect(() => {
    function handleToggle(e) {
      onToggle(e.detail);
    }
    document.addEventListener('world-toggle', handleToggle);
    return () => {
      document.removeEventListener('world-toggle', handleToggle);
    };
  }, [onToggle]);

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="swiss-map world-map"
      zoomControl={true}
      scrollWheelZoom={true}
      minZoom={2}
      maxZoom={8}
      worldCopyJump={true}
      maxBounds={[[-90, -Infinity], [90, Infinity]]}
      maxBoundsViscosity={0.7}
    >
      <MapController center={[20, 0]} zoom={2} />
      <TileLayer
        key={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        url={tileUrl}
      />
      {friendsActive && !comparisonFriend && (
        <Pane name="friendLabelsPane" style={{ zIndex: 450, pointerEvents: 'none' }}>
          <TileLayer
            key={`friend-labels-${dark ? 'dark' : 'light'}`}
            url={dark ? FRIEND_LABEL_LAYERS.dark : FRIEND_LABEL_LAYERS.light}
            opacity={0.95}
            noWrap={false}
          />
        </Pane>
      )}
      <GeoJSON
        key={`world-geojson-${greaterIsraelEnabled}`}
        ref={geoJsonRef}
        data={modifiedWorldData}
        style={getStyle}
        onEachFeature={onEachFeature}
      />
      {friendsActive && !comparisonFriend && friendOverlayData && Object.keys(friendOverlayData).length > 0 && (
        <FriendsWorldOverlay
          worldData={modifiedWorldData}
          friendOverlayData={friendOverlayData}
        />
      )}
      {comparisonFriend && (
        <ComparisonWorldOverlay
          worldData={modifiedWorldData}
          visited={visited}
          friendVisited={comparisonFriend.visited}
          friendName={comparisonFriend.name}
        />
      )}
      <MapLayerControl
        onLayerChange={setTileUrl}
        onFriendsToggle={onFriendsToggle}
        friendsActive={friendsActive}
        onWishlistToggle={setWishlistActive}
        wishlistActive={wishlistActive}
        onUnescoToggle={setUnescoActive}
        unescoActive={unescoActive}
      />
      {unescoActive && <UnescoLayer />}
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
