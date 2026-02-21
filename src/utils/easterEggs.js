/**
 * Easter eggs utilities
 */

const GREATER_ISRAEL_IDS = ['il', 'jo', 'lb', 'sy'];

const SINAI_RING = [
  [32.2, 31.4],
  [34.8, 31.4],
  [35.7, 30.8],
  [35.8, 29.7],
  [35.1, 28.4],
  [33.6, 28.4],
  [32.5, 29.2],
  [32.1, 30.4],
  [32.2, 31.4],
];

function closeRing(ring) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function getPolygonsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function buildGreaterIsraelGeometry(worldData) {
  const polygons = [];
  GREATER_ISRAEL_IDS.forEach((id) => {
    const feature = worldData.features.find((f) => f.properties?.id === id);
    polygons.push(...getPolygonsFromGeometry(feature?.geometry));
  });

  polygons.push([closeRing(SINAI_RING)]);

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}

function getEgyptGeometryWithSinaiHole(geometry) {
  if (!geometry || geometry.type !== 'Polygon') return geometry;
  const [outerRing, ...holes] = geometry.coordinates;
  return {
    type: 'Polygon',
    coordinates: [outerRing, ...holes, closeRing(SINAI_RING).slice().reverse()],
  };
}

/**
 * Modifies world GeoJSON data to show Greater Israel if the easter egg is enabled
 * @param {Object} worldData - Original world GeoJSON FeatureCollection
 * @param {boolean} showGreaterIsrael - Whether to show Greater Israel
 * @returns {Object} Modified GeoJSON FeatureCollection
 */
export function applyEasterEggModifications(worldData, showGreaterIsrael) {
  if (!showGreaterIsrael) return worldData;

  const greaterIsraelGeometry = buildGreaterIsraelGeometry(worldData);

  const features = worldData.features.flatMap((feature) => {
    const id = feature.properties?.id;
    if (id === 'il') {
      return [{
        ...feature,
        geometry: greaterIsraelGeometry,
      }];
    }

    if (id === 'eg') {
      return [{
        ...feature,
        geometry: getEgyptGeometryWithSinaiHole(feature.geometry),
      }];
    }

    if (GREATER_ISRAEL_IDS.includes(id) && id !== 'il') {
      return [];
    }

    return [feature];
  });

  return {
    ...worldData,
    features,
  };
}

/**
 * Checks if Greater Israel easter egg is enabled
 * @returns {boolean}
 */
export function isGreaterIsraelEnabled() {
  try {
    return localStorage.getItem('swiss-tracker-easter-egg-greater-israel') === 'true';
  } catch {
    return false;
  }
}

/**
 * Toggles the Greater Israel easter egg
 */
export function toggleGreaterIsrael() {
  try {
    const currentState = isGreaterIsraelEnabled();
    localStorage.setItem(
      'swiss-tracker-easter-egg-greater-israel',
      (!currentState).toString()
    );
    return !currentState;
  } catch {
    return false;
  }
}
