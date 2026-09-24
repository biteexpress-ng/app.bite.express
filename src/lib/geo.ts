/**
 * Spherical-law-of-cosines great-circle distance, kilometres.
 *
 * Good enough for delivery-radius math (sub-100m error inside any
 * Nigerian city, where we operate). When we move to road distance
 * we'll call the backend's /api/v1/config/distance-api instead.
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a store's `distance` field for display. The backend computes
 * it with ST_Distance_Sphere, so the value is in METRES, not km.
 */
export function formatDistance(metres: number | null | undefined): string | null {
  if (typeof metres !== "number" || !Number.isFinite(metres) || metres < 0) {
    return null;
  }
  if (Math.round(metres) < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
