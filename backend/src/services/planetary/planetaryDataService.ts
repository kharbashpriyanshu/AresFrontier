import {
  DataCoverage,
  DataMode,
  DataProvenance,
  Hazard,
  MarsCoordinate,
  MarsObservation,
  TerrainProfilePoint,
} from "../../types/index.js";
import { calculateMarsDistanceKm, calculateSlopeDegrees, interpolateMarsRoutePoints } from "../../utils/marsCoordinates.js";
import { benchmarkProvider } from "./benchmarkProvider.js";
import { hiriseProvider } from "./hiriseProvider.js";
import { molaProvider } from "./molaProvider.js";
import { roverProvider } from "./roverProvider.js";
import { themisProvider } from "./themisProvider.js";
import { ProvenanceService } from "./provenanceService.js";

/**
 * Unified Planetary Data Service
 * Enforces provider hierarchy, transparent data modes, and data coverage quantification.
 */
export class PlanetaryDataService {
  /**
   * Retrieves elevation with explicit dataMode, uncertainty, and provenance.
   */
  public async getElevation(coord: MarsCoordinate): Promise<{
    elevationM: number;
    dataMode: DataMode;
    uncertaintyM: number;
    provenance: DataProvenance;
  }> {
    return molaProvider.getElevation(coord);
  }

  /**
   * Generates a sampled terrain profile along route points.
   */
  public async getTerrainProfile(
    points: MarsCoordinate[],
    stepsPerKm = 5
  ): Promise<{ profile: TerrainProfilePoint[]; dataMode: DataMode; provenance: DataProvenance }> {
    const profile: TerrainProfilePoint[] = [];
    let accumulatedDistKm = 0;
    let primaryMode: DataMode = "FALLBACK";

    if (points.length < 2) {
      return { profile, dataMode: primaryMode, provenance: ProvenanceService.createMolaProvenance("DERIVED") };
    }

    let prevCoord = points[0];
    const firstElev = await this.getElevation(prevCoord);
    primaryMode = firstElev.dataMode;

    profile.push({
      distanceKm: 0,
      elevationM: firstElev.elevationM,
      slopeDegrees: 0,
      coordinate: prevCoord,
    });

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segmentDist = calculateMarsDistanceKm(p1, p2);
      const steps = Math.max(3, Math.min(40, Math.ceil(segmentDist * stepsPerKm)));
      const interpolated = interpolateMarsRoutePoints(p1, p2, steps);

      let prevElev = firstElev.elevationM;

      for (const nextCoord of interpolated) {
        const stepDist = calculateMarsDistanceKm(prevCoord, nextCoord);
        accumulatedDistKm += stepDist;
        const elevRes = await this.getElevation(nextCoord);
        if (elevRes.dataMode === "BENCHMARK") primaryMode = "BENCHMARK";

        const slope = calculateSlopeDegrees(stepDist, elevRes.elevationM - prevElev);
        profile.push({
          distanceKm: Number(accumulatedDistKm.toFixed(3)),
          elevationM: elevRes.elevationM,
          slopeDegrees: slope,
          coordinate: nextCoord,
        });

        prevCoord = nextCoord;
        prevElev = elevRes.elevationM;
      }
    }

    return {
      profile,
      dataMode: primaryMode,
      provenance: ProvenanceService.createDerivedProvenance(
        "MOLA Elevation Profile",
        ["NASA MGS MOLA MEGDR L3", "Great-circle Slerp Trajectory"],
        "Sampled bilateral linear interpolation along spherical geodesics"
      ),
    };
  }

  /**
   * Retrieves regional surface observation metadata.
   */
  public async getSurfaceObservation(coord: MarsCoordinate): Promise<{
    observation: MarsObservation;
    dataMode: DataMode;
  }> {
    const elev = await this.getElevation(coord);
    const themis = themisProvider.getCoverage(coord);

    return {
      dataMode: elev.dataMode,
      observation: {
        id: `obs-${coord.latitude.toFixed(3)}_${coord.longitude.toFixed(3)}`,
        source: "NASA MGS / 2001 Odyssey",
        mission: "Multi-Mission Planetary Reconnaissance",
        instrument: "MOLA & THEMIS IR",
        location: coord,
        observationType: "elevation",
        value: elev.elevationM,
        unit: "m",
        confidence: elev.dataMode === "BENCHMARK" ? 0.95 : 0.75,
        timestamp: "2021-02-18T00:00:00Z",
        provenance: elev.provenance,
      },
    };
  }

  /**
   * Evaluates comprehensive data evidence coverage for a coordinate.
   */
  public async getDataCoverage(region: MarsCoordinate): Promise<DataCoverage> {
    const elev = await this.getElevation(region);
    const hirise = hiriseProvider.getCoverage(region);
    const themis = themisProvider.getCoverage(region);
    const rovers = roverProvider.getObservationsNear(region, 25);
    const nearbyTargets = benchmarkProvider.getScienceTargets().filter(
      (t) => calculateMarsDistanceKm(region, t.coordinate) <= 25
    );

    const scienceCoverage = nearbyTargets.length >= 2 ? "HIGH" : nearbyTargets.length === 1 ? "MEDIUM" : "LOW";
    const elevCoverage = elev.dataMode === "BENCHMARK" ? "HIGH" : elev.dataMode === "CACHED" ? "MEDIUM" : "LOW";

    // Score overall evidence
    const scoreMap = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };
    const avgScore =
      (scoreMap[elevCoverage] +
        scoreMap[hirise.rating] +
        scoreMap[themis.rating] +
        scoreMap[rovers.rating] +
        scoreMap[scienceCoverage]) /
      5;

    let overall: "HIGH" | "MEDIUM" | "LOW" = "LOW";
    if (avgScore >= 2.2) overall = "HIGH";
    else if (avgScore >= 1.4) overall = "MEDIUM";

    return {
      elevation: elevCoverage,
      highResImagery: hirise.rating,
      thermal: themis.rating,
      roverEvidence: rovers.rating,
      scienceEvidence: scienceCoverage,
      overallEvidence: overall,
      sourceResolutionM: hirise.resolutionM || 463,
      dataAgeYears: 5,
      summary: `Region data coverage is ${overall}. Elevation: ${elevCoverage} (${elev.dataMode}), HiRISE Stereo: ${hirise.rating}, In-situ ground truth: ${rovers.rating}.`,
      provenance: ProvenanceService.createDerivedProvenance(
        "Data Evidence Coverage Index",
        ["MGS MOLA", "MRO HiRISE Footprints", "Odyssey THEMIS", "Rover Mission Archives"],
        "Multi-layer spatial intersection and resolution scoring"
      ),
    };
  }
}

export const planetaryDataService = new PlanetaryDataService();
