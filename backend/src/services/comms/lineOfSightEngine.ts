import { MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm, interpolateMarsRoutePoints } from "../../utils/marsCoordinates.js";
import { molaProvider } from "../planetary/molaProvider.js";

export interface LineOfSightResult {
  sourceCoord: MarsCoordinate;
  targetCoord: MarsCoordinate;
  distanceKm: number;
  lineOfSight: boolean;
  status: "LINE_OF_SIGHT_CLEAR" | "TERRAIN_OBSTRUCTED" | "HORIZON_LIMITED" | "UNKNOWN";
  maximumObstructionM: number;
  clearanceMarginM: number;
  methodology: string;
}

export class LineOfSightEngine {
  private static MARS_RADIUS_KM = 3396.19;

  /**
   * Calculates terrain and curvature line-of-sight between two Martian coordinates.
   */
  public static calculateLineOfSight(
    source: MarsCoordinate,
    target: MarsCoordinate,
    sourceMastHeightM: number = 2.0,
    targetMastHeightM: number = 2.0
  ): LineOfSightResult {
    const distanceKm = calculateMarsDistanceKm(source, target);

    // If coordinates are identical or within 50 meters
    if (distanceKm < 0.05) {
      return {
        sourceCoord: source,
        targetCoord: target,
        distanceKm,
        lineOfSight: true,
        status: "LINE_OF_SIGHT_CLEAR",
        maximumObstructionM: 0,
        clearanceMarginM: Math.min(sourceMastHeightM, targetMastHeightM),
        methodology: "Direct proximity line of sight",
      };
    }

    // 1. Radio Horizon Calculation based on Mars curvature
    // Distance to geometric horizon: d ≈ sqrt(2 * R * h)
    const dSourceHorizonKm = Math.sqrt(2 * (this.MARS_RADIUS_KM * 1000) * sourceMastHeightM) / 1000;
    const dTargetHorizonKm = Math.sqrt(2 * (this.MARS_RADIUS_KM * 1000) * targetMastHeightM) / 1000;
    const maxRadioHorizonKm = dSourceHorizonKm + dTargetHorizonKm;

    // 2. Sample elevation profile between source and target
    const samplePoints = interpolateMarsRoutePoints(source, target, 7);
    const sourceElev = molaProvider.getElevation(source).elevationM + sourceMastHeightM;
    const targetElev = molaProvider.getElevation(target).elevationM + targetMastHeightM;

    let maxObstructionM = 0;
    let obstructed = false;

    // Check intermediate sampled points
    for (let i = 1; i < samplePoints.length - 1; i++) {
      const frac = i / (samplePoints.length - 1);
      // Linear chord elevation
      const chordElev = sourceElev + frac * (targetElev - sourceElev);

      // Mars curvature drop at fraction f: h_drop ≈ (d_total * f) * (d_total * (1 - f)) / (2 * R)
      const distFromSourceKm = distanceKm * frac;
      const distFromTargetKm = distanceKm * (1 - frac);
      const curvatureDropM = ((distFromSourceKm * distFromTargetKm) / (2 * this.MARS_RADIUS_KM)) * 1000;

      const effectiveRayElev = chordElev - curvatureDropM;
      const terrainElev = molaProvider.getElevation(samplePoints[i]).elevationM;

      const obstruction = terrainElev - effectiveRayElev;
      if (obstruction > 0) {
        obstructed = true;
        if (obstruction > maxObstructionM) {
          maxObstructionM = obstruction;
        }
      }
    }

    if (distanceKm > maxRadioHorizonKm && maxObstructionM === 0) {
      maxObstructionM = (distanceKm - maxRadioHorizonKm) * 2.5;
      obstructed = true;
    }

    const lineOfSight = !obstructed;
    const status = lineOfSight
      ? "LINE_OF_SIGHT_CLEAR"
      : maxObstructionM > 10
      ? "TERRAIN_OBSTRUCTED"
      : "HORIZON_LIMITED";

    return {
      sourceCoord: source,
      targetCoord: target,
      distanceKm: Number(distanceKm.toFixed(3)),
      lineOfSight,
      status,
      maximumObstructionM: Number(maxObstructionM.toFixed(1)),
      clearanceMarginM: lineOfSight ? Number((Math.min(sourceElev, targetElev) - maxObstructionM).toFixed(1)) : 0,
      methodology: "Ray-trace chord intersection across MOLA areoid profile with curvature correction",
    };
  }
}
