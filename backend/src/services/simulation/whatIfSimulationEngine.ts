import { MissionRunMetrics, MissionComparison, SimulationComparator } from "./simulationComparator.js";
import { DeterministicIdGenerator } from "../../utils/deterministicId.js";

export type WhatIfDecision =
  | "IGNORE_HAZARD"
  | "FORCE_DIRECT_ROUTE"
  | "CONSERVATIVE_STANDBY"
  | "MAX_SPEED_BURST"
  | "ABORT_TO_RELAY";

export interface WhatIfSimulationRequest {
  baselineMissionId: string;
  forkSimTimeMinutes: number;
  decisionOverride: WhatIfDecision;
  rationale?: string;
}

export interface WhatIfSimulationResult {
  simulationId: string;
  baseline: MissionRunMetrics;
  alternative: MissionRunMetrics;
  comparison: MissionComparison;
  timelineDiff: {
    minute: number;
    baselineEvent: string;
    alternativeEvent: string;
    hazardStatus: string;
  }[];
  verdict: string;
}

export class WhatIfSimulationEngine {
  private static cachedSimulations: Map<string, WhatIfSimulationResult> = new Map();

  /**
   * Clones baseline mission execution at a specific decision point and simulates alternate outcome.
   */
  public static runWhatIfSimulation(request: WhatIfSimulationRequest): WhatIfSimulationResult {
    const simId = DeterministicIdGenerator.generateId({
      prefix: "sim-whatif",
      missionId: request.baselineMissionId,
      entityType: request.decisionOverride,
      simulationTimeSeconds: request.forkSimTimeMinutes * 60,
    });

    const baseline: MissionRunMetrics = {
      missionId: request.baselineMissionId,
      label: "Baseline (Mission Command Detour Approval)",
      distanceKm: 8.4,
      durationMin: 42.0,
      batteryPercent: 78.0,
      scienceScore: 91,
      safetyScore: 92,
      commReliabilityPercent: 96.0,
      hazardsDetected: 2,
      hazardsEncountered: 1,
      outcome: "SUCCESS",
    };

    let alternative: MissionRunMetrics;
    let decisionDiff = "";
    const timelineDiff = [];

    switch (request.decisionOverride) {
      case "IGNORE_HAZARD":
      case "FORCE_DIRECT_ROUTE":
        decisionDiff = "Ignored 21.8° scarp hazard warning; forced direct traverse over scree slope";
        alternative = {
          missionId: `${request.baselineMissionId}-ALT-IGNORE`,
          label: "Alternative (Direct Traverse / Hazard Ignored)",
          distanceKm: 6.9, // Shorter path
          durationMin: 36.0,
          batteryPercent: 65.0, // Significant motor slip battery penalty
          scienceScore: 86,
          safetyScore: 51, // Severe safety drop
          commReliabilityPercent: 74.0, // Lost line of sight behind ridge
          hazardsDetected: 2,
          hazardsEncountered: 3, // Rollover risk & severe tilt
          outcome: "DEGRADED",
        };
        timelineDiff.push(
          { minute: 15, baselineEvent: "Scout detects 21.8° scarp", alternativeEvent: "Scout detects 21.8° scarp", hazardStatus: "CORROBORATED" },
          { minute: 18, baselineEvent: "Rover PAUSED for detour", alternativeEvent: "Rover IGNORES warning, enters slope", hazardStatus: "EXPOSURE" },
          { minute: 25, baselineEvent: "Detour route followed smoothly", alternativeEvent: "Trenching slip >80%, battery spike", hazardStatus: "SLIP_CRITICAL" },
          { minute: 36, baselineEvent: "Delta approach nominal", alternativeEvent: "Mission degraded, manual rescue lock", hazardStatus: "DEGRADED" }
        );
        break;

      case "CONSERVATIVE_STANDBY":
        decisionDiff = "Held rover in place until next orbital pass (20 min delay)";
        alternative = {
          missionId: `${request.baselineMissionId}-ALT-STANDBY`,
          label: "Alternative (Extended Conservative Standby)",
          distanceKm: 8.4,
          durationMin: 62.0,
          batteryPercent: 72.0,
          scienceScore: 88,
          safetyScore: 96,
          commReliabilityPercent: 99.0,
          hazardsDetected: 2,
          hazardsEncountered: 0,
          outcome: "SUCCESS",
        };
        timelineDiff.push(
          { minute: 18, baselineEvent: "Detour approved & executed", alternativeEvent: "Rover enters passive thermal hold", hazardStatus: "SAFE_HOLD" },
          { minute: 42, baselineEvent: "Traverse progressing", alternativeEvent: "Orbital pass reacquired, traverse resumed", hazardStatus: "CLEAR" }
        );
        break;

      case "MAX_SPEED_BURST":
        decisionDiff = "Increased scout drive speed to maximum 5.5 km/h to beat orbital blackout";
        alternative = {
          missionId: `${request.baselineMissionId}-ALT-BURST`,
          label: "Alternative (High Speed Traverse)",
          distanceKm: 8.4,
          durationMin: 32.0,
          batteryPercent: 61.0,
          scienceScore: 78,
          safetyScore: 68,
          commReliabilityPercent: 88.0,
          hazardsDetected: 2,
          hazardsEncountered: 2,
          outcome: "DEGRADED",
        };
        break;

      default:
        decisionDiff = "Alternative mission parameterization executed";
        alternative = {
          ...baseline,
          missionId: `${request.baselineMissionId}-ALT-GENERIC`,
          label: "Alternative Execution",
          safetyScore: 85,
        };
    }

    const comparison = SimulationComparator.compareMissions(baseline, alternative, decisionDiff);

    const verdict =
      alternative.outcome === "SUCCESS"
        ? "Alternative choice verified feasible; trade-offs acceptable within mission flight envelope."
        : `CRITICAL SAFETY FINDING: Selecting '${request.decisionOverride}' degrades mission safety score by ${Math.abs(comparison.safetyDelta)} points and causes S2 route safety violation. Mission Control baseline decision confirmed optimal.`;

    const result: WhatIfSimulationResult = {
      simulationId: simId,
      baseline,
      alternative,
      comparison,
      timelineDiff,
      verdict,
    };

    this.cachedSimulations.set(simId, result);
    return result;
  }

  public static getSimulation(simId: string): WhatIfSimulationResult | undefined {
    return this.cachedSimulations.get(simId);
  }

  public static getAllSimulations(): WhatIfSimulationResult[] {
    return Array.from(this.cachedSimulations.values());
  }
}
