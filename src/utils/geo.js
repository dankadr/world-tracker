/**
 * Ray-casting point-in-polygon check.
 * @param {[number, number]} point - [lng, lat]
 * @param {Array} ring - Array of [lng, lat] coordinate pairs
 * @returns {boolean}
 */
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if a point is inside a Polygon or MultiPolygon geometry.
 */
function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInRing(point, geometry.coordinates[0]);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => pointInRing(point, poly[0]));
  }
  return false;
}

/**
 * Calculate great-circle distance between two points in km (Haversine formula).
 * @param {number} lat1 - Latitude of first point in degrees
 * @param {number} lng1 - Longitude of first point in degrees
 * @param {number} lat2 - Latitude of second point in degrees
 * @param {number} lng2 - Longitude of second point in degrees
 * @returns {number} Distance in km
 */
export function greatCircleDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // km
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Given a lat/lng and a GeoJSON FeatureCollection, find the matching feature.
 * @param {number} lat
 * @param {number} lng
 * @param {object} geojson - FeatureCollection
 * @returns {{ id: string, name: string } | null}
 */
export function findRegion(lat, lng, geojson) {
  const point = [lng, lat]; // GeoJSON uses [lng, lat]
  for (const feature of geojson.features) {
    if (pointInGeometry(point, feature.geometry)) {
      return {
        id: feature.properties.id,
        name: feature.properties.name,
      };
    }
  }
  return null;
}
