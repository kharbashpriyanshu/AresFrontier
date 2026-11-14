import { MarsCoordinate, MarsBounds } from "../types/index.js";

/**
 * Martian Geodetic Constants
 * Standard Reference: IAU/IAG Working Group on Cartographic Coordinates
 */
export const MARS_RADIUS_KM = 3389.5;
export const MARS_EQUATORIAL_RADIUS_KM = 3396.19;
export const MARS_POLAR_RADIUS_KM = 3376.20;

/**
 * Validates Martian coordinates within valid bounds.
 */
export function validateMarsCoordinate(coord: unknown): { valid: boolean; error?: string } {
  if (!coord || typeof coord !== "object") {
    return { valid: false, error: "Coordinate must be an object with latitude and longitude" };
  }

  const { latitude, longitude } = coord as Record<string, unknown>;

  if (typeof latitude !== "number" || isNaN(latitude)) {
    return { valid: false, error: "Latitude must be a valid number" };
  }

  if (typeof longitude !== "number" || isNaN(longitude)) {
    return { valid: false, error: "Longitude must be a valid number" };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: "Martian latitude must be between -90.0 and +90.0 degrees" };
  }

  // Support both [-180, 180] and [0, 360] East longitude
  if (longitude < -180 || longitude > 360) {
    return { valid: false, error: "Martian longitude must be between -180.0 and +360.0 degrees" };
  }

  return { valid: true };
}

/**
 * Normalizes Martian longitude to standard [-180, 180] range.
 */
export function normalizeLongitude(lon: number): number {
  let normalized = lon % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized < -180) {
    normalized += 360;
  }
  return Number(normalized.toFixed(6));
}

/**
 * Converts degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Computes great-circle surface distance between two points on Mars using Haversine formula.
 * @returns Distance in kilometers
 */
export function calculateMarsDistanceKm(coord1: MarsCoordinate, coord2: MarsCoordinate): number {
  const phi1 = toRadians(coord1.latitude);
  const phi2 = toRadians(coord2.latitude);
  const deltaPhi = toRadians(coord2.latitude - coord1.latitude);
  const deltaLambda = toRadians(normalizeLongitude(coord2.longitude) - normalizeLongitude(coord1.longitude));

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((MARS_RADIUS_KM * c).toFixed(4));
}

/**
 * Checks if a coordinate falls inside given Martian bounding box
 */
export function isCoordinateInBounds(coord: MarsCoordinate, bounds: MarsBounds): boolean {
  const lon = normalizeLongitude(coord.longitude);
  const west = normalizeLongitude(bounds.west);
  const east = normalizeLongitude(bounds.east);

  const latMatches = coord.latitude <= bounds.north && coord.latitude >= bounds.south;

  let lonMatches = false;
  if (west <= east) {
    lonMatches = lon >= west && lon <= east;
  } else {
    // Crosses prime meridian / anti-meridian
    lonMatches = lon >= west || lon <= east;
  }

  return latMatches && lonMatches;
}

/**
 * Interpolates points along a great circle between two coordinates for elevation sampling.
 */
export function interpolateMarsRoutePoints(
  start: MarsCoordinate,
  end: MarsCoordinate,
  numSteps: number = 10
): MarsCoordinate[] {
  if (numSteps <= 1) return [start, end];

  const points: MarsCoordinate[] = [];
  const phi1 = toRadians(start.latitude);
  const lambda1 = toRadians(normalizeLongitude(start.longitude));
  const phi2 = toRadians(end.latitude);
  const lambda2 = toRadians(normalizeLongitude(end.longitude));

  const d = calculateMarsDistanceKm(start, end) / MARS_RADIUS_KM;

  if (d === 0) {
    return [start];
  }

  for (let i = 0; i <= numSteps; i++) {
    const f = i / numSteps;
    const a = Math.sin((1 - f) * d) / Math.sin(d);
    const b = Math.sin(f * d) / Math.sin(d);

    const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
    const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
    const z = a * Math.sin(phi1) + b * Math.sin(phi2);

    const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lambda = Math.atan2(y, x);

    points.push({
      latitude: Number(toDegrees(phi).toFixed(5)),
      longitude: Number(normalizeLongitude(toDegrees(lambda)).toFixed(5)),
    });
  }

  return points;
}

/**
 * Computes slope angle in degrees between two elevations over a surface distance.
 */
export function calculateSlopeDegrees(horizontalDistanceKm: number, elevationDeltaM: number): number {
  if (horizontalDistanceKm <= 0.0001) return 0;
  const horizontalDistanceM = horizontalDistanceKm * 1000;
  const gradient = Math.abs(elevationDeltaM) / horizontalDistanceM;
  return Number(toDegrees(Math.atan(gradient)).toFixed(2));
}
