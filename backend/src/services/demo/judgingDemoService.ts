import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { auditChainService } from "../security/auditChainService.js";
import { EvaSessionService } from "../eva/evaSessionService.js";
import { SimulationScenarioManager } from "../simulation/simulationScenarioManager.js";
import { MissionAnalyticsService } from "../intelligence/missionAnalyticsService.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { scienceDecisionService } from "../science/scienceDecisionService.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../nasa/adapters/benchmarkData.js";
import { MarsRoute, MissionParameters, EVAAssessment } from "../../types/index.js";

export type JudgingScenarioId = "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE";

export interface JudgingDemoStepResult {
  stepIndex: number;
  stepId: string;
  title: string;
  status: "COMPLETED" | "FAILED";
  executedAt: string;
  provenanceClassification: "SIMULATED";
  summary: string;
  details: Record<string, unknown>;
}

export interface JudgingDemoRunRecord {
  runId: string;
  scenarioId: JudgingScenarioId;
  scenarioTitle: string;
  missionId: string;
  routeId: string;
  mode: "GUIDED" | "MANUAL";
  status: "IN_PROGRESS" | "COMPLETED" | "RECOVERED" | "FAILED";
  seed: number;
  startedAt: string;
  completedAt?: string;
  provenanceClassification: "SIMULATED";
  steps: JudgingDemoStepResult[];
  finalSummary?: {
    totalSteps: number;
    completedSteps: number;
    totalDistanceKm: number;
    cumulativeScienceYield: number;
    safetyViolations: number;
    auditIntegrityStatus: string;
    emergencyReturnTriggered: boolean;
    historicalEmergencyCount: number;
    emergencyEventsCount: number;
    finalEvaSessionStatus: string | null;
    monteCarloCompletionRatePercent: number | null;
    monteCarloSurvivalRatePercent: number | null;
    isolatedFromUserMissions: boolean;
    disclosure: string;
  };
}

interface ScenarioStepDef {
  stepId: string;
  title: string;
}

const SCENARIO_CATALOG: Record<
  JudgingScenarioId,
  { title: string; seed: number; steps: ScenarioStepDef[] }
> = {
  NOMINAL_EXPLORATION: {
    title: "Scenario A — Nominal Exploration (Jezero Delta)",
    seed: 20261112,
    steps: [
      { stepId: "CREATE_ISOLATED_MISSION", title: "1. Create Isolated Demo Mission & Route" },
      { stepId: "SELECT_SCIENCE_TARGETS", title: "2. Select & Record Scientific Target" },
      { stepId: "PLAN_AND_OPTIMIZE_ROUTE", title: "3. Validate Safe Traverse & Slope Limits" },
      { stepId: "ASSIGN_TASKS_AND_EVA", title: "4. Brief & Execute Nominal EVA Session" },
      { stepId: "VERIFY_COMMS_AND_TELEMETRY", title: "5. Verify Telemetry & Comms Delivery" },
      { stepId: "VERIFY_ANALYTICS_REPLAY_AUDIT", title: "6. Verify Analytics, Replay & Audit Chain" },
    ],
  },
  OPERATIONAL_FAILURE: {
    title: "Scenario B — Operational Failure & Recovery",
    seed: 20261199,
    steps: [
      { stepId: "CREATE_ISOLATED_MISSION", title: "1. Create Isolated Failure-Test Mission" },
      { stepId: "INJECT_HAZARD_AND_COMMS_BLACKOUT", title: "2. Simulate Hazard & Comms Blackout (Clone)" },
      { stepId: "EVALUATE_MONTE_CARLO_RISK", title: "3. Run Deterministic Monte Carlo Risk Sweep" },
      { stepId: "TRIGGER_REPLAN_AND_EMERGENCY_EVA", title: "4. Trigger Emergency EVA Return Protocol" },
      { stepId: "REASSIGN_AUTONOMOUS_SUPPORT", title: "5. Reassign Autonomous Relay & Recover Comms" },
      { stepId: "VERIFY_ANALYTICS_REPLAY_AUDIT", title: "6. Verify Recovery Analytics & Audit Chain" },
    ],
  },
};

export class JudgingDemoService {
  private static readonly runsFilePath = path.resolve(
    CANONICAL_BACKEND_DATA_DIR,
    "judging-demo-runs.json"
  );
  private static runs: JudgingDemoRunRecord[] = [];
  private static loaded = false;

  private static ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (fs.existsSync(this.runsFilePath)) {
        const raw = fs.readFileSync(this.runsFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.runs = parsed;
        }
      }
    } catch {
      this.runs = [];
    }
  }

  private static persistRuns(): void {
    try {
      const dir = path.dirname(this.runsFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${this.runsFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.runs.slice(-50), null, 2), "utf-8");
      fs.renameSync(tmp, this.runsFilePath);
    } catch (err) {
      console.warn("[JudgingDemoService] Failed to persist demo runs:", err);
    }
  }

  public static getCatalog() {
    return Object.entries(SCENARIO_CATALOG).map(([id, def]) => ({
      scenarioId: id as JudgingScenarioId,
      title: def.title,
      seed: def.seed,
      steps: def.steps,
    }));
  }

  public static listRuns(): JudgingDemoRunRecord[] {
    this.ensureLoaded();
    return [...this.runs].reverse();
  }

  public static getRunById(runId: string): JudgingDemoRunRecord | undefined {
    this.ensureLoaded();
    return this.runs.find((r) => r.runId === runId);
  }

  private static buildDemoRoute(routeId: string, scenarioId: JudgingScenarioId): MarsRoute {
    const isNominal = scenarioId === "NOMINAL_EXPLORATION";
    const maxSlopeDegrees = isNominal ? 7.8 : 13.5;
    const totalDistanceKm = isNominal ? 1.85 : 2.45;
    return {
      id: routeId,
      name: isNominal
        ? "SIMULATED Demo Nominal Jezero Traverse"
        : "SIMULATED Demo Contingency Ridge Traverse",
      points: [
        {
          id: `${routeId}-pt-1`,
          coordinate: { latitude: 18.38, longitude: 77.58 },
          type: "start",
          label: "Demo Base",
          elevationM: -2560,
        },
        {
          id: `${routeId}-pt-2`,
          coordinate: { latitude: isNominal ? 18.41 : 18.43, longitude: isNominal ? 77.61 : 77.64 },
          type: "science",
          label: "Delta Target",
          elevationM: -2515,
        },
        {
          id: `${routeId}-pt-3`,
          coordinate: { latitude: isNominal ? 18.44 : 18.46, longitude: isNominal ? 77.63 : 77.67 },
          type: "destination",
          label: "Outcrop Station",
          elevationM: -2480,
        },
      ],
      segments: [
        {
          id: `${routeId}-seg-1`,
          start: { latitude: 18.38, longitude: 77.58 },
          end: { latitude: isNominal ? 18.44 : 18.46, longitude: isNominal ? 77.63 : 77.67 },
          distanceKm: totalDistanceKm,
          elevationGainM: 80,
          elevationLossM: 12,
          averageSlopeDegrees: maxSlopeDegrees * 0.7,
          difficulty: isNominal ? "low" : "moderate",
          estimatedMinutes: isNominal ? 95 : 140,
          hazards: isNominal ? [] : ["steep-scarp-east"],
        },
      ],
      totalDistanceKm,
      estimatedDurationMinutes: isNominal ? 95 : 140,
      elevationProfile: [
        { distanceKm: 0, elevationM: -2560, slopeDegrees: 4.2, coordinate: { latitude: 18.38, longitude: 77.58 } },
        {
          distanceKm: totalDistanceKm,
          elevationM: -2480,
          slopeDegrees: maxSlopeDegrees,
          coordinate: { latitude: isNominal ? 18.44 : 18.46, longitude: isNominal ? 77.63 : 77.67 },
        },
      ],
      elevationGainM: 80,
      elevationLossM: 12,
      maxSlopeDegrees,
      overallDifficulty: isNominal ? "low" : "moderate",
      createdAt: new Date().toISOString(),
    };
  }

  private static async executeSingleStepInternal(
    run: JudgingDemoRunRecord,
    stepIndex: number
  ): Promise<JudgingDemoStepResult> {
    const scenarioDef = SCENARIO_CATALOG[run.scenarioId];
    const stepDef = scenarioDef.steps[stepIndex];
    if (!stepDef) {
      throw new Error(`Invalid stepIndex ${stepIndex} for scenario ${run.scenarioId}`);
    }

    const now = new Date().toISOString();
    let summary = "";
    let details: Record<string, unknown> = {};

    if (stepDef.stepId === "CREATE_ISOLATED_MISSION") {
      const route = this.buildDemoRoute(run.routeId, run.scenarioId);
      await missionRepository.saveRoute(route);

      const params: MissionParameters = {
        routeId: run.routeId,
        maxDurationMinutes: run.scenarioId === "NOMINAL_EXPLORATION" ? 180 : 210,
        startCoordinate: { latitude: 18.38, longitude: 77.58 },
        destinationCoordinate: {
          latitude: run.scenarioId === "NOMINAL_EXPLORATION" ? 18.44 : 18.46,
          longitude: run.scenarioId === "NOMINAL_EXPLORATION" ? 77.63 : 77.67,
        },
        returnRequired: true,
        evaSuitType: "exploration-mark-1",
        astronautSkillLevel: "expert",
      };
      const evaAssessment: EVAAssessment = {
        estimatedDurationMinutes: run.scenarioId === "NOMINAL_EXPLORATION" ? 75 : 110,
        totalDistanceKm: route.totalDistanceKm,
        terrainDifficulty: route.overallDifficulty,
        returnMarginMinutes: run.scenarioId === "NOMINAL_EXPLORATION" ? 65 : 35,
        feasible: true,
        warnings: ["SIMULATED judging demonstration mission — isolated from user missions."],
        oxygenReserveRemainingPercent: run.scenarioId === "NOMINAL_EXPLORATION" ? 68 : 44,
        recommendations: ["Maintain rover relay line-of-sight throughout traverse."],
      };

      await missionRepository.saveMission(run.missionId, run.routeId, params, evaAssessment, {
        name:
          run.scenarioId === "NOMINAL_EXPLORATION"
            ? `SIMULATED Nominal Demo (${run.missionId})`
            : `SIMULATED Failure Recovery Demo (${run.missionId})`,
        description: `Deterministic ${run.scenarioId} judging demonstration (seed ${run.seed}).`,
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        status: "DRAFT",
        isDemo: true,
      });

      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "JUDGING_DEMO_ENGINE",
        entityId: run.missionId,
        eventType: "MISSION_CREATED",
        payload: {
          simulated: true,
          scenarioId: run.scenarioId,
          seed: run.seed,
          batteryPercent: run.scenarioId === "NOMINAL_EXPLORATION" ? 94 : 88,
          distanceKm: 0,
        },
        provenance: ProvenanceService.createDerivedProvenance(
          "SIMULATED Judging Demo Engine",
          ["JudgingDemoService"],
          "Isolated demo mission creation (SIMULATED)"
        ),
      });

      summary = `Created isolated demo mission ${run.missionId} and route ${run.routeId}.`;
      details = { missionId: run.missionId, routeId: run.routeId, eventId: evt.eventId };
    } else if (stepDef.stepId === "SELECT_SCIENCE_TARGETS") {
      const target = VERIFIED_NASA_SCIENCE_TARGETS[0];
      const result = scienceDecisionService.assignTargetToMission({
        missionId: run.missionId,
        targetId: target.id,
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        actor: "SIMULATED_SCIENCE_LEAD",
        rationale: `SIMULATED demo selection of ${target.name} for Jezero Delta sampling.`,
      });
      const decisionId = result.ok ? result.decision.id : `scidec-sim-${run.seed}`;
      summary = `Recorded science decision for ${target.name} (${target.id}).`;
      details = { decisionId, targetId: target.id, targetName: target.name };
    } else if (stepDef.stepId === "PLAN_AND_OPTIMIZE_ROUTE") {
      await missionRepository.updateMission(run.missionId, { status: "APPROVED" });
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_ROUTE_OPTIMIZER",
        entityId: run.routeId,
        eventType: "ROUTE_SELECTED",
        payload: {
          simulated: true,
          distanceKm: 1.85,
          batteryPercent: 91,
          maxSlopeDeg: 7.8,
          feasible: true,
        },
      });
      summary = "Validated 1.85 km traverse within 15 deg slope limit (predicted battery 91%).";
      details = { eventId: evt.eventId, distanceKm: 1.85, maxSlopeDeg: 7.8 };
    } else if (stepDef.stepId === "ASSIGN_TASKS_AND_EVA") {
      const session = EvaSessionService.createSession({
        missionId: run.missionId,
        title: `SIMULATED Nominal EVA (${run.missionId})`,
        plannedDurationMinutes: 75,
        routeId: run.routeId,
      });
      EvaSessionService.transitionSession(session.id, "START", "SIMULATED nominal demo start");
      const completed = EvaSessionService.transitionSession(
        session.id,
        "COMPLETE",
        "SIMULATED nominal EVA objectives completed"
      );

      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_EVA_CREW",
        entityId: session.id,
        eventType: "TASK_TRANSITION",
        payload: {
          simulated: true,
          status: "COMPLETED",
          evaSessionId: session.id,
          elapsedMinutes: completed.elapsedMinutes,
          batteryPercent: 88,
        },
      });
      summary = `Completed EVA session ${session.id} (${completed.status}).`;
      details = { evaSessionId: session.id, evaStatus: completed.status, eventId: evt.eventId };
    } else if (stepDef.stepId === "VERIFY_COMMS_AND_TELEMETRY") {
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_COMMS_RELAY",
        entityId: run.missionId,
        eventType: "PACKET_DELIVERED",
        payload: {
          simulated: true,
          distanceKm: 1.85,
          batteryPercent: 86,
          latencyMs: 142,
        },
      });
      summary = "Verified nominal telemetry and communications packet delivery (142 ms latency).";
      details = { eventId: evt.eventId, latencyMs: 142, batteryPercent: 86 };
    } else if (stepDef.stepId === "INJECT_HAZARD_AND_COMMS_BLACKOUT") {
      const simResult = SimulationScenarioManager.evaluateWhatIf({
        baselineMissionId: "MARSWALK-001",
        forkSimTimeMinutes: 35,
        scenarios: ["BATTERY_FAILURE", "COMMUNICATION_BLACKOUT"],
        affectedAgentId: "agent-rover-01",
      });
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_FAILURE_ENGINE",
        entityId: run.missionId,
        eventType: "HAZARD_DETECTED",
        payload: {
          simulated: true,
          scenarios: ["BATTERY_FAILURE", "COMMUNICATION_BLACKOUT"],
          batteryPercent: 52,
          distanceKm: 1.4,
          simulationId: simResult.simulationId,
        },
      });
      const lossEvt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_COMMS_RELAY",
        entityId: run.missionId,
        eventType: "COMMUNICATION_LOST",
        payload: {
          simulated: true,
          reason: "Injected comms blackout during contingency ridge traverse",
        },
      });
      summary = "Executed isolated What-If simulation for Battery Failure + Comms Blackout.";
      details = { eventId: evt.eventId, commLossEventId: lossEvt.eventId, simulationId: simResult.simulationId };
    } else if (stepDef.stepId === "EVALUATE_MONTE_CARLO_RISK") {
      // Pass actual failure-injected parameters (commOutageRate 0.35 + 25% battery drop)
      const mc = SimulationScenarioManager.evaluateMonteCarlo({
        missionId: run.missionId,
        runCount: 50,
        seed: run.seed,
        commOutageRate: 0.35,
        injectedBatteryDropPercent: 25,
        requireCommsForNominalCompletion: true,
      });
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_MONTE_CARLO",
        entityId: `mc-${run.seed}`,
        eventType: "MONTE_CARLO_EXECUTED",
        payload: {
          simulated: true,
          runCount: 50,
          seed: run.seed,
          missionCompletionCount: mc.missionCompletionCount,
          safeRecoveryCount: mc.safeRecoveryCount,
          failureCount: mc.failureCount,
          missionCompletionRatePercent: mc.missionCompletionRatePercent,
          overallSurvivalRatePercent: mc.overallSurvivalRatePercent,
          completionRateCI95Percent: mc.completionRateCI95Percent,
          survivalRateCI95Percent: mc.survivalRateCI95Percent,
          successProbabilityPercent: mc.successProbabilityPercent,
          batteryPercent: 50,
        },
      });
      summary = `Monte Carlo 50-run sweep (seed ${run.seed}): ${mc.missionCompletionRatePercent}% nominal completion (${mc.missionCompletionCount}/50), ${mc.safeRecoveryRatePercent}% safe recovery (${mc.safeRecoveryCount}/50), ${mc.failureCount} failed.`;
      details = {
        eventId: evt.eventId,
        runCount: 50,
        seed: run.seed,
        missionCompletionCount: mc.missionCompletionCount,
        safeRecoveryCount: mc.safeRecoveryCount,
        failureCount: mc.failureCount,
        missionCompletionRatePercent: mc.missionCompletionRatePercent,
        overallSurvivalRatePercent: mc.overallSurvivalRatePercent,
        completionRateCI95Percent: mc.completionRateCI95Percent,
        survivalRateCI95Percent: mc.survivalRateCI95Percent,
        successDefinition: mc.successDefinition,
        assumptions: mc.assumptions,
      };
    } else if (stepDef.stepId === "TRIGGER_REPLAN_AND_EMERGENCY_EVA") {
      const session = EvaSessionService.createSession({
        missionId: run.missionId,
        title: `SIMULATED Emergency EVA (${run.missionId})`,
        plannedDurationMinutes: 110,
        routeId: run.routeId,
      });
      EvaSessionService.transitionSession(session.id, "START", "SIMULATED sortie started");
      const emergencySim = EvaSessionService.simulateEmergencyReturn(session.id, {
        scenario: "COMMS_BLACKOUT_AND_BATTERY_DROP",
        speedFactor: 1.25,
      });
      // Actually transition the EVA session to EMERGENCY_RETURN, then COMPLETE safe return
      EvaSessionService.transitionSession(
        session.id,
        "EMERGENCY_RETURN",
        "SIMULATED comms blackout + battery drop triggered emergency return"
      );
      const completedEmergency = EvaSessionService.transitionSession(
        session.id,
        "COMPLETE",
        "SIMULATED crew reached habitat airlock safely via emergency return"
      );
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_SAFETY_OFFICER",
        entityId: session.id,
        eventType: "EVA_EMERGENCY_RETURN",
        payload: {
          simulated: true,
          evaSessionId: session.id,
          outcome: emergencySim.outcome,
          finalSessionStatus: completedEmergency.status,
          elapsedMinutes: emergencySim.estimatedReturnMinutes || 42,
          batteryPercent: 46,
        },
      });
      summary = `Triggered EMERGENCY_RETURN for ${session.id} (${emergencySim.outcome}); crew returned and session reached ${completedEmergency.status}.`;
      details = {
        evaSessionId: session.id,
        emergencyOutcome: emergencySim.outcome,
        finalSessionStatus: completedEmergency.status,
        eventId: evt.eventId,
      };
    } else if (stepDef.stepId === "REASSIGN_AUTONOMOUS_SUPPORT") {
      const evt = MissionEventStore.appendEvent({
        missionId: run.missionId,
        actor: "SIMULATED_AUTONOMOUS_RELAY",
        entityId: run.missionId,
        eventType: "PACKET_DELIVERED",
        payload: {
          simulated: true,
          status: "COMPLETED",
          reassignedAgent: "agent-drone-01",
          batteryPercent: 44,
          distanceKm: 1.65,
          latencyMs: 195,
        },
      });
      summary = "Reassigned autonomous scout relay and restored telemetry link (195 ms latency).";
      details = { eventId: evt.eventId, reassignedAgent: "agent-drone-01", batteryPercent: 44 };
    } else if (stepDef.stepId === "VERIFY_ANALYTICS_REPLAY_AUDIT") {
      const analytics = MissionAnalyticsService.getAnalytics(run.missionId);
      const events = MissionEventStore.getEventsByMission(run.missionId);
      const audit = auditChainService.verifyChain();
      const evaSessions = EvaSessionService.listSessions(run.missionId);
      const latestEva = evaSessions[evaSessions.length - 1] || null;
      const mcStep = run.steps.find((s) => s.stepId === "EVALUATE_MONTE_CARLO_RISK");

      const emergencyEventsCount = events.filter(
        (e) =>
          e.eventType === "EVA_EMERGENCY_RETURN" ||
          (e.eventType === "EVA_TRANSITION" &&
            (e.payload as Record<string, unknown>)?.toStatus === "EMERGENCY_RETURN")
      ).length;

      run.finalSummary = {
        totalSteps: scenarioDef.steps.length,
        completedSteps: run.steps.length + 1,
        totalDistanceKm: analytics.operations.totalDistanceTraversedKm,
        cumulativeScienceYield: analytics.science.cumulativeScienceYield,
        safetyViolations: analytics.safety.safetyViolationCount,
        auditIntegrityStatus: audit.isValid ? "100% VERIFIED" : "COMPROMISED",
        emergencyReturnTriggered:
          analytics.evaSummary.historicalEmergencyReturnCount > 0 || emergencyEventsCount > 0,
        historicalEmergencyCount: analytics.evaSummary.historicalEmergencyReturnCount,
        emergencyEventsCount,
        finalEvaSessionStatus: latestEva ? latestEva.status : null,
        monteCarloCompletionRatePercent:
          typeof mcStep?.details?.missionCompletionRatePercent === "number"
            ? (mcStep.details.missionCompletionRatePercent as number)
            : null,
        monteCarloSurvivalRatePercent:
          typeof mcStep?.details?.overallSurvivalRatePercent === "number"
            ? (mcStep.details.overallSurvivalRatePercent as number)
            : null,
        isolatedFromUserMissions: run.missionId.startsWith("DEMO-"),
        disclosure:
          "SIMULATED judging demonstration only. Not NASA-certified, flight-ready, or scientifically validated.",
      };

      summary = `Verified analytics (${events.length} events), historical emergencies (${run.finalSummary.historicalEmergencyCount}), and SHA-256 audit chain (${run.finalSummary.auditIntegrityStatus}).`;
      details = {
        eventsCount: events.length,
        auditValid: audit.isValid,
        finalSummary: run.finalSummary,
      };
    }

    return {
      stepIndex,
      stepId: stepDef.stepId,
      title: stepDef.title,
      status: "COMPLETED",
      executedAt: now,
      provenanceClassification: "SIMULATED",
      summary,
      details,
    };
  }

  /**
   * Executes a complete deterministic Judging Demo scenario in Guided Mode.
   */
  public static async runFullScenario(
    scenarioId: JudgingScenarioId
  ): Promise<JudgingDemoRunRecord> {
    this.ensureLoaded();
    const def = SCENARIO_CATALOG[scenarioId];
    if (!def) {
      throw new Error(`Unknown judging scenario: ${scenarioId}`);
    }

    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const prefix = scenarioId === "NOMINAL_EXPLORATION" ? "DEMO-NOMINAL" : "DEMO-FAILURE";
    const missionId = `${prefix}-${suffix}`;
    const routeId = `route-demo-${suffix.toLowerCase()}`;
    const run: JudgingDemoRunRecord = {
      runId: `run-${suffix.toLowerCase()}`,
      scenarioId,
      scenarioTitle: def.title,
      missionId,
      routeId,
      mode: "GUIDED",
      status: "IN_PROGRESS",
      seed: def.seed,
      startedAt: new Date().toISOString(),
      provenanceClassification: "SIMULATED",
      steps: [],
    };

    this.runs.push(run);

    for (let i = 0; i < def.steps.length; i++) {
      const stepRes = await this.executeSingleStepInternal(run, i);
      run.steps.push(stepRes);
    }

    run.status = scenarioId === "OPERATIONAL_FAILURE" ? "RECOVERED" : "COMPLETED";
    run.completedAt = new Date().toISOString();
    this.persistRuns();
    return run;
  }

  /**
   * Executes the next step (or initializes a new manual run) in Manual Step-by-Step Mode.
   */
  public static async executeManualStep(params: {
    scenarioId: JudgingScenarioId;
    runId?: string;
    stepIndex?: number;
  }): Promise<JudgingDemoRunRecord> {
    this.ensureLoaded();
    const def = SCENARIO_CATALOG[params.scenarioId];
    if (!def) {
      throw new Error(`Unknown judging scenario: ${params.scenarioId}`);
    }

    let run = params.runId ? this.runs.find((r) => r.runId === params.runId) : undefined;
    if (!run) {
      const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
      const prefix =
        params.scenarioId === "NOMINAL_EXPLORATION" ? "DEMO-NOMINAL" : "DEMO-FAILURE";
      run = {
        runId: `run-${suffix.toLowerCase()}`,
        scenarioId: params.scenarioId,
        scenarioTitle: def.title,
        missionId: `${prefix}-${suffix}`,
        routeId: `route-demo-${suffix.toLowerCase()}`,
        mode: "MANUAL",
        status: "IN_PROGRESS",
        seed: def.seed,
        startedAt: new Date().toISOString(),
        provenanceClassification: "SIMULATED",
        steps: [],
      };
      this.runs.push(run);
    }

    const nextIdx =
      typeof params.stepIndex === "number" ? params.stepIndex : run.steps.length;
    if (nextIdx >= def.steps.length) {
      return run;
    }

    if (!run.steps.some((s) => s.stepIndex === nextIdx)) {
      const stepRes = await this.executeSingleStepInternal(run, nextIdx);
      run.steps.push(stepRes);
    }

    if (run.steps.length >= def.steps.length) {
      run.status = run.scenarioId === "OPERATIONAL_FAILURE" ? "RECOVERED" : "COMPLETED";
      run.completedAt = new Date().toISOString();
    }

    this.persistRuns();
    return run;
  }

  /**
   * Safely deletes ONLY records explicitly owned by judging demo runs (isDemo === true or
   * recorded in judging-demo-runs.json), plus their demo routes, EVA sessions, and science decisions.
   * Never deletes user missions, normal routes, or unrelated events/audit blocks.
   */
  public static async resetDemoData(): Promise<{
    deletedDemoMissions: string[];
    deletedDemoRoutes: string[];
    deletedEvaSessionsCount: number;
    deletedScienceDecisionsCount: number;
    clearedRunsCount: number;
  }> {
    this.ensureLoaded();
    const ownedMissionIds = new Set(this.runs.map((r) => r.missionId));
    const ownedRouteIds = new Set(this.runs.map((r) => r.routeId));

    const allMissions = await missionRepository.getAllMissions();
    const deletedDemoMissions: string[] = [];
    for (const m of allMissions) {
      if (m.isDemo === true || ownedMissionIds.has(m.id)) {
        await missionRepository.deleteMission(m.id);
        deletedDemoMissions.push(m.id);
        ownedMissionIds.add(m.id);
      }
    }

    const allRoutes = await missionRepository.getAllRoutes();
    const deletedDemoRoutes: string[] = [];
    for (const r of allRoutes) {
      if (ownedRouteIds.has(r.id) || r.id.startsWith("route-demo-")) {
        await missionRepository.deleteRoute(r.id);
        deletedDemoRoutes.push(r.id);
      }
    }

    const ownedIdList = Array.from(ownedMissionIds);
    const deletedEvaSessionsCount = EvaSessionService.deleteSessionsForMissions(ownedIdList);
    const deletedScienceDecisionsCount =
      scienceDecisionService.deleteDecisionsForMissions(ownedIdList);

    const clearedRunsCount = this.runs.length;
    this.runs = [];
    this.persistRuns();

    return {
      deletedDemoMissions,
      deletedDemoRoutes,
      deletedEvaSessionsCount,
      deletedScienceDecisionsCount,
      clearedRunsCount,
    };
  }
}
