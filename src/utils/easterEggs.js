/**
 * Easter eggs utilities
 */

const GREATER_ISRAEL_IDS = ['il', 'jo'];

const SINAI_RING = [
  [32.136, 31.3411],
  [32.0761, 31.3445],
  [32.0085, 31.2205],
  [32.0656, 31.153],
  [32.1018, 31.0928],
  [32.2065, 31.119],
  [32.2818, 31.2009],
  [32.2428, 31.2465],
  [32.2162, 31.2937],
  [32.2506, 31.2949],
  [32.3235, 31.2561],
  [32.5328, 31.1007],
  [32.6033, 31.0688],
  [32.6846, 31.074],
  [32.8545, 31.1177],
  [32.9016, 31.1109],
  [33.1299, 31.1682],
  [33.1567, 31.1262],
  [33.1943, 31.0845],
  [33.3779, 31.131],
  [33.6665, 31.1304],
  [33.9025, 31.181],
  [34.1763, 31.3039],
  [34.1981, 31.3226],
  [34.2125, 31.2923],
  [34.2453, 31.2083],
  [34.3285, 30.995],
  [34.401, 30.8278],
  [34.4899, 30.5963],
  [34.5178, 30.5074],
  [34.5297, 30.446],
  [34.6586, 30.1915],
  [34.7351, 29.982],
  [34.7911, 29.8121],
  [34.8698, 29.5639],
  [34.9043, 29.4773],
  [34.8485, 29.4321],
  [34.7364, 29.2706],
  [34.6172, 28.7579],
  [34.4465, 28.3573],
  [34.4271, 28.1065],
  [34.3997, 28.016],
  [34.3186, 27.889],
  [34.2201, 27.7643],
  [34.0451, 27.8289],
  [33.7603, 28.0477],
  [33.5941, 28.2556],
  [33.4161, 28.3898],
  [33.2478, 28.5677],
  [33.202, 28.6957],
  [33.2037, 28.7778],
  [33.1302, 28.9783],
  [33.0758, 29.073],
  [32.8706, 29.2862],
  [32.8117, 29.4],
  [32.7667, 29.45],
  [32.7215, 29.5218],
  [32.6472, 29.7984],
  [32.5657, 29.974],
  [32.473, 29.9254],
  [32.4895, 29.8515],
  [32.4086, 29.7493],
  [32.3598, 29.6307],
  [32.3973, 29.5338],
  [32.565, 29.3863],
  [32.599, 29.3219],
  [32.6381, 29.1822],
  [32.6318, 28.9922],
  [32.6589, 28.9277],
  [32.7845, 28.7866],
  [32.8295, 28.7029],
  [32.8565, 28.6306],
  [32.8982, 28.5652],
  [33.0229, 28.4423],
  [33.2021, 28.2083],
  [33.3723, 28.0506],
  [33.4949, 27.9745],
  [33.5471, 27.8981],
  [33.5588, 27.7012],
  [33.5498, 27.6074],
  [33.6574, 27.4306],
  [33.6973, 27.3411],
  [33.8017, 27.2682],
  [33.8493, 27.1849],
  [33.8931, 27.0495],
  [32.136, 31.3411],
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
