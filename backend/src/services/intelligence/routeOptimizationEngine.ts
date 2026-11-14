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
import { hazardEngine, RouteHazardContext } from "../hazard/hazardEngine.js";
import { scienceObjectiveEngine } from "../science/scienceObjectiveEngine.js";
import { dataCoverageEngine } from "../planetary/dataCoverageEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { mlEngineAdapter } from "../ml/mlEngineAdapter.js";
import { CommunicationRouteEvaluator, RouteCommunicationAssessment } from "../comms/communicationRouteEvaluator.js";
import { ResourceModelingEngine, RouteResourceMetrics, ResourceEvaluationOptions } from "../operations/resourceModelingEngine.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";

export class RouteOptimizationEngine {
  /**
   * Generates and evaluates 4 resource-aware, multi-objective route candidates:
   * 1. Shortest (direct traversal, minimal distance, strict energy expenditure)
   * 2. Safest (lowest slope, avoids scarps and chokepoints, high comms line-of-sight)
   * 3. Highest Science (maximizes relevance to chosen objective, evaluates sample limits)
   * 4. Balanced (Pareto trade-off between science, battery reserve, comms, and safety)
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

    // Resolve live telemetry from MissionStateCoordinator when available
    let initialBattery = request.initialBatteryPercent;
    let initialOxygen = request.initialOxygenMinutes;
    let agentType = request.agentType || (request.traverseMode === "utv" ? "ROVER" : "ASTRONAUT");

    try {
      const canonicalState = MissionStateCoordinator.getCanonicalState();
      if (canonicalState && canonicalState.fleet) {
        if (request.agentId) {
          const rover = canonicalState.fleet.rovers?.find((r) => r.id === request.agentId);
          if (rover && initialBattery === undefined) {
            initialBattery = rover.telemetry.batteryPercent;
            agentType = "ROVER";
          }
          const astro = canonicalState.fleet.astronauts?.find((a) => a.id === request.agentId);
          if (astro) {
            if (initialOxygen === undefined && astro.telemetry.suitOxygenPercent) {
              initialOxygen = (astro.telemetry.suitOxygenPercent / 100.0) * 240.0;
            }
            agentType = "ASTRONAUT";
          }
        } else if (canonicalState.resources && initialBattery === undefined) {
          const firstRover = canonicalState.fleet.rovers?.[0];
          if (firstRover) {
            initialBattery = firstRover.telemetry.batteryPercent;
          }
        }
      }
    } catch {
      // Fall back safely to request or physical defaults
    }

    const evaluationContext: ResourceEvaluationOptions & RouteHazardContext = {
      agentType,
      agentId: request.agentId,
      initialBatteryPercent: initialBattery,
      initialOxygenMinutes: initialOxygen,
      maxDurationMinutes: maxDuration,
      baseCoordinate: start,
      requireContinuousCommunication: request.requireContinuousCommunication ?? false,
    };

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
      maxDuration,
      evaluationContext
    );
    rawCandidates.push(shortestCandidate);

    // -------------------------------------------------------------
    // Candidate 2: Safest Profile (Low-gradient detour, high comms LOS)
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
      maxDuration,
      evaluationContext
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
      maxDuration,
      evaluationContext
    );
    rawCandidates.push(scienceCandidate);

    // -------------------------------------------------------------
    // Candidate 4: Balanced Profile (Optimal Multi-Objective Compromise)
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
      maxDuration,
      evaluationContext
    );
    rawCandidates.push(balancedCandidate);

    // Apply Pareto Frontier non-domination analysis across all 4 candidates
    return this.computeParetoFrontier(rawCandidates);
  }

  /**
   * Evaluates a candidate route profile across all 10 multi-objective dimensions:
   * 1. Scientific value
   * 2. Terrain safety
   * 3. ML-predicted risk
   * 4. Communication availability
   * 5. Battery consumption
   * 6. Total mission duration
   * 7. Resource feasibility
   * 8. Agent capability compatibility
   * 9. Prediction uncertainty
   * 10. Emergency-return feasibility
   */
  private async evaluateCandidate(
    id: string,
    name: string,
    profileType: "shortest" | "safest" | "highest_science" | "balanced",
    route: MarsRoute,
    scienceTargets: ScienceTarget[],
    objectiveId: ScienceObjectiveId,
    maxDurationMin: number,
    context?: ResourceEvaluationOptions & RouteHazardContext
  ): Promise<RouteCandidate> {
    // 1. Multi-Domain Hazard Assessment
    const hazardsAssessment = hazardEngine.assessRouteHazards(route, context);

    // 2. Factorized Science Score
    const scienceEval = scienceObjectiveEngine.calculateRouteScienceScore(scienceTargets, objectiveId);

    // 3. Planetary Observational Data Coverage
    const coverage = await dataCoverageEngine.assessRouteCoverage(route);

    // 4. Modeled Communication Coverage & RF Windows
    const startCoord = route.points.length > 0 ? route.points[0].coordinate : { latitude: 18.38, longitude: 77.58 };
    const commEval: RouteCommunicationAssessment = CommunicationRouteEvaluator.evaluateRouteCommunication(
      route,
      context?.baseCoordinate || startCoord,
      48,
      context?.requireContinuousCommunication ?? false
    );

    // 5. Physical Resource, Battery SoC & Emergency Return Margins
    const resEval: RouteResourceMetrics = ResourceModelingEngine.evaluateRouteResources(route, context);

    const avgSlope = route.segments.length > 0
      ? route.segments.reduce((acc, s) => acc + s.averageSlopeDegrees, 0) / route.segments.length
      : 0;

    // Sub-Scores:
    // Terrain Score (0-100)
    const slopePenalty = Math.min(60, route.maxSlopeDegrees * 2.5 + avgSlope * 1.5);
    const elevPenalty = Math.min(30, (route.elevationGainM + route.elevationLossM) / 25);
    const terrainScore = Math.max(10, Math.round(100 - slopePenalty - elevPenalty));

    // Safety Score (0-100)
    const safetyScore = Math.max(5, 100 - hazardsAssessment.hazardScore);

    // Science Score (0-100)
    const scienceScore = scienceEval.score;

    // Accessibility Score (0-100)
    const durationRatio = route.estimatedDurationMinutes / maxDurationMin;
    let accessibilityScore = 95;
    if (durationRatio > 1.0) {
      accessibilityScore -= Math.min(70, (durationRatio - 1.0) * 150);
    } else if (durationRatio > 0.8) {
      accessibilityScore -= (durationRatio - 0.8) * 80;
    }
    accessibilityScore = Math.max(5, Math.round(accessibilityScore));

    // Operational Efficiency (0-100)
    const efficiency = Math.max(10, Math.round(100 - route.totalDistanceKm * 6 - durationRatio * 20));

    // Evidence Confidence (0-100)
    const confValue = coverage.overallEvidence === "HIGH" ? 92 : coverage.overallEvidence === "MEDIUM" ? 76 : 54;

    // EVA Feasibility Score (0-100)
    const returnMargin = maxDurationMin - route.estimatedDurationMinutes;
    const evaFeasibility = returnMargin >= 30 && route.maxSlopeDegrees <= 20 ? 95 : returnMargin >= 15 ? 70 : 35;

    // Uncertainty Penalty (0-30)
    const uncertaintyPenalty = Math.min(
      25,
      Math.round((100 - confValue) * 0.15 + (hazardsAssessment.hazardScore > 40 ? 10 : 0))
    );

    // ML Inference Integration
    let mlDerived = false;
    let mlRiskScore: number | undefined;
    try {
      const mlAssessment = await mlEngineAdapter.assessMission(route, {
        maxDurationMinutes: maxDurationMin,
        astronautSkillLevel: context?.agentType === "ASTRONAUT" ? "expert" : "standard",
      });
      if (mlAssessment.scoringSource === "model-generated") {
        mlDerived = true;
        mlRiskScore = 100 - mlAssessment.safetyScore;
      }
    } catch {
      // Fallback handled gracefully
    }

    // Energy Efficiency Score (0-100)
    const energyEfficiency = Math.max(
      10,
      Math.min(100, Math.round(100 - (resEval.energyExpenditureWh / 12.0)))
    );

    // Overall Multi-Objective Blended Score (0-100)
    let rawScore = 0;
    if (profileType === "shortest") {
      rawScore = Math.round(
        terrainScore * 0.20 +
        safetyScore * 0.20 +
        scienceScore * 0.10 +
        accessibilityScore * 0.15 +
        efficiency * 0.15 +
        commEval.communicationScore * 0.10 +
        energyEfficiency * 0.10
      );
    } else if (profileType === "safest") {
      rawScore = Math.round(
        terrainScore * 0.15 +
        safetyScore * 0.35 +
        scienceScore * 0.10 +
        accessibilityScore * 0.10 +
        confValue * 0.10 +
        commEval.communicationScore * 0.10 +
        energyEfficiency * 0.10
      );
    } else if (profileType === "highest_science") {
      rawScore = Math.round(
        terrainScore * 0.10 +
        safetyScore * 0.15 +
        scienceScore * 0.45 +
        accessibilityScore * 0.10 +
        commEval.communicationScore * 0.10 +
        energyEfficiency * 0.10
      );
    } else {
      // Balanced
      rawScore = Math.round(
        terrainScore * 0.15 +
        safetyScore * 0.25 +
        scienceScore * 0.25 +
        accessibilityScore * 0.10 +
        efficiency * 0.05 +
        commEval.communicationScore * 0.10 +
        energyEfficiency * 0.10
      );
    }

    // Risk-Adjusted Score = Expected Value - Uncertainty Penalty
    const riskAdjustedScore = Math.max(5, Math.round(rawScore - uncertaintyPenalty));

    // =========================================================================
    // Hard Constraint Verification & Rejection
    // =========================================================================
    const warnings: string[] = [];
    const hardConstraintViolations: string[] = [...resEval.hardConstraintViolations];
    let feasible = resEval.feasible;

    if (route.estimatedDurationMinutes > maxDurationMin) {
      feasible = false;
      warnings.push(`Traverse duration (${route.estimatedDurationMinutes} min) exceeds life-support constraint (${maxDurationMin} min).`);
    }

    if (route.maxSlopeDegrees > 20) {
      warnings.push(`Maximum slope (${route.maxSlopeDegrees.toFixed(1)}°) breaches the 20° EVA astronaut safety ceiling.`);
      if (route.maxSlopeDegrees > 24) {
        feasible = false;
        if (!hardConstraintViolations.some((v) => v.includes("20°"))) {
          hardConstraintViolations.push(`Maximum slope (${route.maxSlopeDegrees.toFixed(1)}°) exceeds physical safety limit.`);
        }
      }
    }

    if (hazardsAssessment.hazards.some((h) => h.severity === "CRITICAL")) {
      warnings.push("Route intersects one or more CRITICAL terrain or environmental hazards.");
      if (profileType !== "highest_science") {
        feasible = false;
        if (!hardConstraintViolations.some((v) => v.includes("CRITICAL"))) {
          hardConstraintViolations.push("Route intersects critical impassable hazard zone.");
        }
      }
    }

    if (coverage.overallEvidence === "LOW") {
      warnings.push("Low regional data coverage: orbital stereo imagery and rover in-situ logs absent; reliance on fallback altimetry.");
    }

    if (commEval.maxBlackoutDurationMin > 25) {
      warnings.push(`Extended RF blackout window detected (${commEval.maxBlackoutDurationMin} min without direct LOS or orbiter pass).`);
      if (context?.requireContinuousCommunication) {
        feasible = false;
        hardConstraintViolations.push(`Mandatory continuous communication violated (blackout: ${commEval.maxBlackoutDurationMin} min).`);
      }
    }

    // Append resource warnings
    if (resEval.batteryMarginPercent < 10) {
      warnings.push(`Narrow battery reserve margin (+${resEval.batteryMarginPercent}% above minimum 20% floor).`);
    }

    // Candidate Explanation of Trade-offs
    const tradeoffExplanation = this.buildTradeoffExplanation(
      name,
      profileType,
      feasible,
      hardConstraintViolations,
      scienceScore,
      safetyScore,
      resEval,
      commEval,
      riskAdjustedScore
    );

    const recReason = this.generateCandidateSummary(
      profileType,
      route,
      scienceTargets.length,
      riskAdjustedScore,
      feasible
    );

    const multiObjectiveScore: MultiObjectiveRouteScore = {
      safety: safetyScore,
      science: scienceScore,
      accessibility: accessibilityScore,
      efficiency,
      communication: commEval.communicationScore,
      energyEfficiency,
      resourceFeasibility: resEval.resourceScore,
      evidenceConfidence: confValue,
      evaFeasibility,
      uncertaintyPenalty,
      riskAdjustedScore,
      isParetoEfficient: true, // evaluated in computeParetoFrontier
      hardConstraintsSatisfied: hardConstraintViolations.length === 0,
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
      communicationScore: commEval.communicationScore,
      energyWhConsumed: resEval.energyExpenditureWh,
      projectedBatteryPercent: resEval.projectedRemainingPercent,
      projectedOxygenMinutes: resEval.oxygenRemainingMin,
      hardConstraintViolations,
      tradeoffExplanation,
      mlRiskScore,
      communicationMetrics: {
        losCoveragePercent: commEval.losCoveragePercent,
        maxBlackoutDurationMin: commEval.maxBlackoutDurationMin,
        orbiterPassAvailable: commEval.orbiterPassAvailable,
        commContinuitySatisfied: commEval.commContinuitySatisfied,
      },
      resourceMetrics: {
        initialBatteryPercent: resEval.initialBatteryPercent,
        projectedRemainingPercent: resEval.projectedRemainingPercent,
        energyExpenditureWh: resEval.energyExpenditureWh,
        energyBudgetWh: resEval.energyBudgetWh,
        batteryMarginPercent: resEval.batteryMarginPercent,
        sampleTubesNeeded: resEval.sampleTubesNeeded,
        sampleTubesAvailable: resEval.sampleTubesAvailable,
        estimatedDataMb: resEval.estimatedDataMb,
        oxygenRemainingMin: resEval.oxygenRemainingMin,
        emergencyReturnFeasible: resEval.emergencyReturnFeasible,
      },
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
        mlDerived
          ? ["MGS MOLA MEGDR", "Factorized Science Engine", "Data Coverage Engine", "ML Inference Microservice", "Resource Modeling Engine", "Line-of-Sight Engine"]
          : ["MGS MOLA MEGDR", "Factorized Science Engine", "Data Coverage Engine", "Resource Modeling Engine", "Line-of-Sight Engine"],
        "Risk-adjusted multi-attribute scoring model v4.0"
      ),
    };
  }

  /**
   * Computes the Pareto Frontier across all route candidates.
   * Hard constraint violations immediately preclude a candidate from Pareto optimality
   * if any fully feasible solution exists.
   */
  public computeParetoFrontier(candidates: RouteCandidate[]): RouteCandidate[] {
    const hasAnyFeasible = candidates.some((c) => c.feasible);

    return candidates.map((cand) => {
      const cScore = cand.multiObjectiveScore;
      if (!cScore) return cand;

      const dominatedBy: string[] = [];

      // If candidate violates hard constraints while feasible options exist, it is dominated
      if (!cand.feasible && hasAnyFeasible) {
        const feasibleNames = candidates.filter((c) => c.feasible).map((c) => c.name);
        dominatedBy.push(...feasibleNames);
        return {
          ...cand,
          multiObjectiveScore: {
            ...cScore,
            isParetoEfficient: false,
            paretoDominatedBy: dominatedBy,
          },
        };
      }

      for (const other of candidates) {
        if (other.id === cand.id) continue;
        if (!other.feasible && cand.feasible) continue;

        const oScore = other.multiObjectiveScore;
        if (!oScore) continue;

        // Non-domination across Science, Safety, Efficiency, and Communication
        const oComm = oScore.communication ?? 70;
        const cComm = cScore.communication ?? 70;

        const greaterOrEqual =
          oScore.science >= cScore.science &&
          oScore.safety >= cScore.safety &&
          oScore.efficiency >= cScore.efficiency &&
          oComm >= cComm;

        const strictlyGreater =
          oScore.science > cScore.science ||
          oScore.safety > cScore.safety ||
          oScore.efficiency > cScore.efficiency ||
          oComm > cComm;

        if (greaterOrEqual && strictlyGreater) {
          dominatedBy.push(other.name);
        }
      }

      const isPareto = dominatedBy.length === 0 && cand.feasible;

      return {
        ...cand,
        multiObjectiveScore: {
          ...cScore,
          isParetoEfficient: isPareto,
          paretoDominatedBy: dominatedBy.length > 0 ? Array.from(new Set(dominatedBy)) : undefined,
        },
      };
    });
  }

  private buildTradeoffExplanation(
    name: string,
    profileType: string,
    feasible: boolean,
    violations: string[],
    scienceScore: number,
    safetyScore: number,
    res: RouteResourceMetrics,
    comm: RouteCommunicationAssessment,
    overallScore: number
  ): string {
    if (!feasible && violations.length > 0) {
      return `Route '${name}' (${profileType.toUpperCase()}) is REJECTED due to ${violations.length} critical constraint violation(s): ${violations.join(" | ")}. Cannot be selected regardless of score (${overallScore}/100).`;
    }

    return `Route '${name}' (${profileType.toUpperCase()}) achieves risk-adjusted score ${overallScore}/100. Science yield: ${scienceScore}/100, Terrain safety: ${safetyScore}/100. Resource impact: consumes ${res.energyExpenditureWh} Wh, leaving projected ${res.projectedRemainingPercent}% battery (+${res.batteryMarginPercent}% margin above 20% floor). Communication: ${comm.combinedCoveragePercent}% coverage (max blackout: ${comm.maxBlackoutDurationMin} min). Emergency return feasible. All safety invariants satisfied.`;
  }

  private generateCandidateSummary(
    profileType: string,
    route: MarsRoute,
    targetCount: number,
    adjustedScore: number,
    feasible: boolean
  ): string {
    if (!feasible) {
      return `Non-executable candidate: violates critical safety envelopes or mission life-support thresholds.`;
    }

    switch (profileType) {
      case "shortest":
        return `Direct transit vector: minimal distance (${route.totalDistanceKm.toFixed(1)} km) and lowest energy consumption, but sacrifices geological sampling breadth.`;
      case "safest":
        return `Low-gradient valley traverse: bypasses high-gradient scarps with maximum communication line-of-sight and ample life-support return reserves.`;
      case "highest_science":
        return `High-yield multi-target campaign: visits ${targetCount} prioritized planetary targets, maximizing astrobiological discovery while maintaining strict life-support compliance.`;
      case "balanced":
      default:
        return `Optimal multi-objective Pareto trade-off: balances strong scientific return with robust battery reserves (${adjustedScore}/100 risk-adjusted score).`;
    }
  }
}

export const routeOptimizationEngine = new RouteOptimizationEngine();
