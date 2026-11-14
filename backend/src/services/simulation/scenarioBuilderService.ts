import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { SimulationScenarioManager } from "./simulationScenarioManager.js";
import { WhatIfScenarioType, WhatIfSimulationResult } from "./whatIfSimulationEngine.js";
import { MonteCarloEngine, MonteCarloResult } from "./monteCarloEngine.js";
import { CommunicationRouteEvaluator } from "../comms/communicationRouteEvaluator.js";
import { SafetyInvariantService, InvariantCheckResult } from "../safety/safetyInvariantService.js";
import { ProvenanceService } from "../planetary/provenanceService.js";

export interface ScenarioConfiguration {
  id: string;
  name: string;
  description: string;
  baselineMissionId: string;
  routeId: string;
  durationMinutes: number;
  agents: {
    rover01Available: boolean;
    rover02Available: boolean;
    astronaut01Available: boolean;
    requiredCapabilities: string[];
  };
  resources: {
    initialBatteryPercent: number;
    batteryDegradationMultiplier: number;
    oxygenReserveMinutes: number;
    sampleStorageKg: number;
  };
  comms: {
    surfaceRelayAvailable: boolean;
    orbiterRelayAvailable: boolean;
    blackoutWindowMinutes: number;
  };
  terrain: {
    maxAllowedSlopeDeg: number;
    hazardEscalationFactor: number;
    restrictedZones: string[];
  };
  science: {
    objectivePriority: string;
    targetIds: string[];
    instrumentFailure: boolean;
  };
  conditions: WhatIfScenarioType[];
  createdAt: string;
  updatedAt: string;
  lastExecution?: ScenarioExecutionOutcome;
}

export interface ScenarioExecutionOutcome {
  executionId: string;
  scenarioId: string;
  executedAt: string;
  mode: "SIMULATED";
  isolatedFromLiveState: true;
  feasible: boolean;
  projectedBatteryPercent: number;
  projectedOxygenMinutes: number;
  commsCoveragePercent: number;
  monteCarloSuccessProbability: number;
  estimatedScienceYield: number;
  safetyChecks: InvariantCheckResult[];
  whatIfSummary: {
    simulationId: string;
    routeFeasible: boolean;
    batteryDeficitPercent: number;
    energyConsumedWh: number;
    newHazardsCount: number;
  };
  monteCarloSummary: {
    analysisId: string;
    runCount: number;
    successDefinition: string;
    durationP50Minutes: number;
    batteryP50Percent: number;
  };
  assumptions: string[];
  provenance: import("../../types/index.js").DataProvenance;
}

export class ScenarioValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = "INVALID_SCENARIO_CONFIGURATION";
  constructor(message: string) {
    super(message);
    this.name = "ScenarioValidationError";
  }
}

export class ScenarioBuilderService {
  private static get scenariosFilePath(): string {
    return path.join(CANONICAL_BACKEND_DATA_DIR, "scenarios.json");
  }

  private static ensureInitialized(): ScenarioConfiguration[] {
    if (!fs.existsSync(CANONICAL_BACKEND_DATA_DIR)) {
      fs.mkdirSync(CANONICAL_BACKEND_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.scenariosFilePath)) {
      const defaults = this.buildDefaultScenarios();
      fs.writeFileSync(this.scenariosFilePath, JSON.stringify(defaults, null, 2), "utf-8");
      return defaults;
    }
    try {
      const raw = fs.readFileSync(this.scenariosFilePath, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : this.buildDefaultScenarios();
    } catch {
      const defaults = this.buildDefaultScenarios();
      fs.writeFileSync(this.scenariosFilePath, JSON.stringify(defaults, null, 2), "utf-8");
      return defaults;
    }
  }

  private static saveAll(scenarios: ScenarioConfiguration[]): void {
    if (!fs.existsSync(CANONICAL_BACKEND_DATA_DIR)) {
      fs.mkdirSync(CANONICAL_BACKEND_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(this.scenariosFilePath, JSON.stringify(scenarios, null, 2), "utf-8");
  }

  private static buildDefaultScenarios(): ScenarioConfiguration[] {
    const now = new Date().toISOString();
    return [
      {
        id: "scen-jezero-nominal",
        name: "Nominal Jezero Delta Traverse",
        description: "Baseline multi-agent reconnaissance and core sampling across Jezero western delta.",
        baselineMissionId: "mission-jezero-sol100",
        routeId: "route-jezero-delta-sol100",
        durationMinutes: 240,
        agents: {
          rover01Available: true,
          rover02Available: true,
          astronaut01Available: true,
          requiredCapabilities: ["HAZARD_LIDAR", "ROTARY_DRILL", "EVA_SAMPLING"],
        },
        resources: {
          initialBatteryPercent: 94,
          batteryDegradationMultiplier: 1.0,
          oxygenReserveMinutes: 280,
          sampleStorageKg: 15,
        },
        comms: {
          surfaceRelayAvailable: true,
          orbiterRelayAvailable: true,
          blackoutWindowMinutes: 12,
        },
        terrain: {
          maxAllowedSlopeDeg: 20,
          hazardEscalationFactor: 1.0,
          restrictedZones: ["Kodiak Steep Scarp (>20°)"],
        },
        science: {
          objectivePriority: "ANCIENT_WATER_ACTIVITY",
          targetIds: ["target-jezero-01", "target-jezero-02"],
          instrumentFailure: false,
        },
        conditions: [],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "scen-dust-battery-degradation",
        name: "Dust Storm Power & Comms Degradation",
        description: "Simulates elevated battery discharge (+35%) and surface VHF blackout forcing orbiter relay store-and-forward.",
        baselineMissionId: "mission-jezero-sol100",
        routeId: "route-jezero-delta-sol100",
        durationMinutes: 210,
        agents: {
          rover01Available: true,
          rover02Available: true,
          astronaut01Available: true,
          requiredCapabilities: ["HAZARD_LIDAR", "UHF_RELAY"],
        },
        resources: {
          initialBatteryPercent: 78,
          batteryDegradationMultiplier: 1.35,
          oxygenReserveMinutes: 240,
          sampleStorageKg: 12,
        },
        comms: {
          surfaceRelayAvailable: false,
          orbiterRelayAvailable: true,
          blackoutWindowMinutes: 48,
        },
        terrain: {
          maxAllowedSlopeDeg: 18,
          hazardEscalationFactor: 1.25,
          restrictedZones: ["Kodiak Steep Scarp (>20°)", "Southern Talus Fan"],
        },
        science: {
          objectivePriority: "BIOSIGNATURE_PRESERVATION",
          targetIds: ["target-jezero-01"],
          instrumentFailure: false,
        },
        conditions: ["BATTERY_DEGRADATION", "COMMUNICATION_BLACKOUT"],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "scen-scarp-emergency-return",
        name: "Scarp Escalation & Emergency EVA Return",
        description: "Tests hard safety invariant S1/S2 enforcement under steep terrain escalation and rover breakdown.",
        baselineMissionId: "mission-jezero-sol100",
        routeId: "route-jezero-delta-sol100",
        durationMinutes: 150,
        agents: {
          rover01Available: false,
          rover02Available: true,
          astronaut01Available: true,
          requiredCapabilities: ["EMERGENCY_EXTRACTION"],
        },
        resources: {
          initialBatteryPercent: 52,
          batteryDegradationMultiplier: 1.6,
          oxygenReserveMinutes: 145,
          sampleStorageKg: 8,
        },
        comms: {
          surfaceRelayAvailable: true,
          orbiterRelayAvailable: false,
          blackoutWindowMinutes: 35,
        },
        terrain: {
          maxAllowedSlopeDeg: 16,
          hazardEscalationFactor: 1.8,
          restrictedZones: ["Kodiak Steep Scarp (>20°)", "Belva Crater Rim"],
        },
        science: {
          objectivePriority: "SUBSURFACE_ICE_DETECTION",
          targetIds: ["target-jezero-03"],
          instrumentFailure: true,
        },
        conditions: ["ROVER_BREAKDOWN", "TERRAIN_HAZARD_ESCALATION", "EMERGENCY_RETURN"],
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  public static validateScenarioInput(input: Partial<ScenarioConfiguration>): void {
    if (input.name !== undefined && (!input.name || input.name.trim().length < 2)) {
      throw new ScenarioValidationError("Scenario name must be at least 2 characters.");
    }
    if (input.durationMinutes !== undefined && (input.durationMinutes <= 0 || input.durationMinutes > 1440)) {
      throw new ScenarioValidationError("durationMinutes must be between 1 and 1440.");
    }
    if (input.resources) {
      const r = input.resources;
      if (r.initialBatteryPercent < 0 || r.initialBatteryPercent > 100) {
        throw new ScenarioValidationError("initialBatteryPercent must be between 0 and 100.");
      }
      if (r.batteryDegradationMultiplier <= 0 || r.batteryDegradationMultiplier > 5) {
        throw new ScenarioValidationError("batteryDegradationMultiplier must be > 0 and <= 5.");
      }
      if (r.oxygenReserveMinutes <= 0 || r.oxygenReserveMinutes > 1000) {
        throw new ScenarioValidationError("oxygenReserveMinutes must be > 0 and <= 1000.");
      }
      if (r.sampleStorageKg <= 0 || r.sampleStorageKg > 200) {
        throw new ScenarioValidationError("sampleStorageKg must be > 0 and <= 200.");
      }
    }
    if (input.terrain) {
      if (input.terrain.maxAllowedSlopeDeg <= 0 || input.terrain.maxAllowedSlopeDeg > 45) {
        throw new ScenarioValidationError("maxAllowedSlopeDeg must be > 0 and <= 45.");
      }
      if (input.terrain.hazardEscalationFactor < 0 || input.terrain.hazardEscalationFactor > 5) {
        throw new ScenarioValidationError("hazardEscalationFactor must be between 0 and 5.");
      }
    }
    if (input.comms) {
      if (input.comms.blackoutWindowMinutes < 0) {
        throw new ScenarioValidationError("blackoutWindowMinutes cannot be negative.");
      }
      if (input.durationMinutes !== undefined && input.comms.blackoutWindowMinutes > input.durationMinutes) {
        throw new ScenarioValidationError("blackoutWindowMinutes cannot exceed durationMinutes.");
      }
    }
    if (input.agents) {
      const { rover01Available, rover02Available, astronaut01Available } = input.agents;
      if (!rover01Available && !rover02Available && !astronaut01Available) {
        throw new ScenarioValidationError("At least one mission agent (rover or astronaut) must be available.");
      }
    }
  }

  public static listScenarios(): ScenarioConfiguration[] {
    return this.ensureInitialized();
  }

  public static getScenario(id: string): ScenarioConfiguration | undefined {
    return this.ensureInitialized().find((s) => s.id === id);
  }

  public static createScenario(
    payload: Omit<ScenarioConfiguration, "id" | "createdAt" | "updatedAt" | "lastExecution">
  ): ScenarioConfiguration {
    this.validateScenarioInput(payload);
    const all = this.ensureInitialized();
    const now = new Date().toISOString();
    const created: ScenarioConfiguration = {
      ...payload,
      id: `scen-${crypto.randomBytes(4).toString("hex")}`,
      createdAt: now,
      updatedAt: now,
    };
    all.push(created);
    this.saveAll(all);
    return created;
  }

  public static updateScenario(
    id: string,
    patch: Partial<Omit<ScenarioConfiguration, "id" | "createdAt">>
  ): ScenarioConfiguration | null {
    const all = this.ensureInitialized();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const merged: ScenarioConfiguration = {
      ...all[idx],
      ...patch,
      agents: patch.agents ? { ...all[idx].agents, ...patch.agents } : all[idx].agents,
      resources: patch.resources ? { ...all[idx].resources, ...patch.resources } : all[idx].resources,
      comms: patch.comms ? { ...all[idx].comms, ...patch.comms } : all[idx].comms,
      terrain: patch.terrain ? { ...all[idx].terrain, ...patch.terrain } : all[idx].terrain,
      science: patch.science ? { ...all[idx].science, ...patch.science } : all[idx].science,
      id: all[idx].id,
      createdAt: all[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.validateScenarioInput(merged);
    all[idx] = merged;
    this.saveAll(all);
    return merged;
  }

  public static duplicateScenario(id: string, newName?: string): ScenarioConfiguration | null {
    const source = this.getScenario(id);
    if (!source) return null;
    const all = this.ensureInitialized();
    const now = new Date().toISOString();
    const copy: ScenarioConfiguration = {
      ...JSON.parse(JSON.stringify(source)),
      id: `scen-${crypto.randomBytes(4).toString("hex")}`,
      name: newName?.trim() || `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      lastExecution: undefined,
    };
    all.push(copy);
    this.saveAll(all);
    return copy;
  }

  public static deleteScenario(id: string): boolean {
    const all = this.ensureInitialized();
    const filtered = all.filter((s) => s.id !== id);
    if (filtered.length === all.length) return false;
    this.saveAll(filtered);
    return true;
  }

  /**
   * Executes a scenario against an isolated state snapshot without mutating live missions.
   */
  public static executeScenario(id: string): ScenarioExecutionOutcome | null {
    const all = this.ensureInitialized();
    const idx = all.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const scenario = all[idx];

    // 1. Isolated state snapshot (never mutates live missionRepository or MissionStateCoordinator)
    const _snapshot = SimulationScenarioManager.cloneMissionState(scenario.baselineMissionId);

    // 2. Run What-If Engine
    const conditionsToRun: WhatIfScenarioType[] = [...scenario.conditions];
    if (!scenario.comms.surfaceRelayAvailable && !conditionsToRun.includes("COMMUNICATION_BLACKOUT")) {
      conditionsToRun.push("COMMUNICATION_BLACKOUT");
    }
    if (!scenario.comms.orbiterRelayAvailable && !conditionsToRun.includes("ORBITER_RELAY_FAILURE")) {
      conditionsToRun.push("ORBITER_RELAY_FAILURE");
    }
    if (scenario.resources.batteryDegradationMultiplier > 1.2 && !conditionsToRun.includes("BATTERY_DEGRADATION")) {
      conditionsToRun.push("BATTERY_DEGRADATION");
    }
    if (scenario.science.instrumentFailure && !conditionsToRun.includes("SCIENTIFIC_INSTRUMENT_FAILURE")) {
      conditionsToRun.push("SCIENTIFIC_INSTRUMENT_FAILURE");
    }

    const whatIf: WhatIfSimulationResult = SimulationScenarioManager.evaluateWhatIf({
      baselineMissionId: scenario.baselineMissionId,
      forkSimTimeMinutes: Math.min(45, Math.floor(scenario.durationMinutes * 0.25)),
      scenarios: conditionsToRun,
      rationale: `Scenario Builder isolated execution: ${scenario.name}`,
    });

    // 3. Run Monte Carlo uncertainty sweep with scenario parameters
    const mcResult: MonteCarloResult = MonteCarloEngine.runAnalysis({
      missionId: scenario.baselineMissionId,
      runCount: 40,
      seed: scenario.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 1337),
      initialBatteryOverridePercent: scenario.resources.initialBatteryPercent,
      maxDurationLimitMinutes: scenario.durationMinutes,
      injectedBatteryDropPercent: scenario.resources.batteryDegradationMultiplier > 1.2 ? 18 : 0,
      commOutageRate: !scenario.comms.surfaceRelayAvailable ? 0.35 : 0.08,
    });

    // 4. Evaluate communication coverage on route
    const routes = missionRepository.getAllRoutesSync();
    const route = routes.find((r) => r.id === scenario.routeId) || routes[0];
    const commAssessment = route
      ? CommunicationRouteEvaluator.evaluateRouteCommunication(route)
      : { combinedCoveragePercent: 80 };

    const commPenalty =
      (!scenario.comms.surfaceRelayAvailable ? 22 : 0) +
      (!scenario.comms.orbiterRelayAvailable ? 25 : 0) +
      Math.min(25, Math.round((scenario.comms.blackoutWindowMinutes / Math.max(1, scenario.durationMinutes)) * 45));
    const commsCoveragePercent = Math.max(5, Math.min(100, Math.round(commAssessment.combinedCoveragePercent - commPenalty)));

    // 5. Project battery & oxygen under scenario parameters
    const baseDrain = (100 - whatIf.resourceImplications.finalBatteryPercent) * scenario.resources.batteryDegradationMultiplier;
    const projectedBatteryPercent = Math.max(0, Math.min(100, Math.round((scenario.resources.initialBatteryPercent - baseDrain) * 10) / 10));
    const projectedOxygenMinutes = Math.max(
      0,
      Math.round(scenario.resources.oxygenReserveMinutes - scenario.durationMinutes * 0.42)
    );

    // 6. Safety Invariant checks
    const s1Check = SafetyInvariantService.verifyS1_BatteryReserve(
      { id: "rover-01", name: "ROVER-01", role: "SCOUT" } as any,
      projectedBatteryPercent
    );
    const routeSlope = route?.maxSlopeDegrees ?? 14;
    const effectiveSlope = routeSlope * scenario.terrain.hazardEscalationFactor;
    const s2Check: InvariantCheckResult = {
      passed: effectiveSlope <= scenario.terrain.maxAllowedSlopeDeg && whatIf.routeFeasible,
      invariantId: "S2",
      description: `Never execute a route exceeding terrain slope limit (${scenario.terrain.maxAllowedSlopeDeg}°)`,
      violationReason:
        effectiveSlope > scenario.terrain.maxAllowedSlopeDeg
          ? `Projected effective slope ${effectiveSlope.toFixed(1)}° exceeds configured limit ${scenario.terrain.maxAllowedSlopeDeg}°`
          : !whatIf.routeFeasible
          ? "What-If hazard/blockage evaluation flagged route as unfeasible"
          : undefined,
    };
    const s3Check: InvariantCheckResult = {
      passed: projectedOxygenMinutes >= 30,
      invariantId: "S3",
      description: "Maintain >= 30 min emergency O2 return reserve",
      violationReason:
        projectedOxygenMinutes < 30
          ? `Projected O2 reserve ${projectedOxygenMinutes} min is below 30 min emergency return floor`
          : undefined,
    };

    const safetyChecks = [s1Check, s2Check, s3Check];
    const feasible = safetyChecks.every((c) => c.passed) && mcResult.successProbabilityPercent >= 45;

    // 7. Science yield estimate (explicitly labeled SIMULATED)
    const activeTargets = Math.max(1, scenario.science.targetIds.length);
    const instrumentPenalty = scenario.science.instrumentFailure ? 0.55 : 1.0;
    const agentBonus =
      (scenario.agents.rover01Available ? 15 : 0) +
      (scenario.agents.rover02Available ? 20 : 0) +
      (scenario.agents.astronaut01Available ? 20 : 0);
    const estimatedScienceYield = Math.min(
      100,
      Math.round((30 + activeTargets * 14 + agentBonus) * instrumentPenalty)
    );

    const outcome: ScenarioExecutionOutcome = {
      executionId: `exec-${crypto.randomBytes(4).toString("hex")}`,
      scenarioId: scenario.id,
      executedAt: new Date().toISOString(),
      mode: "SIMULATED",
      isolatedFromLiveState: true,
      feasible,
      projectedBatteryPercent,
      projectedOxygenMinutes,
      commsCoveragePercent,
      monteCarloSuccessProbability: mcResult.successProbabilityPercent,
      estimatedScienceYield,
      safetyChecks,
      whatIfSummary: {
        simulationId: whatIf.simulationId,
        routeFeasible: whatIf.routeFeasible,
        batteryDeficitPercent: whatIf.resourceImplications.batteryDeficitPercent,
        energyConsumedWh: whatIf.resourceImplications.energyConsumedWh,
        newHazardsCount: whatIf.newHazards.length,
      },
      monteCarloSummary: {
        analysisId: mcResult.analysisId,
        runCount: mcResult.runCount,
        successDefinition: mcResult.successDefinition.missionCompletion,
        durationP50Minutes: mcResult.durationDistributionMinutes.p50,
        batteryP50Percent: mcResult.batteryReserveDistribution.p50,
      },
      assumptions: [
        "SIMULATED OUTCOME: Executed against isolated state clone; live mission state was NOT modified.",
        `Battery degradation multiplier ${scenario.resources.batteryDegradationMultiplier}x applied to modeled traverse power draw.`,
        `Terrain hazard escalation factor ${scenario.terrain.hazardEscalationFactor}x applied to baseline route max slope (${routeSlope.toFixed(1)}°).`,
        `Comms coverage reflects surface relay=${scenario.comms.surfaceRelayAvailable}, orbiter relay=${scenario.comms.orbiterRelayAvailable}, blackout=${scenario.comms.blackoutWindowMinutes} min.`,
        ...(mcResult.assumptions || []),
      ],
      provenance: ProvenanceService.createDerivedProvenance(
        `Scenario Builder Isolated Execution (${scenario.name})`,
        ["Isolated Mission State Clone", "MonteCarloEngine", "WhatIfSimulationEngine", "SafetyInvariantService"],
        "SIMULATED Scenario Stress-Test"
      ),
    };

    all[idx] = {
      ...scenario,
      updatedAt: new Date().toISOString(),
      lastExecution: outcome,
    };
    this.saveAll(all);

    return outcome;
  }
}
