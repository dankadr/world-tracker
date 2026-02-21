/**
 * Easter eggs utilities
 */

/**
 * Gets the enhanced Israel geometry that includes historical Greater Israel territories
 * Includes: West Bank, Gaza Strip, Sinai Peninsula, and Golan Heights
 * @returns {Object} GeoJSON Feature with expanded Israel geometry
 */
export function getGreaterIsraelGeometry() {
  // Greater Israel polygon including West Bank, Gaza, Sinai, and Golan Heights
  // Approximate boundaries based on historical territorial claims
  return {
    type: 'Polygon',
    coordinates: [
      [
        // Main Israel + West Bank and Gaza + parts of Sinai and Golan
        [34.2125, 31.292285], // Southwest corner
        [33.9, 31.0], // Towards Sinai
        [33.5, 30.8], // Sinai Peninsula west extension
        [33.0, 30.5], // Further south in Sinai
        [33.5, 29.5], // Sinai southern extent
        [34.5, 29.5], // Southeast Sinai extension
        [34.8, 29.8], // Sinai east
        [35.2, 30.2], // Back towards main territory
        [35.4, 30.8], // Gulf of Aqaba area
        [35.5, 31.5], // Dead Sea area
        [35.7, 31.8], // Jordan east bank (Transjordan claim)
        [36.0, 32.3], // Further northeast towards Golan
        [36.2, 32.5], // Golan Heights
        [36.5, 32.8], // Northeast Golan extension
        [36.2, 33.2], // Northern area
        [35.8, 33.3], // North towards Lebanon border
        [35.6, 33.2], // Northern coast area
        [35.3, 33.15], // Back to main territory
        [35.23, 33.092], // Original northern boundary
        [35.215, 32.95], // Lebanese border
        [35.1, 32.8], // West towards coast
        [35.0, 32.6], // Coastal area
        [34.8, 32.4], // Further south
        [34.5, 31.8], // Mediterranean coast
        [34.3, 31.5], // Southwest towards Gaza
        [34.2125, 31.292285], // Close to start
      ],
    ],
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

  // Create a deep copy to avoid mutating original
  const modifiedData = {
    ...worldData,
    features: worldData.features.map((feature) => {
      if (feature.properties?.id === 'il') {
        return {
          ...feature,
          geometry: getGreaterIsraelGeometry(),
        };
      }
      return feature;
    }),
  };

  return modifiedData;
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
