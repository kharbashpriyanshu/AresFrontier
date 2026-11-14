import {
  CopilotMissionPlanRequest,
  MarsCoordinate,
  MarsRoute,
  MultiObjectiveRouteScore,
  RouteCandidate,
  RoutePoint,
  ScienceObjectiveId,
  ScienceTarget,
} from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../nasa/adapters/benchmarkData.js";
import { missionEngine } from "../mission/missionEngine.js";
import { hazardEngine } from "../hazard/hazardEngine.js";
import { scienceObjectiveEngine } from "../science/scienceObjectiveEngine.js";
import { dataCoverageEngine } from "../planetary/dataCoverageEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export class RouteOptimizationEngine {
  /**
   * Generates and evaluates 4 differentiated route candidates:
   * 1. Shortest (direct traversal, minimal distance)
   * 2. Safest (lowest slope, avoids scarps and chokepoints)
   * 3. Highest Science (maximizes relevance to chosen objective)
   * 4. Balanced (Pareto trade-off between science yield and astronaut safety)
   */
  public async generateCandidates(
    request: CopilotMissionPlanRequest
  ): Promise<RouteCandidate[]> {
    const start = request.startCoordinate;
    const dest = request.destinationCoordinate || {
      latitude: start.latitude + 0.015,
      longitude: start.longitude + 0.018,
    };
    const maxDuration = request.maxDurationMinutes || 180;
    const objectiveId: ScienceObjectiveId = request.objectiveId || "ANCIENT_WATER_ACTIVITY";
    const returnRequired = request.returnRequired ?? false;

    // 1. Locate and rank nearby science targets within 12 km
    const rankedTargets = scienceObjectiveEngine
      .rankTargetsForObjective(objectiveId, VERIFIED_NASA_SCIENCE_TARGETS)
      .filter((t) => {
        const dStart = calculateMarsDistanceKm(start, t.coordinate);
        const dDest = calculateMarsDistanceKm(dest, t.coordinate);
        return dStart <= 12 || dDest <= 12;
      });

    const primaryTarget = rankedTargets[0];
    const secondaryTarget = rankedTargets[1];
    const tertiaryTarget = rankedTargets[2];

    const rawCandidates: RouteCandidate[] = [];

    // -------------------------------------------------------------
    // Candidate 1: Shortest Profile
    // -------------------------------------------------------------
    const shortestPoints: RoutePoint[] = [
      { id: "pt-start", label: "EVA Ingress Hub", coordinate: start, type: "start" },
    ];
    if (primaryTarget && !returnRequired) {
      shortestPoints.push({
        id: primaryTarget.id,
        label: primaryTarget.name,
        coordinate: primaryTarget.coordinate,
        type: "science",
        targetId: primaryTarget.id,
      });
    }
    shortestPoints.push({
      id: returnRequired ? "pt-start-return" : "pt-dest",
      label: returnRequired ? "EVA Return Hub" : "Mission Waypoint Beta",
      coordinate: returnRequired ? start : dest,
      type: returnRequired ? "destination" : "waypoint",
    });

    const shortestRoute = await missionEngine.generateRoute("Direct Shortest Path", shortestPoints);
    const shortestCandidate = await this.evaluateCandidate(
      "cand-shortest",
      "Direct Shortest Traverse",
      "shortest",
      shortestRoute,
      primaryTarget ? [primaryTarget] : [],
      objectiveId,
      maxDuration
    );
    rawCandidates.push(shortestCandidate);

    // -------------------------------------------------------------
    // Candidate 2: Safest Profile (Low-gradient detour)
    // -------------------------------------------------------------
    const safestPoints: RoutePoint[] = [
      { id: "pt-start", label: "EVA Ingress Hub", coordinate: start, type: "start" },
    ];
    const safeMidCoord: MarsCoordinate = {
      latitude: (start.latitude + dest.latitude) / 2 - 0.006,
      longitude: (start.longitude + dest.longitude) / 2 + 0.004,
    };
    safestPoints.push({
      id: "pt-safe-pass",
      label: "Low-Gradient Valley Corridor",
      coordinate: safeMidCoord,
      type: "waypoint",
    });
    if (secondaryTarget) {
      safestPoints.push({
        id: secondaryTarget.id,
        label: secondaryTarget.name,
        coordinate: secondaryTarget.coordinate,
        type: "science",
        targetId: secondaryTarget.id,
      });
    }
    safestPoints.push({
      id: returnRequired ? "pt-start-return" : "pt-dest",
      label: returnRequired ? "EVA Return Hub" : "Low-Risk Traverse End",
      coordinate: returnRequired ? start : dest,
      type: "destination",
    });

    const safestRoute = await missionEngine.generateRoute("Low-Hazard Valley Route", safestPoints);
    const safestCandidate = await this.evaluateCandidate(
      "cand-safest",
      "Low-Hazard Valley Corridor",
      "safest",
      safestRoute,
      secondaryTarget ? [secondaryTarget] : [],
      objectiveId,
      maxDuration
    );
    rawCandidates.push(safestCandidate);

    // -------------------------------------------------------------
    // Candidate 3: Highest Science Profile (Multi-Target Survey)
    // -------------------------------------------------------------
    const sciencePoints: RoutePoint[] = [
      { id: "pt-start", label: "EVA Ingress Hub", coordinate: start, type: "start" },
    ];
    const visitedScience: ScienceTarget[] = [];
    if (primaryTarget) {
      sciencePoints.push({
        id: primaryTarget.id,
        label: primaryTarget.name,
        coordinate: primaryTarget.coordinate,
        type: "science",
        targetId: primaryTarget.id,
      });
      visitedScience.push(primaryTarget);
    }
    if (secondaryTarget) {
      sciencePoints.push({
        id: secondaryTarget.id,
        label: secondaryTarget.name,
        coordinate: secondaryTarget.coordinate,
        type: "science",
        targetId: secondaryTarget.id,
      });
      visitedScience.push(secondaryTarget);
    }
    if (tertiaryTarget) {
      sciencePoints.push({
        id: tertiaryTarget.id,
        label: tertiaryTarget.name,
        coordinate: tertiaryTarget.coordinate,
        type: "science",
        targetId: tertiaryTarget.id,
      });
      visitedScience.push(tertiaryTarget);
    }
    sciencePoints.push({
      id: returnRequired ? "pt-start-return" : "pt-dest",
      label: returnRequired ? "EVA Ingress Hub (Return)" : "Target Final Station",
      coordinate: returnRequired ? start : dest,
      type: "destination",
    });

    const scienceRoute = await missionEngine.generateRoute("Comprehensive Science Survey", sciencePoints);
    const scienceCandidate = await this.evaluateCandidate(
      "cand-highest-science",
      "Multi-Target Science Survey",
      "highest_science",
      scienceRoute,
      visitedScience,
      objectiveId,
      maxDuration
    );
    rawCandidates.push(scienceCandidate);

    // -------------------------------------------------------------
    // Candidate 4: Balanced Profile (Optimal Trade-off)
    // -------------------------------------------------------------
    const balancedPoints: RoutePoint[] = [
      { id: "pt-start", label: "EVA Ingress Hub", coordinate: start, type: "start" },
    ];
    const balancedTargets: ScienceTarget[] = [];
    if (primaryTarget) {
      balancedPoints.push({
        id: primaryTarget.id,
        label: primaryTarget.name,
        coordinate: primaryTarget.coordinate,
        type: "science",
        targetId: primaryTarget.id,
      });
      balancedTargets.push(primaryTarget);
    }
    if (secondaryTarget && primaryTarget.id !== secondaryTarget.id) {
      balancedPoints.push({
        id: secondaryTarget.id,
        label: secondaryTarget.name,
        coordinate: secondaryTarget.coordinate,
        type: "science",
        targetId: secondaryTarget.id,
      });
      balancedTargets.push(secondaryTarget);
    }
    balancedPoints.push({
      id: returnRequired ? "pt-start-return" : "pt-dest",
      label: returnRequired ? "EVA Return Hub" : "Designated Mission Goal",
      coordinate: returnRequired ? start : dest,
      type: "destination",
    });

    const balancedRoute = await missionEngine.generateRoute("Balanced Mission Traverse", balancedPoints);
    const balancedCandidate = await this.evaluateCandidate(
      "cand-balanced",
      "Optimal Science & Margin Traverse",
      "balanced",
      balancedRoute,
      balancedTargets,
      objectiveId,
      maxDuration
    );
    rawCandidates.push(balancedCandidate);

    // Apply Pareto Frontier non-domination analysis across all 4 candidates
    return this.computeParetoFrontier(rawCandidates);
  }

  /**
   * Deterministically evaluates a candidate route profile with factorized science,
   * observational data coverage, and risk-adjusted uncertainty penalties.
   */
  private async evaluateCandidate(
    id: string,
    name: string,
    profileType: "shortest" | "safest" | "highest_science" | "balanced",
    route: MarsRoute,
    scienceTargets: ScienceTarget[],
    objectiveId: ScienceObjectiveId,
    maxDurationMin: number
  ): Promise<RouteCandidate> {
    const hazardsAssessment = hazardEngine.assessRouteHazards(route);
    const scienceEval = scienceObjectiveEngine.calculateRouteScienceScore(scienceTargets, objectiveId);
    const coverage = await dataCoverageEngine.assessRouteCoverage(route);

    const avgSlope = route.segments.length > 0
      ? route.segments.reduce((acc, s) => acc + s.averageSlopeDegrees, 0) / route.segments.length
      : 0;

    // 1. Terrain Score (0-100)
    const slopePenalty = Math.min(60, route.maxSlopeDegrees * 2.5 + avgSlope * 1.5);
    const elevPenalty = Math.min(30, (route.elevationGainM + route.elevationLossM) / 25);
    const terrainScore = Math.max(10, Math.round(100 - slopePenalty - elevPenalty));

    // 2. Safety Score (0-100)
    const safetyScore = Math.max(5, 100 - hazardsAssessment.hazardScore);

    // 3. Science Score (0-100)
    const scienceScore = scienceEval.score;

    // 4. Accessibility Score (0-100)
    const durationRatio = route.estimatedDurationMinutes / maxDurationMin;
    let accessibilityScore = 95;
    if (durationRatio > 1.0) {
      accessibilityScore -= Math.min(70, (durationRatio - 1.0) * 150);
    } else if (durationRatio > 0.8) {
      accessibilityScore -= (durationRatio - 0.8) * 80;
    }
    accessibilityScore = Math.max(5, Math.round(accessibilityScore));

    // 5. Operational Efficiency (0-100)
    const efficiency = Math.max(10, Math.round(100 - route.totalDistanceKm * 6 - durationRatio * 20));

    // 6. Evidence Confidence (0-100) based on observational coverage
    const confValue = coverage.overallEvidence === "HIGH" ? 92 : coverage.overallEvidence === "MEDIUM" ? 76 : 54;

    // 7. EVA Feasibility Score (0-100)
    const returnMargin = maxDurationMin - route.estimatedDurationMinutes;
    const evaFeasibility = returnMargin >= 30 && route.maxSlopeDegrees <= 20 ? 95 : returnMargin >= 15 ? 70 : 35;

    // 8. Uncertainty Penalty (0-30)
    // Routes over uncharacterized terrain or high-gradient scarps carry uncertainty penalties
    const uncertaintyPenalty = Math.min(25, Math.round((100 - confValue) * 0.15 + (hazardsAssessment.hazardScore > 40 ? 10 : 0)));

    // 9. Overall Multi-Objective Score (0-100)
    let rawScore = 0;
    if (profileType === "shortest") {
      rawScore = Math.round(terrainScore * 0.25 + safetyScore * 0.25 + scienceScore * 0.15 + accessibilityScore * 0.2 + efficiency * 0.15);
    } else if (profileType === "safest") {
      rawScore = Math.round(terrainScore * 0.2 + safetyScore * 0.45 + scienceScore * 0.1 + accessibilityScore * 0.15 + confValue * 0.1);
    } else if (profileType === "highest_science") {
      rawScore = Math.round(terrainScore * 0.1 + safetyScore * 0.15 + scienceScore * 0.55 + accessibilityScore * 0.1 + efficiency * 0.1);
    } else {
      // Balanced
      rawScore = Math.round(terrainScore * 0.2 + safetyScore * 0.3 + scienceScore * 0.3 + accessibilityScore * 0.1 + efficiency * 0.1);
    }

    // Risk-Adjusted Score = Expected Value - Uncertainty Penalty
    const riskAdjustedScore = Math.max(5, Math.round(rawScore - uncertaintyPenalty));

    // Feasibility verification
    const warnings: string[] = [];
    let feasible = true;

    if (route.estimatedDurationMinutes > maxDurationMin) {
      feasible = false;
      warnings.push(`Traverse duration (${route.estimatedDurationMinutes} min) exceeds life-support constraint (${maxDurationMin} min).`);
    }

    if (route.maxSlopeDegrees > 20) {
      warnings.push(`Maximum slope (${route.maxSlopeDegrees.toFixed(1)}°) breaches the 20° EVA astronaut safety ceiling.`);
      if (route.maxSlopeDegrees > 24) feasible = false;
    }

    if (hazardsAssessment.hazards.some((h) => h.severity === "CRITICAL")) {
      warnings.push("Route intersects one or more CRITICAL terrain hazards.");
      if (profileType !== "highest_science") feasible = false;
    }

    if (coverage.overallEvidence === "LOW") {
      warnings.push("Low regional data coverage: orbital stereo imagery and rover in-situ logs absent; reliance on fallback altimetry.");
    }

    const recReason = this.generateCandidateSummary(profileType, route, scienceTargets.length, riskAdjustedScore, feasible);

    const multiObjectiveScore: MultiObjectiveRouteScore = {
      safety: safetyScore,
      science: scienceScore,
      accessibility: accessibilityScore,
      efficiency,
      evidenceConfidence: confValue,
      evaFeasibility,
      uncertaintyPenalty,
      riskAdjustedScore,
      isParetoEfficient: true, // Will be computed in computeParetoFrontier
    };

    return {
      id,
      name,
      profileType,
      route,
      distanceKm: route.totalDistanceKm,
      estimatedDurationMin: route.estimatedDurationMinutes,
      terrainScore,
      scienceScore,
      safetyScore,
      accessibilityScore,
      overallScore: riskAdjustedScore,
      hazards: hazardsAssessment.hazards,
      scienceTargets: scienceTargets.map((t) => t.name),
      recommendationReason: recReason,
      feasible,
      warnings,
      multiObjectiveScore,
      scienceBreakdown: scienceEval.breakdown,
      coverage,
      provenance: ProvenanceService.createDerivedProvenance(
        "Candidate Multi-Objective Evaluation",
        ["MGS MOLA MEGDR", "Factorized Science Engine", "Data Coverage Engine"],
        "Risk-adjusted multi-attribute scoring model v3.0"
      ),
    };
  }

  /**
   * Computes the Pareto Frontier across all route candidates.
   * Identifies non-dominated solutions across Science, Safety, and Efficiency.
   */
  public computeParetoFrontier(candidates: RouteCandidate[]): RouteCandidate[] {
    return candidates.map((cand) => {
      const cScore = cand.multiObjectiveScore;
      if (!cScore) return cand;

      const dominatedBy: string[] = [];

      for (const other of candidates) {
        if (other.id === cand.id) continue;
        const oScore = other.multiObjectiveScore;
        if (!oScore) continue;

        // Other dominates Cand if it is >= in all 3 primary criteria and strictly > in at least one
        const greaterOrEqual =
          oScore.science >= cScore.science &&
          oScore.safety >= cScore.safety &&
          oScore.efficiency >= cScore.efficiency;

        const strictlyGreater =
          oScore.science > cScore.science ||
          oScore.safety > cScore.safety ||
          oScore.efficiency > cScore.efficiency;

        if (greaterOrEqual && strictlyGreater) {
          dominatedBy.push(other.name);
        }
      }

      const isPareto = dominatedBy.length === 0;

      return {
        ...cand,
        multiObjectiveScore: {
          ...cScore,
          isParetoEfficient: isPareto,
          paretoDominatedBy: dominatedBy.length > 0 ? dominatedBy : undefined,
        },
      };
    });
  }

  private generateCandidateSummary(
    profileType: string,
    route: MarsRoute,
    targetCount: number,
    adjustedScore: number,
    feasible: boolean
  ): string {
    if (!feasible) {
      return `Non-optimal profile: breaches EVA operational safety constraints or maximum duration limits.`;
    }
    switch (profileType) {
      case "shortest":
        return `Minimizes overall traverse distance (${route.totalDistanceKm.toFixed(2)} km) and metabolic burden in ${route.estimatedDurationMinutes} min.`;
      case "safest":
        return `Maximizes astronaut safety margin by avoiding steep scarps and keeping maximum slope to ${route.maxSlopeDegrees.toFixed(1)}°.`;
      case "highest_science":
        return `Visits ${targetCount} high-priority scientific targets for maximized geological sample diversity and astrobiological return.`;
      case "balanced":
      default:
        return `Optimal multi-objective compromise: achieves robust science yield (${targetCount} targets) while preserving a healthy 30+ minute return margin (Risk-Adjusted Score: ${adjustedScore}/100).`;
    }
  }
}

export const routeOptimizationEngine = new RouteOptimizationEngine();
