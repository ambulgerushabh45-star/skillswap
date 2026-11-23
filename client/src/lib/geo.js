// client/src/lib/geo.js
// Pure geospatial formatting and distance helpers

export const EARTH_RADIUS_KM = 6371;

export function isValidCoordinate(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

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

export function roundKm(distance, step = 1) {
  if (distance === null || !Number.isFinite(distance)) return null;
  if (distance <= 0) return 0;
  if (step === 1) {
    return Math.round(distance);
  }
  const factor = 1 / step;
  return Math.round(distance * factor) / factor;
}

export function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) {
    return null;
  }
  if (distanceKm < 1) {
    return 'Less than 1 km away';
  }
  if (Number.isInteger(distanceKm)) {
    return `${distanceKm} km away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

