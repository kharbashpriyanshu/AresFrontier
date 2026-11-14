import { MarsCoordinate } from "../types/index.js";

export const MARS_RADIUS_KM = 3389.5;

export function formatMarsCoordinate(coord: MarsCoordinate): string {
  const latDir = coord.latitude >= 0 ? "N" : "S";
  const absLat = Math.abs(coord.latitude).toFixed(4);

  let normLon = coord.longitude % 360;
  if (normLon > 180) normLon -= 360;
  if (normLon < -180) normLon += 360;

  const lonDir = normLon >= 0 ? "E" : "W";
  const absLon = Math.abs(normLon).toFixed(4);

  return `${absLat}°${latDir}, ${absLon}°${lonDir}`;
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateMarsDistanceKm(coord1: MarsCoordinate, coord2: MarsCoordinate): number {
  const phi1 = toRadians(coord1.latitude);
  const phi2 = toRadians(coord2.latitude);
  const deltaPhi = toRadians(coord2.latitude - coord1.latitude);

  let lon1 = coord1.longitude % 360;
  let lon2 = coord2.longitude % 360;
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((MARS_RADIUS_KM * c).toFixed(3));
}
