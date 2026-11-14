import { MarsCoordinate, TerrainAssessment, TerrainDifficulty } from "../../types/index.js";
import { calculateMarsDistanceKm, calculateSlopeDegrees, interpolateMarsRoutePoints } from "../../utils/marsCoordinates.js";
import { molaProvider } from "../planetary/molaProvider.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

/**
 * Terrain Intelligence Engine (Phase 3 Upgrade)
 * Calculates deterministic topographic gradients, empirical roughness,
 * slope distribution, and uncertainty metrics from NASA MOLA data models.
 */
export class TerrainEngine {
  /**
   * Assesses local terrain characteristics at a specific coordinate.
   * Samples a local 4-point cross-grid (~207m offset) to compute directional gradients.
   */
  public assessPoint(coord: MarsCoordinate): TerrainAssessment {
    const centerRes = molaProvider.getElevation(coord);
    const centerElev = centerRes.elevationM;
    const offsetDeg = 0.0035; // ~207 meters on Mars equatorial radius

    const northCoord = { latitude: Math.min(89.9, coord.latitude + offsetDeg), longitude: coord.longitude };
    const southCoord = { latitude: Math.max(-89.9, coord.latitude - offsetDeg), longitude: coord.longitude };
    const eastCoord = { latitude: coord.latitude, longitude: coord.longitude + offsetDeg };
    const westCoord = { latitude: coord.latitude, longitude: coord.longitude - offsetDeg };

    const northElev = molaProvider.getElevation(northCoord).elevationM;
    const southElev = molaProvider.getElevation(southCoord).elevationM;
    const eastElev = molaProvider.getElevation(eastCoord).elevationM;
    const westElev = molaProvider.getElevation(westCoord).elevationM;

    const dNS = calculateMarsDistanceKm(southCoord, northCoord);
    const dEW = calculateMarsDistanceKm(westCoord, eastCoord);

    const slopeNS = calculateSlopeDegrees(dNS, northElev - southElev);
    const slopeEW = calculateSlopeDegrees(dEW, eastElev - westElev);

    const maxLocalSlope = Math.max(slopeNS, slopeEW);
    const avgLocalSlope = (slopeNS + slopeEW) / 2;

    const elevations = [centerElev, northElev, southElev, eastElev, westElev];
    const elevGain = Math.max(0, ...elevations.map((e) => e - centerElev));
    const elevLoss = Math.max(0, ...elevations.map((e) => centerElev - e));
    const roughness = this.calculateRoughness(elevations);
    const difficulty = this.classifyDifficulty(maxLocalSlope, roughness);

    // Calculate empirical confidence based on dataMode & roughness
    const baseConfidence = centerRes.dataMode === "BENCHMARK" ? 0.95 : 0.78;
    const calculatedConfidence = Math.max(0.5, Number((baseConfidence - roughness * 0.15).toFixed(2)));

    const uncertaintySlope = Number((maxLocalSlope * 0.08 + (centerRes.uncertaintyM / 200)).toFixed(2));

    return {
      elevationM: centerElev,
      averageSlopeDeg: Number(avgLocalSlope.toFixed(2)),
      maxSlopeDeg: Number(maxLocalSlope.toFixed(2)),
      elevationGainM: Number(elevGain.toFixed(1)),
      elevationLossM: Number(elevLoss.toFixed(1)),
      traversalDifficulty: difficulty,
      roughnessIndex: roughness,
      confidence: calculatedConfidence,
      uncertainty: {
        absoluteM: centerRes.uncertaintyM,
        slopeDegrees: uncertaintySlope,
        methodology: `Propagated 4-point cross-grid altimetry variance (${centerRes.dataMode} mode)`,
      },
      sourceType: centerRes.dataMode === "BENCHMARK" ? "BENCHMARK_DATA" : "DERIVED",
      provenance: ProvenanceService.createDerivedProvenance(
        "Point Topography & Gradient",
        [centerRes.provenance.sourceName, "Directional Finite Difference"],
        `Sampled 4-point cross grid (~207m offset). Vertical uncertainty: ±${centerRes.uncertaintyM}m`,
        calculatedConfidence
      ),
    };
  }

  /**
   * Assesses terrain profile along a line segment between two coordinates.
   */
  public assessSegment(start: MarsCoordinate, end: MarsCoordinate, steps = 15): TerrainAssessment {
    const distKm = calculateMarsDistanceKm(start, end);
    const numSteps = Math.max(5, Math.min(60, steps));
    const coords = interpolateMarsRoutePoints(start, end, numSteps);

    const startRes = molaProvider.getElevation(start);
    const elevations: number[] = [startRes.elevationM];
    let totalGain = 0;
    let totalLoss = 0;
    let maxSlope = 0;
    let sumSlope = 0;

    let prevCoord = start;
    let prevElev = elevations[0];
    let isBenchmarkObserved = startRes.dataMode === "BENCHMARK";

    for (let i = 0; i < coords.length; i++) {
      const currCoord = coords[i];
      const stepRes = molaProvider.getElevation(currCoord);
      const currElev = stepRes.elevationM;
      if (stepRes.dataMode === "BENCHMARK") isBenchmarkObserved = true;
      elevations.push(currElev);

      const stepDist = calculateMarsDistanceKm(prevCoord, currCoord);
      const deltaH = currElev - prevElev;

      if (deltaH > 0) {
        totalGain += deltaH;
      } else {
        totalLoss += Math.abs(deltaH);
      }

      const slope = calculateSlopeDegrees(stepDist, deltaH);
      sumSlope += slope;
      if (slope > maxSlope) {
        maxSlope = slope;
      }

      prevCoord = currCoord;
      prevElev = currElev;
    }

    const endElev = molaProvider.getElevation(end).elevationM;
    const avgSlope = coords.length > 0 ? sumSlope / coords.length : calculateSlopeDegrees(distKm, endElev - elevations[0]);
    const roughness = this.calculateRoughness(elevations);
    const difficulty = this.classifyDifficulty(maxSlope, roughness);

    // Dynamic confidence based on data mode and slope variance
    const baseConf = isBenchmarkObserved ? 0.94 : 0.8;
    const calculatedConf = Math.max(0.5, Number((baseConf - roughness * 0.2).toFixed(2)));
    const absoluteUncertainty = isBenchmarkObserved ? 4.0 : 20.0;

    return {
      elevationM: elevations[0],
      averageSlopeDeg: Number(avgSlope.toFixed(2)),
      maxSlopeDeg: Number(maxSlope.toFixed(2)),
      elevationGainM: Number(totalGain.toFixed(1)),
      elevationLossM: Number(totalLoss.toFixed(1)),
      traversalDifficulty: difficulty,
      roughnessIndex: roughness,
      confidence: calculatedConf,
      uncertainty: {
        absoluteM: absoluteUncertainty,
        slopeDegrees: Number((maxSlope * 0.1).toFixed(2)),
        methodology: `Cumulative Slerp route traversal profile sampled at ${numSteps} intervals`,
      },
      sourceType: isBenchmarkObserved ? "BENCHMARK_DATA" : "DERIVED",
      provenance: ProvenanceService.createDerivedProvenance(
        "Segment Elevation & Slope Profile",
        ["MGS MOLA MEGDR", "Continuous Geodesic Interpolation"],
        `Interpolated at ${numSteps} steps. Absolute vertical uncertainty: ±${absoluteUncertainty}m`,
        calculatedConf
      ),
    };
  }

  /**
   * Computes terrain roughness index based on elevation standard deviation.
   * Standard deviation of 50m equates to roughness of ~0.5; normalized to [0.0, 1.0].
   */
  public calculateRoughness(elevations: number[]): number {
    if (elevations.length < 2) return 0.1;
    const mean = elevations.reduce((acc, v) => acc + v, 0) / elevations.length;
    const variance = elevations.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / elevations.length;
    const stdDev = Math.sqrt(variance);
    return Number(Math.min(1.0, stdDev / 100).toFixed(3));
  }

  /**
   * Classifies traversal difficulty based on slope and surface roughness.
   */
  public classifyDifficulty(maxSlopeDeg: number, roughness: number): TerrainDifficulty {
    if (maxSlopeDeg > 18 || roughness >= 0.6) {
      return "high";
    }
    if (maxSlopeDeg > 8 || roughness >= 0.3) {
      return "moderate";
    }
    return "low";
  }
}

export const terrainEngine = new TerrainEngine();
