/**
 * Easter eggs utilities
 */

const GREATER_ISRAEL_IDS = ['il', 'jo', 'lb', 'sy'];

const SINAI_RING = [
  [32.2, 31.1],
  [34.5, 31.3],
  [34.9, 29.5],
  [34.2, 27.7],
  [33.2, 27.7],
  [32.2, 28.8],
  [32.2, 31.1],
];

function closeRing(ring) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = (yi > point[1]) !== (yj > point[1])
      && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
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
  if (!geometry) return geometry;
  const holeRing = closeRing(SINAI_RING).slice().reverse();

  if (geometry.type === 'Polygon') {
    const [outerRing, ...holes] = geometry.coordinates;
    return {
      type: 'Polygon',
      coordinates: [outerRing, ...holes, holeRing],
    };
  }

  if (geometry.type !== 'MultiPolygon') return geometry;

  const testPoint = holeRing[0];
  let applied = false;
  const updated = geometry.coordinates.map((polygon) => {
    if (!polygon?.length) return polygon;
    const outerRing = polygon[0];
    if (pointInRing(testPoint, outerRing)) {
      applied = true;
      return [...polygon, holeRing];
    }
    return polygon;
  });

  if (!applied) return geometry;
  return {
    type: 'MultiPolygon',
    coordinates: updated,
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
