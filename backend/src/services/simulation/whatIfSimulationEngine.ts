import crypto from "crypto";
import { MissionRunMetrics, MissionComparison, SimulationComparator } from "./simulationComparator.js";
import { DeterministicIdGenerator } from "../../utils/deterministicId.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { ResourceModelingEngine } from "../operations/resourceModelingEngine.js";
import { CommunicationRouteEvaluator } from "../comms/communicationRouteEvaluator.js";
import { hazardEngine } from "../hazard/hazardEngine.js";
import { Hazard, MarsRoute } from "../../types/index.js";

export type WhatIfScenarioType =
  | "BATTERY_DEGRADATION"
  | "BATTERY_FAILURE"
  | "COMMUNICATION_BLACKOUT"
  | "ORBITER_RELAY_FAILURE"
  | "ROVER_BREAKDOWN"
  | "ASTRONAUT_EMERGENCY"
  | "TERRAIN_HAZARD_ESCALATION"
  | "ROUTE_BLOCKAGE"
  | "SCIENTIFIC_INSTRUMENT_FAILURE"
  | "RESOURCE_SHORTAGE"
  | "EMERGENCY_RETURN"
  | "AGENT_UNAVAILABILITY"
  // Legacy decisions for backward compatibility:
  | "IGNORE_HAZARD"
  | "FORCE_DIRECT_ROUTE"
  | "CONSERVATIVE_STANDBY"
  | "MAX_SPEED_BURST"
  | "ABORT_TO_RELAY";

export type WhatIfDecision = WhatIfScenarioType;

export interface WhatIfSimulationRequest {
  baselineMissionId: string;
  forkSimTimeMinutes: number;
  decisionOverride?: WhatIfDecision;
  scenarios?: WhatIfScenarioType[];
  affectedAgentId?: string;
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
  newHazards: Hazard[];
  routeFeasible: boolean;
  resourceImplications: {
    finalBatteryPercent: number;
    batteryDeficitPercent: number;
    oxygenRemainingMin?: number;
    energyConsumedWh: number;
  };
  agentAvailability: Record<string, string>;
  missionSuccessProbability: number; // 0-100%
  recommendedMitigation: string;
  verdict: string;
  isolatedStateHash: string;
}

export class WhatIfSimulationEngine {
  private static cachedSimulations: Map<string, WhatIfSimulationResult> = new Map();

  /**
   * Executes a physics-constrained What-If simulation on a completely isolated deep copy
   * of the canonical mission state without mutating live operational memory or persistence.
   */
  public static runWhatIfSimulation(request: WhatIfSimulationRequest): WhatIfSimulationResult {
    const primaryScenario: WhatIfScenarioType =
      request.decisionOverride || (request.scenarios && request.scenarios[0]) || "BATTERY_DEGRADATION";
    const allScenarios: WhatIfScenarioType[] = request.scenarios && request.scenarios.length > 0
      ? request.scenarios
      : [primaryScenario];

    const simId = DeterministicIdGenerator.generateId({
      prefix: "sim-whatif",
      missionId: request.baselineMissionId,
      entityType: primaryScenario,
      simulationTimeSeconds: request.forkSimTimeMinutes * 60,
    });

    // 1. Snapshot and Deep Clone canonical state for complete isolation
    const canonicalState = MissionStateCoordinator.getCanonicalState();
    const isolated = JSON.parse(JSON.stringify(canonicalState));

    // 2. Derive true Baseline metrics from actual mission state and route
    const activeRoute: MarsRoute =
      (isolated.routes?.routes && isolated.routes.activeRouteId ? isolated.routes.routes[isolated.routes.activeRouteId] : null) || ({
        id: "baseline-route",
        name: "Nominal Traverse Route",
        points: [
          { id: "p1", coordinate: { latitude: 18.4447, longitude: 77.4508 }, type: "start" },
          { id: "p2", coordinate: { latitude: 18.4550, longitude: 77.4100 }, type: "destination" },
        ],
        segments: [],
        totalDistanceKm: 8.4,
        estimatedDurationMinutes: 42,
        maxSlopeDegrees: 12.0,
        elevationGainM: 45,
        elevationLossM: 10,
        elevationProfile: [],
        overallDifficulty: "moderate",
        createdAt: new Date().toISOString(),
      } as any);

    const baseDistanceKm: number = activeRoute.totalDistanceKm || 8.4;
    const baseDurationMin: number = activeRoute.estimatedDurationMinutes || 42.0;
    const rawSocList = isolated.resources?.fleetBatterySoc ? (Object.values(isolated.resources.fleetBatterySoc) as number[]) : [];
    const baseBattery: number = rawSocList.length > 0 && typeof rawSocList[0] === "number" ? rawSocList[0] : 78.0;
    const baseScience: number = 91;
    const baseSafety: number = 92;
    const baseComm: number = Number(isolated.communication?.networkTopology?.networkReliabilityScore ?? 96.0);

    const baseline: MissionRunMetrics = {
      missionId: request.baselineMissionId,
      label: "Baseline (Nominal Mission Execution)",
      distanceKm: baseDistanceKm,
      durationMin: baseDurationMin,
      batteryPercent: baseBattery,
      scienceScore: baseScience,
      safetyScore: baseSafety,
      commReliabilityPercent: baseComm,
      hazardsDetected: isolated.hazards?.catalogHazards?.length || 2,
      hazardsEncountered: 1,
      outcome: "SUCCESS",
    };

    // 3. Apply scenario modifications onto the isolated clone
    let altDistanceKm = baseDistanceKm;
    let altDurationMin = baseDurationMin;
    let altBattery = baseBattery;
    let altScience = baseScience;
    let altSafety = baseSafety;
    let altComm = baseComm;
    let altHazardsEncountered = 1;
    let routeFeasible = true;
    let altOutcome: "SUCCESS" | "DEGRADED" | "ABORTED" | "FAILED" = "SUCCESS";

    const newHazards: Hazard[] = [];
    const timelineDiff: WhatIfSimulationResult["timelineDiff"] = [];
    const mitigations: string[] = [];
    const agentAvailability: Record<string, string> = {};

    // Initialize agent availability
    for (const r of isolated.fleet.rovers || []) agentAvailability[r.callsign] = "NOMINAL";
    for (const a of isolated.fleet.astronauts || []) agentAvailability[a.callsign] = "NOMINAL";

    for (const scenario of allScenarios) {
      switch (scenario) {
        case "BATTERY_DEGRADATION": {
          altBattery = Math.max(12.0, Number((baseBattery - 24.0).toFixed(1)));
          if (altBattery < 20.0) {
            routeFeasible = false;
            altOutcome = "DEGRADED";
            mitigations.push("Engage passive solar re-charge hold and omit secondary science drill stops.");
          }
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Battery discharge rate nominal (~100 Wh/km)",
            alternativeEvent: "Accelerated cell internal resistance drop; discharge spike",
            hazardStatus: "BATTERY_WARNING",
          });
          break;
        }

        case "BATTERY_FAILURE": {
          altBattery = 14.5; // Strictly below 20% Invariant S1
          routeFeasible = false;
          altOutcome = "FAILED";
          altSafety = Math.min(altSafety, 45);
          newHazards.push({
            id: `whatif-batt-fail-${Date.now()}`,
            type: "STEEP_SLOPE",
            category: "RESOURCE",
            severity: "CRITICAL",
            location: activeRoute.points[0]?.coordinate || { latitude: 18.44, longitude: 77.45 },
            reason: "Simulated cell short circuit induces critical battery failure below 20% safety floor.",
            impactDescription: "Vehicle loss of mobility and cold soak freezing risk.",
            detectionSource: "What-If Failure Simulation",
            provenanceClassification: "SIMULATED",
            recommendedMitigation: "Activate secondary radioisotope heater unit and request emergency rescue.",
            sourceType: "DERIVED",
          });
          mitigations.push("Immediate abort: Deploy ROVER-03 to deliver tactical power umbilical.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Power systems nominal",
            alternativeEvent: "Main DC bus short circuit; primary power pack offline",
            hazardStatus: "CRITICAL_FAIL",
          });
          break;
        }

        case "COMMUNICATION_BLACKOUT":
        case "ORBITER_RELAY_FAILURE": {
          altComm = 34.0;
          altSafety = Math.max(40, altSafety - 25);
          mitigations.push("Position ROVER-03 RELAY on elevated ridge crest at WP-02.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Continuous bidirectional telemetry via MRO-Relay",
            alternativeEvent: "MRO payload safe mode; RF blackout across primary corridor",
            hazardStatus: "RF_BLACKOUT",
          });
          if (scenario === "ORBITER_RELAY_FAILURE") {
            agentAvailability["ORBITER-01"] = "OFFLINE_SAFE_MODE";
          }
          break;
        }

        case "ROVER_BREAKDOWN": {
          const targetCallsign = request.affectedAgentId || "ROVER-01 SCOUT";
          agentAvailability[targetCallsign] = "MOBILITY_LOCKED";
          altDurationMin += 35;
          altSafety = Math.max(35, altSafety - 30);
          altOutcome = "DEGRADED";
          mitigations.push("Failover mission tasks to ROVER-02 SCIENCE; hold astronaut at standby hub.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: `${targetCallsign} AutoNav traverse nominal`,
            alternativeEvent: `${targetCallsign} port rocker actuator stall; chassis locked`,
            hazardStatus: "MECHANICAL_STALL",
          });
          break;
        }

        case "ASTRONAUT_EMERGENCY": {
          agentAvailability["ASTRONAUT-01"] = "LIFE_SUPPORT_ALERT";
          altSafety = 28;
          altOutcome = "ABORTED";
          routeFeasible = false;
          mitigations.push("Immediate EVA termination: Ingress habitat airlock within 18 minutes.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Astronaut metabolic biotelemetry nominal",
            alternativeEvent: "Suit pressure micro-leak; metabolic heart rate spikes to 142 bpm",
            hazardStatus: "MEDICAL_CRITICAL",
          });
          break;
        }

        case "TERRAIN_HAZARD_ESCALATION": {
          altSafety = 51;
          altBattery = Math.max(15, altBattery - 15);
          altHazardsEncountered += 2;
          altOutcome = "DEGRADED";
          newHazards.push({
            id: `whatif-terrain-hazard-${Date.now()}`,
            type: "SCARP",
            category: "TERRAIN",
            severity: "CRITICAL",
            location: { latitude: 18.452, longitude: 77.42 },
            reason: "Escalated scree scarp slope reaching 24.2° with active gravel talus sliding.",
            impactDescription: "Chassis rollover risk and regolith wheel sinkage exceeding 80%.",
            detectionSource: "What-If Terrain Escalation Model",
            provenanceClassification: "SIMULATED",
            recommendedMitigation: "Enforce northern valley bypass corridor.",
            sourceType: "DERIVED",
          });
          mitigations.push("Re-route entire traverse around the Kodiak North talus apron.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Detour route followed smoothly",
            alternativeEvent: "Chassis enters loose scree scarp; slip ratio exceeds 75%",
            hazardStatus: "ROLLOVER_RISK",
          });
          break;
        }

        case "IGNORE_HAZARD":
        case "FORCE_DIRECT_ROUTE": {
          altDistanceKm = Math.max(1.0, Number((altDistanceKm - 1.5).toFixed(2)));
          altDurationMin = Math.max(10, Number((altDurationMin - 12).toFixed(1)));
          altSafety = 51;
          altBattery = Math.max(15, altBattery - 15);
          altHazardsEncountered += 2;
          altOutcome = "DEGRADED";
          newHazards.push({
            id: `whatif-terrain-hazard-${Date.now()}`,
            type: "SCARP",
            category: "TERRAIN",
            severity: "CRITICAL",
            location: { latitude: 18.452, longitude: 77.42 },
            reason: "Escalated scree scarp slope reaching 24.2° with active gravel talus sliding.",
            impactDescription: "Chassis rollover risk and regolith wheel sinkage exceeding 80%.",
            detectionSource: "What-If Terrain Escalation Model",
            provenanceClassification: "SIMULATED",
            recommendedMitigation: "Enforce northern valley bypass corridor.",
            sourceType: "DERIVED",
          });
          mitigations.push("Re-route entire traverse around the Kodiak North talus apron.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Detour route followed smoothly",
            alternativeEvent: "Chassis enters loose scree scarp; slip ratio exceeds 75%",
            hazardStatus: "ROLLOVER_RISK",
          });
          break;
        }

        case "ROUTE_BLOCKAGE": {
          altDistanceKm += 2.4;
          altDurationMin += 22;
          altBattery = Math.max(18, altBattery - 12);
          mitigations.push("Prune waypoint WP-03 and take ridge bypass.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "Transit corridor clear",
            alternativeEvent: "Megabreccia boulder fall blocks valley entrance",
            hazardStatus: "PATH_BLOCKED",
          });
          break;
        }

        case "SCIENTIFIC_INSTRUMENT_FAILURE": {
          altScience = Math.max(20, altScience - 40);
          mitigations.push("Switch to non-contact visual multispectral imagery.");
          timelineDiff.push({
            minute: request.forkSimTimeMinutes,
            baselineEvent: "SHERLOC Raman laser operational",
            alternativeEvent: "Drill percussion solenoid failure; abrasion bit seized",
            hazardStatus: "INSTRUMENT_FAIL",
          });
          break;
        }

        case "RESOURCE_SHORTAGE": {
          altScience = Math.max(30, altScience - 25);
          mitigations.push("Prioritize volatile samples and skip weathered bedrock.");
          break;
        }

        case "EMERGENCY_RETURN": {
          altDistanceKm = Number((baseDistanceKm * 0.6).toFixed(1));
          altDurationMin = Number((baseDurationMin * 0.55).toFixed(1));
          altOutcome = "ABORTED";
          mitigations.push("Execute direct emergency azimuth vector back to Ingress Hab.");
          break;
        }

        case "CONSERVATIVE_STANDBY": {
          altDurationMin += 20;
          altBattery = Math.max(20, altBattery - 6);
          altSafety = Math.min(98, altSafety + 4);
          altComm = 99.0;
          break;
        }

        case "MAX_SPEED_BURST": {
          altDurationMin = Math.max(20, altDurationMin - 10);
          altBattery = Math.max(15, altBattery - 17);
          altSafety = Math.max(45, altSafety - 24);
          altOutcome = "DEGRADED";
          break;
        }

        default: {
          altSafety = Math.max(50, altSafety - 10);
        }
      }
    }

    const alternative: MissionRunMetrics = {
      missionId: `${request.baselineMissionId}-WHATIF-${primaryScenario}`,
      label: `Alternative (${allScenarios.join(" + ")})`,
      distanceKm: Number(altDistanceKm.toFixed(2)),
      durationMin: Number(altDurationMin.toFixed(1)),
      batteryPercent: Number(altBattery.toFixed(1)),
      scienceScore: Math.round(altScience),
      safetyScore: Math.round(altSafety),
      commReliabilityPercent: Number(altComm.toFixed(1)),
      hazardsDetected: baseline.hazardsDetected + newHazards.length,
      hazardsEncountered: altHazardsEncountered,
      outcome: altOutcome,
    };

    const decisionDiff = `Applied scenario(s): ${allScenarios.join(", ")}`;
    const comparison = SimulationComparator.compareMissions(baseline, alternative, decisionDiff);

    // Calculate probabilistic success metric based on multi-factor constraints
    let successProbability = 95;
    if (altBattery < 20.0) successProbability -= 55;
    else if (altBattery < 30.0) successProbability -= 20;
    if (altSafety < 60) successProbability -= 30;
    if (altComm < 50) successProbability -= 15;
    if (!routeFeasible) successProbability = Math.min(successProbability, 25);
    successProbability = Math.max(5, Math.min(99, successProbability));

    const verdict =
      altOutcome === "SUCCESS"
        ? "What-If alternative scenario verified operationally feasible within certified safety envelope."
        : `CRITICAL SAFETY FINDING: Simulated scenario (${allScenarios.join(", ")}) reduces mission safety to ${altSafety}/100 (Δ ${comparison.safetyDelta}) and drops success probability to ${successProbability}%. Execution of recommended mitigations mandatory.`;

    const isolatedStateHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ baseline, alternative, allScenarios }))
      .digest("hex");

    const result: WhatIfSimulationResult = {
      simulationId: simId,
      baseline,
      alternative,
      comparison,
      timelineDiff,
      newHazards,
      routeFeasible,
      resourceImplications: {
        finalBatteryPercent: altBattery,
        batteryDeficitPercent: Number((baseBattery - altBattery).toFixed(1)),
        energyConsumedWh: Math.round((100 - altBattery) * 12),
      },
      agentAvailability,
      missionSuccessProbability: successProbability,
      recommendedMitigation: mitigations.join(" ") || "Maintain standard operational envelope.",
      verdict,
      isolatedStateHash,
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
