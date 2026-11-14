import {
  MarsCoordinate,
  MarsRoute,
  RoutePoint,
  RouteSegment,
  TerrainProfilePoint,
  MissionParameters,
  EVAAssessment,
  EVAOperationalAssessment,
  EVAMissionStatus,
  TerrainDifficulty,
} from "../../types/index.js";
import {
  calculateMarsDistanceKm,
  calculateSlopeDegrees,
  interpolateMarsRoutePoints,
} from "../../utils/marsCoordinates.js";
import { marsDataService } from "../nasa/marsDataService.js";

/**
 * EVA & Mission Planning Engine
 * Computes deterministic traversal physics, metabolic consumption,
 * and Martian topography routing.
 */
export class MissionEngine {
  /**
   * Estimates walking speed on Mars (km/h) as a function of slope.
   * Standard flat-ground EVA pace in Martian gravity (0.38g) with exploration suit ~ 3.2 km/h.
   */
  private calculateWalkingSpeedKmH(slopeDegrees: number): number {
    const slopeRadians = (slopeDegrees * Math.PI) / 180;
    // Adapted Tobler-style metabolic curve for pressurized planetary suit
    const baseSpeed = 3.2; // km/h
    const penalty = Math.exp(-3.2 * Math.abs(Math.tan(slopeRadians) + 0.04));
    return Math.max(0.6, baseSpeed * penalty);
  }

  /**
   * Generates a fully populated MarsRoute given ordered waypoints.
   */
  public async generateRoute(
    name: string,
    points: RoutePoint[]
  ): Promise<MarsRoute> {
    if (points.length < 2) {
      throw new Error("A route requires at least a start and destination coordinate.");
    }

    const segments: RouteSegment[] = [];
    const elevationProfile: TerrainProfilePoint[] = [];

    let accumulatedDistanceKm = 0;
    let totalElevationGainM = 0;
    let totalElevationLossM = 0;
    let maxSlopeDegrees = 0;
    let totalDurationMinutes = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const startPt = points[i];
      const endPt = points[i + 1];

      const segmentDistKm = calculateMarsDistanceKm(startPt.coordinate, endPt.coordinate);
      const startElev = marsDataService.estimateMolaElevation(startPt.coordinate);
      const endElev = marsDataService.estimateMolaElevation(endPt.coordinate);
      const elevDelta = endElev - startElev;

      if (elevDelta > 0) {
        totalElevationGainM += elevDelta;
      } else {
        totalElevationLossM += Math.abs(elevDelta);
      }

      // Sample along segment for detailed elevation profile
      const steps = Math.max(5, Math.min(30, Math.ceil(segmentDistKm * 5)));
      const interpolatedCoords = interpolateMarsRoutePoints(startPt.coordinate, endPt.coordinate, steps);

      let segmentMaxSlope = 0;
      let lastElev = startElev;
      let lastCoord = startPt.coordinate;

      for (let s = 0; s < interpolatedCoords.length; s++) {
        const currCoord = interpolatedCoords[s];
        const stepDist = calculateMarsDistanceKm(lastCoord, currCoord);
        const currElev = marsDataService.estimateMolaElevation(currCoord);
        const stepSlope = calculateSlopeDegrees(stepDist, currElev - lastElev);

        if (stepSlope > segmentMaxSlope) segmentMaxSlope = stepSlope;
        if (stepSlope > maxSlopeDegrees) maxSlopeDegrees = stepSlope;

        accumulatedDistanceKm += stepDist;
        elevationProfile.push({
          distanceKm: Number(accumulatedDistanceKm.toFixed(3)),
          elevationM: currElev,
          slopeDegrees: stepSlope,
          coordinate: currCoord,
        });

        lastElev = currElev;
        lastCoord = currCoord;
      }

      const avgSlope = calculateSlopeDegrees(segmentDistKm, elevDelta);
      const walkingSpeed = this.calculateWalkingSpeedKmH(avgSlope);
      let segmentMinutes = (segmentDistKm / walkingSpeed) * 60;

      // Add science dwell time if destination point is a science stop
      if (endPt.type === "science") {
        segmentMinutes += 25; // 25 min science exploration buffer
      }

      totalDurationMinutes += segmentMinutes;

      let difficulty: TerrainDifficulty = "low";
      const hazards: string[] = [];

      if (segmentMaxSlope > 20) {
        difficulty = "high";
        hazards.push("Severe slope angle (>20°) - Risk of regolith slip");
      } else if (segmentMaxSlope > 10) {
        difficulty = "moderate";
        hazards.push("Moderate incline (>10°) - Elevated metabolic load");
      }

      if (elevDelta > 150) {
        hazards.push("Rapid topographic elevation gain");
      }

      segments.push({
        id: `seg-${i + 1}`,
        start: startPt.coordinate,
        end: endPt.coordinate,
        distanceKm: Number(segmentDistKm.toFixed(3)),
        elevationGainM: elevDelta > 0 ? elevDelta : 0,
        elevationLossM: elevDelta < 0 ? Math.abs(elevDelta) : 0,
        averageSlopeDegrees: avgSlope,
        difficulty,
        estimatedMinutes: Math.round(segmentMinutes),
        hazards,
      });
    }

    const totalDistKm = Number(
      segments.reduce((acc, s) => acc + s.distanceKm, 0).toFixed(3)
    );

    let overallDifficulty: TerrainDifficulty = "low";
    if (maxSlopeDegrees > 18 || totalElevationGainM > 300) {
      overallDifficulty = "high";
    } else if (maxSlopeDegrees > 9 || totalElevationGainM > 100) {
      overallDifficulty = "moderate";
    }

    return {
      id: `route-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: name || "Martian EVA Traverse Plan",
      points,
      segments,
      totalDistanceKm: totalDistKm,
      estimatedDurationMinutes: Math.round(totalDurationMinutes),
      elevationProfile,
      elevationGainM: totalElevationGainM,
      elevationLossM: totalElevationLossM,
      maxSlopeDegrees,
      overallDifficulty,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Assesses EVA feasibility against suit constraints, duration limits, and terrain limits.
   */
  public assessEVAFeasibility(
    route: MarsRoute,
    params: MissionParameters
  ): EVAOperationalAssessment {
    const maxDuration = params.maxDurationMinutes || 240; // Standard 4-hour EVA limit
    let totalTime = route.estimatedDurationMinutes;

    // Account for return journey if not an explicit closed loop
    if (params.returnRequired) {
      const firstPt = route.points[0].coordinate;
      const lastPt = route.points[route.points.length - 1].coordinate;
      const distStartToEnd = calculateMarsDistanceKm(firstPt, lastPt);

      // If loop is not closed (>0.05 km apart), add return traversal time
      if (distStartToEnd > 0.05) {
        const returnWalkSpeed = 3.0; // km/h
        const returnTimeMinutes = (distStartToEnd / returnWalkSpeed) * 60;
        totalTime += Math.round(returnTimeMinutes);
      }
    }

    const returnMarginMinutes = maxDuration - totalTime;
    const feasible = returnMarginMinutes >= 30 && route.maxSlopeDegrees <= 25;

    const warnings: string[] = [];
    const recommendations: string[] = [];

    if (returnMarginMinutes < 0) {
      warnings.push(`Mission exceeds maximum EVA duration by ${Math.abs(returnMarginMinutes)} minutes.`);
      recommendations.push("Reduce number of science waypoints or shorten traverse distance.");
    } else if (returnMarginMinutes < 30) {
      warnings.push(`Insufficient safety reserve margin (${returnMarginMinutes} min remaining; minimum 30 min required by NASA flight rules).`);
      recommendations.push("Establish intermediate pressurized replenishment cache along route.");
    }

    if (route.maxSlopeDegrees > 20) {
      warnings.push(`Traverse exceeds 20° slope threshold (${route.maxSlopeDegrees}° encountered). High risk of suit damage or fall.`);
      recommendations.push("Reroute around steep scarps or crater rims using contour navigation.");
    }

    if (route.totalDistanceKm > 10.0) {
      warnings.push(`Traverse distance (${route.totalDistanceKm} km) exceeds standard single-person unassisted walking range.`);
      recommendations.push("Deploy uncrewed rover or utility transport vehicle (UTV) as backup.");
    }

    // Oxygen consumption model: baseline metabolic rate = 0.8 L/min + slope stress
    const oxygenUsedLiters = Math.round(totalTime * 0.95);
    const suitTotalCapacityLiters = (maxDuration / 60) * 80; // Standard capacity
    const oxygenReserveRemainingPercent = Math.max(
      0,
      Math.min(100, Math.round(((suitTotalCapacityLiters - oxygenUsedLiters) / suitTotalCapacityLiters) * 100))
    );

    if (recommendations.length === 0) {
      recommendations.push("Route passes all baseline safety limits. Proceed to flight director sign-off.");
    }

    // Determine Status (GREEN, YELLOW, RED) per Phase 3 requirements
    let status: EVAMissionStatus = "GREEN";
    let statusReason = "Nominal mission parameters. All life-support reserves and slope thresholds satisfied.";

    if (returnMarginMinutes < 0 || route.maxSlopeDegrees > 22 || !feasible) {
      status = "RED";
      statusReason = returnMarginMinutes < 0
        ? `Exceeds max duration by ${Math.abs(returnMarginMinutes)} min; life support depleted before ingress.`
        : `Critical slope gradient of ${route.maxSlopeDegrees}° violates astronaut mobility envelope.`;
    } else if (returnMarginMinutes < 30 || route.maxSlopeDegrees > 15 || route.totalDistanceKm > 8.0) {
      status = "YELLOW";
      statusReason = returnMarginMinutes < 30
        ? `Return reserve of ${returnMarginMinutes} min is below the 30-min flight rule safety margin.`
        : `High-stress terrain corridor (slope: ${route.maxSlopeDegrees}°); elevated metabolic consumption.`;
    }

    const stressFactor = Number(Math.min(1.0, (route.maxSlopeDegrees / 25) * 0.6 + (route.elevationGainM / 400) * 0.4).toFixed(2));
    const hazardFactor = Number(Math.min(1.0, (route.segments.filter(s => s.hazards.length > 0).length / Math.max(1, route.segments.length))).toFixed(2));

    return {
      estimatedDurationMinutes: totalTime,
      totalDistanceKm: route.totalDistanceKm,
      terrainDifficulty: route.overallDifficulty,
      returnMarginMinutes,
      feasible,
      warnings,
      oxygenReserveRemainingPercent,
      recommendations,
      status,
      statusReason,
      returnFeasibility: returnMarginMinutes >= 0,
      emergencyReserveMinutes: Math.max(0, returnMarginMinutes),
      terrainStressFactor: stressFactor,
      hazardExposureFactor: hazardFactor,
      dataUncertaintyFactor: 0.15,
    };
  }
}

export const missionEngine = new MissionEngine();
