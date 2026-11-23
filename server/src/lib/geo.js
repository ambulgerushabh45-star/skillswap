// src/lib/geo.js
// Pure geospatial calculations, rounding, and formatting using the Haversine formula (Earth radius 6371 km)

export const EARTH_RADIUS_KM = 6371;

/**
 * Validates if coordinates are finite numbers within valid geographic ranges:
 * Latitude must be within [-90, 90], Longitude must be within [-180, 180].
 */
export function isValidCoordinate(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 * Returns distance in kilometres, or null if any coordinate is invalid, undefined, or null.
 *
 * (0, 0) is treated as a mathematically valid GPS coordinate since SkillSwap does not use (0, 0)
 * as a default placeholder (SkillSwap uses Bengaluru or Boston coordinates).
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Rounds a distance in kilometres to the specified step increment.
 * - For peer matches: step = 1 (nearest whole kilometre). Values < 1 km round to 0.
 * - For public events: step = 0.1 (nearest tenth of a kilometre).
 */
export function roundKm(distance, step = 1) {
  if (distance === null || !Number.isFinite(distance)) return null;
  if (distance <= 0) return 0;
  if (step === 1) {
    return Math.round(distance);
  }
  const factor = 1 / step;
  return Math.round(distance * factor) / factor;
}

/**
 * Formats a distance in kilometres into a human-readable display string:
 * - null -> null
 * - 0 or < 1 -> "Less than 1 km away"
 * - Whole number (e.g. 3) -> "3 km away"
 * - Decimal number (e.g. 2.3) -> "2.3 km away"
 */
export function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) {
    return null;
  }
  if (distanceKm < 1) {
    return "Less than 1 km away";
  }
  if (Number.isInteger(distanceKm)) {
    return `${distanceKm} km away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

