import { MarsCoordinate, MarsRoute } from "../../types/index.js";
import { LineOfSightEngine } from "./lineOfSightEngine.js";
import { OrbitalVisibilityEngine } from "./orbitalVisibilityEngine.js";

export interface RouteCommunicationAssessment {
  communicationScore: number; // 0 - 100
  losCoveragePercent: number;  // 0 - 100%
  orbiterCoveragePercent: number; // 0 - 100%
  combinedCoveragePercent: number; // 0 - 100%
  maxBlackoutDurationMin: number;
  totalBlackoutDurationMin: number;
  orbiterPassAvailable: boolean;
  commContinuitySatisfied: boolean;
  blackoutSegmentsCount: number;
  summaryExplanation: string;
}

export class CommunicationRouteEvaluator {
  /**
   * Evaluates communication availability along a planned route using
   * deterministic terrain line-of-sight and orbital pass geometry.
   */
  public static evaluateRouteCommunication(
    route: MarsRoute,
    baseCoord: MarsCoordinate = { latitude: 18.38, longitude: 77.58 },
    simulationStartMinutes: number = 48,
    requireContinuous: boolean = false
  ): RouteCommunicationAssessment {
    if (!route.points || route.points.length === 0) {
      return {
        communicationScore: 100,
        losCoveragePercent: 100,
        orbiterCoveragePercent: 100,
        combinedCoveragePercent: 100,
        maxBlackoutDurationMin: 0,
        totalBlackoutDurationMin: 0,
        orbiterPassAvailable: true,
        commContinuitySatisfied: true,
        blackoutSegmentsCount: 0,
        summaryExplanation: "Zero waypoints; nominal communication baseline.",
      };
    }

    const nPoints = route.points.length;
    const strideMin = route.estimatedDurationMinutes > 0
      ? route.estimatedDurationMinutes / Math.max(1, nPoints - 1)
      : 15;

    let losPointsCount = 0;
    let orbiterPointsCount = 0;
    let combinedPointsCount = 0;
    let currentBlackoutMin = 0;
    let maxBlackoutMin = 0;
    let totalBlackoutMin = 0;
    let blackoutSegmentsCount = 0;
    let orbiterPassEverAvailable = false;

    for (let i = 0; i < nPoints; i++) {
      const pt = route.points[i];
      const elapsedMin = simulationStartMinutes + i * strideMin;

      // 1. Line of Sight to base/hub
      const los = LineOfSightEngine.calculateLineOfSight(baseCoord, pt.coordinate, 5.0, 2.0);
      const hasLos = los.lineOfSight;
      if (hasLos) losPointsCount++;

      // 2. Orbital Visibility (MRO Relay)
      const orb = OrbitalVisibilityEngine.calculateVisibility(pt.coordinate, elapsedMin);
      const hasOrbiter = orb.state === "PASS_ACTIVE";
      if (hasOrbiter) {
        orbiterPointsCount++;
        orbiterPassEverAvailable = true;
      }

      const hasContact = hasLos || hasOrbiter;
      if (hasContact) {
        combinedPointsCount++;
        currentBlackoutMin = 0;
      } else {
        currentBlackoutMin += strideMin;
        totalBlackoutMin += strideMin;
        if (currentBlackoutMin > maxBlackoutMin) {
          maxBlackoutMin = currentBlackoutMin;
        }
        blackoutSegmentsCount++;
      }
    }

    const losCoveragePercent = Math.round((losPointsCount / nPoints) * 100);
    const orbiterCoveragePercent = Math.round((orbiterPointsCount / nPoints) * 100);
    const combinedCoveragePercent = Math.round((combinedPointsCount / nPoints) * 100);

    // Compute Communication Score (0-100)
    // 70% weight on combined coverage percentage
    // 30% weight on blackout avoidance (penalizing blackouts > 15 min)
    const blackoutPenalty = Math.min(30, (maxBlackoutMin / 45.0) * 30);
    const rawScore = combinedCoveragePercent * 0.7 + Math.max(0, 30 - blackoutPenalty);
    const communicationScore = Math.max(5, Math.min(100, Math.round(rawScore)));

    const commContinuitySatisfied = requireContinuous
      ? maxBlackoutMin <= 5
      : maxBlackoutMin <= 25;

    let summaryExplanation = `Communication availability: ${combinedCoveragePercent}% coverage (LOS: ${losCoveragePercent}%, Orbiter pass: ${orbiterCoveragePercent}%). `;
    if (maxBlackoutMin > 0) {
      summaryExplanation += `Max RF blackout window: ${Math.round(maxBlackoutMin)} min.`;
    } else {
      summaryExplanation += "Continuous line-of-sight and orbital contact maintained throughout traverse.";
    }

    return {
      communicationScore,
      losCoveragePercent,
      orbiterCoveragePercent,
      combinedCoveragePercent,
      maxBlackoutDurationMin: Math.round(maxBlackoutMin),
      totalBlackoutDurationMin: Math.round(totalBlackoutMin),
      orbiterPassAvailable: orbiterPassEverAvailable,
      commContinuitySatisfied,
      blackoutSegmentsCount,
      summaryExplanation,
    };
  }
}

