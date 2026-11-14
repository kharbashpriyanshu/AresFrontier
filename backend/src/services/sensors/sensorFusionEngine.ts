import { SensorObservation, MarsCoordinate } from "../../types/index.js";
import { FusedTerrainObservation } from "./sensorTypes.js";

export class SensorFusionEngine {
  /**
   * Fuses heterogeneous sensor observations (Laser Altimeter, HazCam, NavCam)
   * into a unified terrain state using inverse-variance weighting.
   */
  public static fuseObservations(
    observations: SensorObservation[],
    fallbackCoord: MarsCoordinate
  ): FusedTerrainObservation {
    const validObs = observations.filter((o) => o.quality !== "INVALID");

    if (validObs.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        coordinate: fallbackCoord,
        estimatedElevationM: 0,
        estimatedSlopeDeg: 0,
        slopeUncertaintyDeg: 25.0,
        confidenceInterval: [0, 25.0],
        rockDensityIndex: 0.5,
        obstacleProbability: 0.5,
        sensorCount: 0,
        quality: "INVALID",
      };
    }

    // 1. Elevation estimate from laser altimeter / topography
    const elevationObs = validObs.filter(
      (o) => o.sensorType === "LASER_ALTIMETER" || o.measurement.parameter === "ELEVATION"
    );
    let estimatedElevationM = 0;
    if (elevationObs.length > 0) {
      const sum = elevationObs.reduce((acc, o) => acc + o.measurement.value, 0);
      estimatedElevationM = Number((sum / elevationObs.length).toFixed(2));
    }

    // 2. Slope estimate from Hazcam / Navcam
    const slopeObs = validObs.filter(
      (o) => o.sensorType === "HAZCAM" || o.measurement.parameter === "SLOPE_GRADIENT"
    );

    let estimatedSlopeDeg = 0;
    let slopeUncertaintyDeg = 2.0;

    if (slopeObs.length > 0) {
      // Weighted average where weight = 1 / (uncertainty^2)
      let weightedSlopeSum = 0;
      let totalWeight = 0;

      slopeObs.forEach((o) => {
        const unc = o.uncertainty.absolute || 1.5;
        const weight = 1 / Math.max(0.01, unc * unc);
        weightedSlopeSum += o.measurement.value * weight;
        totalWeight += weight;
      });

      estimatedSlopeDeg = Number((weightedSlopeSum / totalWeight).toFixed(2));
      slopeUncertaintyDeg = Number((1 / Math.sqrt(totalWeight)).toFixed(2));
    }

    const confidenceInterval: [number, number] = [
      Number(Math.max(0, estimatedSlopeDeg - 1.96 * slopeUncertaintyDeg).toFixed(2)),
      Number((estimatedSlopeDeg + 1.96 * slopeUncertaintyDeg).toFixed(2)),
    ];

    const obstacleProbability = Number(Math.min(1.0, estimatedSlopeDeg / 22.0).toFixed(2));
    const hasDegraded = validObs.some((o) => o.quality === "DEGRADED");

    return {
      timestamp: new Date().toISOString(),
      coordinate: validObs[0]?.location || fallbackCoord,
      estimatedElevationM,
      estimatedSlopeDeg,
      slopeUncertaintyDeg,
      confidenceInterval,
      rockDensityIndex: 0.45,
      obstacleProbability,
      sensorCount: validObs.length,
      quality: hasDegraded ? "DEGRADED" : "GOOD",
    };
  }
}
