export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Google Maps directions link. Uses the documented universal cross-platform URL
 * so it opens the native app on mobile and the web map on desktop.
 */
export function googleMapsDirectionsUrl(
  latitude: number,
  longitude: number
): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

/** Parses a decimal coordinate, tolerating comma decimals ("-25,3"). */
export function parseCoordinate(raw: string): number | null {
  const value = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
