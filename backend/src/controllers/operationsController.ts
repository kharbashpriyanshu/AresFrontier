import { Request, Response } from "express";
import { z } from "zod";
import { AgentRegistry } from "../services/agents/agentRegistry.js";
import { AgentStateStore } from "../services/agents/agentStateStore.js";
import { AgentTaskPlanner } from "../services/agents/agentTaskPlanner.js";
import { CommunicationEngine } from "../services/comms/communicationEngine.js";
import { CommunicationCoverageEngine } from "../services/comms/communicationCoverage.js";
import { OrbitalVisibilityEngine } from "../services/comms/orbitalVisibilityEngine.js";
import { CommunicationQueueService } from "../services/comms/communicationQueueService.js";
import { MissionTimelineEngine } from "../services/operations/missionTimelineEngine.js";
import { MissionOperationsEngine } from "../services/operations/missionOperationsEngine.js";
import { ReplanningEngine } from "../services/operations/replanningEngine.js";
import { MultiAgentCoordinator } from "../services/operations/multiAgentCoordinator.js";
import { ResourceAllocator } from "../services/operations/resourceAllocator.js";
import { missionReasoningService } from "../services/intelligence/missionReasoningService.js";
import { AuditChainService } from "../services/security/auditChainService.js";
import { ObservationStore } from "../services/sensors/observationStore.js";
import { MissionPersistenceService } from "../services/persistence/missionPersistenceService.js";
import { MissionEventStore } from "../services/persistence/missionEventStore.js";
import { CommandSecurityService, RBAC_PERMISSIONS } from "../services/security/commandSecurityService.js";
import { SafetyInvariantService } from "../services/safety/safetyInvariantService.js";
import { MissionReplayEngine } from "../services/replay/missionReplayEngine.js";
import { WhatIfSimulationEngine } from "../services/simulation/whatIfSimulationEngine.js";
import { SimulationScenarioManager } from "../services/simulation/simulationScenarioManager.js";
import { ScenarioBuilderService, ScenarioValidationError } from "../services/simulation/scenarioBuilderService.js";
import { MonteCarloEngine } from "../services/simulation/monteCarloEngine.js";
import { FailureInjectionEngine } from "../services/simulation/failureInjectionEngine.js";
import { MissionValidationEngine } from "../services/validation/missionValidationEngine.js";
import { MissionAnalyticsService } from "../services/intelligence/missionAnalyticsService.js";
import { DecisionLineageService } from "../services/intelligence/decisionLineageService.js";
import { MissionCommandEnvelope } from "../types/index.js";
import { TaskLifecycleService, OperationsValidationError } from "../services/operations/taskLifecycleService.js";
import { EvaSessionService } from "../services/eva/evaSessionService.js";
import { AgentStatus, AstronautAgent } from "../services/agents/agentTypes.js";
import { ProvenanceService } from "../services/planetary/provenanceService.js";
import { HistoricalReconstructionService } from "../services/replay/historicalReconstructionService.js";
import { missionRepository } from "../repositories/missionRepository.js";
import { JudgingDemoService, JudgingScenarioId } from "../services/demo/judgingDemoService.js";

function handleOpsError(res: Response, err: unknown): void {
  if (err instanceof OperationsValidationError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  const msg = err instanceof Error ? err.message : "Operations error";
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: msg } });
}

// Validation schemas
const AssignTaskSchema = z.object({
  taskType: z.enum([
    "SURVEY_TERRAIN",
    "INSPECT_HAZARD",
    "COLLECT_SCIENCE",
    "VERIFY_ROUTE",
    "RELAY_SIGNAL",
    "RETURN_TO_BASE",
    "FOLLOW_ASTRONAUT",
    "EMERGENCY_SUPPORT",
  ]),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  name: z.string().min(3),
  targetCoordinate: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(360),
  }),
  targetId: z.string().optional(),
  description: z.string().optional(),
  estimatedDurationMin: z.number().positive().default(30),
  requiredBatteryPercent: z.number().min(1).max(100).default(15),
});

const AdvanceSimSchema = z.object({
  minutes: z.number().positive().max(240).default(15),
});

const CopilotQuerySchema = z.object({
  query: z.string().min(2),
});

const EmergencySchema = z.object({
  scenario: z.enum(["BATTERY_CRITICAL", "COMMS_LOST", "HAZARD", "IMMOBILIZED"]),
});

const CommandEnvelopeSchema = z.object({
  commandId: z.string().min(3),
  agentId: z.string().min(3),
  command: z.enum(["PAUSE", "RESUME", "RETURN_TO_BASE", "EMERGENCY_STOP", "ASSIGN_TASK"]),
  issuedAt: z.number().positive(),
  expiresAt: z.number().positive(),
  nonce: z.string().min(4),
  issuer: z.string().min(2),
  role: z.enum(["MISSION_COMMAND", "SCIENCE_OFFICER", "ASTRONAUT", "ANALYST", "VIEWER"]).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const operationsController = {
  // 1. Agents
  getAgents(req: Request, res: Response) {
    const agents = AgentRegistry.getAllAgents();
    res.json({ success: true, data: agents });
  },

  getAgentById(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agent = AgentRegistry.getAgentById(id);
    if (!agent) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }
    res.json({ success: true, data: agent });
  },

  assignTask(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = AssignTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
      return;
    }

    const agent = AgentRegistry.getAgentById(id);
    if (!agent) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }

    // Evaluate feasibility
    const feasibility = AgentTaskPlanner.evaluateTaskFeasibility(
      agent,
      parsed.data.targetCoordinate,
      { latitude: 18.4447, longitude: 77.4508 }
    );

    if (!feasibility.feasible) {
      res.status(422).json({
        success: false,
        error: {
          code: "TASK_UNFEASIBLE",
          message: `Task rejected by safety planner: ${feasibility.reasons.join("; ")}`,
          details: feasibility,
        },
      });
      return;
    }

    const task = AgentTaskPlanner.createTask({
      agentId: agent.id,
      taskType: parsed.data.taskType,
      priority: parsed.data.priority,
      name: parsed.data.name,
      targetCoordinate: parsed.data.targetCoordinate,
      targetId: parsed.data.targetId,
      description: parsed.data.description,
      estimatedDurationMin: parsed.data.estimatedDurationMin,
      requiredBatteryPercent: parsed.data.requiredBatteryPercent,
    });

    agent.currentTask = task;
    agent.status = "EXECUTING";
    AgentRegistry.updateAgent(agent);

    AgentStateStore.recordEvent({
      agentId: agent.id,
      eventType: "TASK_ASSIGNED",
      severity: "INFO",
      message: `Task '${task.name}' assigned to ${agent.callsign}`,
      details: { taskId: task.id, feasibility },
    });

    res.status(201).json({ success: true, data: { task, feasibility } });
  },

  reassignTask(req: Request, res: Response) {
    const { taskId, targetAgentId, reason } = req.body;
    if (!taskId || !targetAgentId) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "taskId and targetAgentId required" },
      });
      return;
    }
    const result = MultiAgentCoordinator.reassignTask(
      taskId,
      targetAgentId,
      reason || "Manual mission operator reassignment"
    );
    if (!result.success) {
      res.status(422).json({
        success: false,
        error: { code: "REASSIGNMENT_FAILED", message: result.message },
      });
      return;
    }
    res.json({ success: true, data: result });
  },

  createDigitalTwinSnapshot(req: Request, res: Response) {
    const tag = req.body?.tag || "OPERATOR_CHECKPOINT";
    const missionId = req.body?.missionId || "MARSWALK-001";
    const simTime = MissionOperationsEngine.getSimulationState().simulationTimeMinutes;
    const snapshot = MissionReplayEngine.stateManager.createSnapshot(tag, simTime, missionId);
    MissionEventStore.appendEvent({
      missionId,
      actor: "DIGITAL_TWIN",
      entityId: snapshot.snapshotId,
      eventType: "SNAPSHOT_CREATED",
      payload: { snapshotId: snapshot.snapshotId, tag, stateHash: snapshot.stateHash, simTimeMinutes: simTime },
    });
    res.json({ success: true, data: snapshot });
  },

  getDigitalTwinInconsistencies(req: Request, res: Response) {
    const report = MissionReplayEngine.stateManager.detectInconsistencies();
    res.json({ success: true, data: report });
  },

  executeCommand(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { command } = req.body;
    const agent = AgentRegistry.getAgentById(id);
    if (!agent) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }

    if (command === "PAUSE") {
      agent.status = "PAUSED";
      agent.telemetry.speedKph = 0;
    } else if (command === "RESUME") {
      agent.status = "EXECUTING";
      agent.telemetry.speedKph = agent.type === "ROVER" ? 3.5 : 2.8;
    } else if (command === "RETURN_TO_BASE") {
      agent.status = "RETURNING";
      agent.assignedRouteId = "route-return-base";
    }

    AgentRegistry.updateAgent(agent);
    TaskLifecycleService.syncDigitalTwin();
    res.json({ success: true, data: { agent, commandExecuted: command } });
  },

  // 2. Communications
  getCommunications(req: Request, res: Response) {
    const agents = AgentRegistry.getAllAgents();
    const simTime = MissionOperationsEngine.getSimulationState().simulationTimeMinutes;
    const topology = CommunicationEngine.evaluateNetwork(agents, simTime);
    res.json({ success: true, data: topology });
  },

  getCommunicationWindows(req: Request, res: Response) {
    const windows = CommunicationCoverageEngine.getCommunicationWindows({ latitude: 18.4447, longitude: 77.4508 });
    res.json({ success: true, data: windows });
  },

  // 3. Timeline
  getTimeline(req: Request, res: Response) {
    const timeline = MissionTimelineEngine.getTimeline();
    res.json({ success: true, data: timeline });
  },

  // 4. Simulation
  startSimulation(req: Request, res: Response) {
    const { timeScale = 1.0 } = req.body;
    const state = MissionOperationsEngine.setSimulationRunning(true, timeScale);
    res.json({ success: true, data: state });
  },

  pauseSimulation(req: Request, res: Response) {
    const state = MissionOperationsEngine.setSimulationRunning(false);
    res.json({ success: true, data: state });
  },

  resetSimulation(req: Request, res: Response) {
    const state = MissionOperationsEngine.resetSimulation();
    res.json({ success: true, data: state });
  },

  advanceSimulation(req: Request, res: Response) {
    const parsed = AdvanceSimSchema.safeParse(req.body);
    const minutes = parsed.success ? parsed.data.minutes : 15;
    const result = MissionOperationsEngine.advanceSimulation(minutes);
    res.json({ success: true, data: result });
  },

  // 5. Replanning & Flagship Demo
  async triggerReplan(req: Request, res: Response) {
    const proposal = await ReplanningEngine.triggerReplan({
      triggerType: "HAZARD_DETECTED",
      initiatorAgentId: "agent-rover-01",
      initiatorCallsign: "ROVER-01 SCOUT",
      reason: req.body.reason || "Localized steep slope detected along primary corridor",
      detectedCoordinate: req.body.coordinate,
    });
    res.status(201).json({ success: true, data: proposal });
  },

  approveReplan(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actorId = req.user?.userId || "FLIGHT_DIRECTOR_01";
    try {
      const proposal = ReplanningEngine.approveReplan(id, actorId);
      res.json({ success: true, data: proposal });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: err.message } });
    }
  },

  async triggerDemoHazardRecon(req: Request, res: Response) {
    const result = await MissionOperationsEngine.triggerDemoScenario();
    res.json({
      success: true,
      data: {
        scenario: "ROVER_01_HAZARD_RECON_DEMO",
        replanProposal: result.replanProposal,
        relayRoute: result.relayRoute,
        affectedAgent: result.affectedAgent,
      },
    });
  },

  // 6. Emergency
  async triggerEmergency(req: Request, res: Response) {
    const parsed = EmergencySchema.safeParse(req.body);
    const scenario = parsed.success ? parsed.data.scenario : "HAZARD";
    const emergency = await MissionOperationsEngine.triggerEmergency(scenario);
    res.json({ success: true, data: emergency });
  },

  // 7. Science Queue
  getScienceQueue(req: Request, res: Response) {
    const queue = MultiAgentCoordinator.getScienceQueue();
    res.json({ success: true, data: queue });
  },

  assignScienceQueue(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const item = MultiAgentCoordinator.updateQueueItemStatus(
        id,
        req.body.status || "ASSIGNED",
        req.body.agentCallsign
      );
      res.json({ success: true, data: item });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: err.message } });
    }
  },

  // 8. Overall Operations State & Events
  getOperationsState(req: Request, res: Response) {
    const agents = AgentRegistry.getAllAgents();
    const simTime = MissionOperationsEngine.getSimulationState().simulationTimeMinutes;
    const network = CommunicationEngine.evaluateNetwork(agents, simTime);
    const timeline = MissionTimelineEngine.getTimeline();
    const scienceQueue = MultiAgentCoordinator.getScienceQueue();
    const simState = MissionOperationsEngine.getSimulationState();
    const events = AgentStateStore.getEvents(25);
    const replanProposals = ReplanningEngine.getActiveProposals();
    const allocations = ResourceAllocator.getAllocations();
    const observations = ObservationStore.getObservations(10);
    const commQueue = CommunicationQueueService.getQueue();

    res.json({
      success: true,
      data: {
        simState,
        agents,
        network,
        timeline,
        scienceQueue,
        events,
        replanProposals,
        allocations,
        observations,
        commQueue,
      },
    });
  },

  // 9. Operations Copilot Query
  copilotQuery(req: Request, res: Response) {
    const parsed = CopilotQuerySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Query required" } });
      return;
    }

    const response = missionReasoningService.generateOperationsCopilotResponse(parsed.data.query);
    res.json({ success: true, data: response });
  },

  // -------------------------------------------------------------
  // PHASE 5: SENSOR OBSERVATIONS, ORBITAL PASSES, PERSISTENCE & SECURITY
  // -------------------------------------------------------------

  getObservations(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 50;
    const observations = ObservationStore.getObservations(limit);
    res.json({ success: true, data: observations });
  },

  getObservationById(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const obs = ObservationStore.getObservationById(id);
    if (!obs) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Observation not found" } });
      return;
    }
    res.json({ success: true, data: obs });
  },

  getOrbitalWindows(req: Request, res: Response) {
    const windows = CommunicationCoverageEngine.getCommunicationWindows({ latitude: 18.4447, longitude: 77.4508 });
    res.json({ success: true, data: windows });
  },

  getOrbitalCurrent(req: Request, res: Response) {
    const simTime = MissionOperationsEngine.getSimulationState().simulationTimeMinutes;
    const vis = OrbitalVisibilityEngine.calculateVisibility({ latitude: 18.4447, longitude: 77.4508 }, simTime);
    res.json({ success: true, data: vis });
  },

  getCommsQueue(req: Request, res: Response) {
    const queue = CommunicationQueueService.getQueue();
    res.json({ success: true, data: queue });
  },

  getCommsStatus(req: Request, res: Response) {
    const agents = AgentRegistry.getAllAgents();
    const simTime = MissionOperationsEngine.getSimulationState().simulationTimeMinutes;
    const network = CommunicationEngine.evaluateNetwork(agents, simTime);
    res.json({ success: true, data: network });
  },

  getMissionEvents(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 50;
    const events = MissionEventStore.getEvents(limit);
    res.json({ success: true, data: events });
  },

  getMissionEventById(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const evt = MissionEventStore.getEventById(id);
    if (!evt) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Event not found" } });
      return;
    }
    res.json({ success: true, data: evt });
  },

  getSecurityPermissions(req: Request, res: Response) {
    const userRole = req.user?.role || "VIEWER";
    res.json({
      success: true,
      data: {
        role: userRole,
        permissions: RBAC_PERMISSIONS,
      },
    });
  },

  submitSecureCommand(req: Request, res: Response) {
    const parsed = CommandEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_FAILED", message: parsed.error.message } });
      return;
    }

    const envelope: MissionCommandEnvelope = {
      ...parsed.data,
      role: req.user?.role || "VIEWER",
    };

    const user = {
      userId: req.user?.userId || "anonymous",
      role: req.user?.role || "VIEWER",
      callsign: req.user?.callsign || "Viewer",
    };

    const val = CommandSecurityService.validateCommandEnvelope(envelope, user);
    if (!val.valid) {
      const statusCode = val.code === "FORBIDDEN" ? 403 : 400;
      res.status(statusCode).json({ success: false, error: { code: val.code || "SECURITY_REJECTION", message: val.reason } });
      return;
    }

    // Execute verified command
    const agent = AgentRegistry.getAgentById(envelope.agentId);
    if (agent) {
      if (envelope.command === "PAUSE" || envelope.command === "EMERGENCY_STOP") {
        agent.status = envelope.command === "EMERGENCY_STOP" ? "EMERGENCY" : "PAUSED";
        agent.telemetry.speedKph = 0;
      } else if (envelope.command === "RESUME") {
        agent.status = "EXECUTING";
        agent.telemetry.speedKph = agent.type === "ROVER" ? 3.5 : 2.8;
      } else if (envelope.command === "RETURN_TO_BASE") {
        agent.status = "EXECUTING";
        agent.assignedRouteId = "route-return-base";
      }
      AgentRegistry.updateAgent(agent);
    }

    MissionEventStore.appendEvent({
      missionId: "MARSWALK-001",
      actor: user.userId,
      eventType: "COMMAND_ISSUED",
      payload: { envelope },
    });

    res.json({ success: true, data: { envelope, status: "EXECUTED" } });
  },

  cancelCommand(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ success: true, data: { commandId: id, status: "CANCELLED" } });
  },

  createCheckpoint(req: Request, res: Response) {
    const checkpointId = req.body.checkpointId || `checkpoint-${Date.now()}`;
    try {
      const snapId = MissionPersistenceService.createCheckpoint(checkpointId);
      res.json({ success: true, data: { checkpointId: snapId, status: "SAVED" } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: "PERSISTENCE_ERROR", message: err.message } });
    }
  },

  restoreCheckpoint(req: Request, res: Response) {
    const checkpointId = req.body.checkpointId;
    if (!checkpointId) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "checkpointId required" } });
      return;
    }
    try {
      const success = MissionPersistenceService.restoreCheckpoint(checkpointId);
      res.json({ success: true, data: { checkpointId, status: success ? "RESTORED" : "FAILED" } });
    } catch (err: any) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: err.message } });
    }
  },

  scenarioBlackout(req: Request, res: Response) {
    const result = CommunicationQueueService.executeBlackoutScenario();
    res.json({ success: true, data: result });
  },

  async scenarioSensorHazard(req: Request, res: Response) {
    const result = await MissionOperationsEngine.triggerDemoScenario();
    res.json({ success: true, data: result });
  },

  scenarioEmergency(req: Request, res: Response) {
    const scenario = req.body.scenario || "BATTERY_CRITICAL";
    const result = MissionOperationsEngine.triggerEmergency(scenario);
    res.json({ success: true, data: result });
  },

  // --- Phase 6 Digital Twin & Mission Replay ---
  async getReplayMissions(req: Request, res: Response) {
    const storedMissions = await missionRepository.getAllMissions().catch(() => []);
    const allEvents = MissionEventStore.getAllEvents();
    const byMission = new Map<string, number>();
    for (const ev of allEvents) {
      byMission.set(ev.missionId, (byMission.get(ev.missionId) || 0) + 1);
    }

    const result: any[] = [];
    const seen = new Set<string>();

    // Always include MARSWALK-001 flagship mission
    if (!byMission.has("MARSWALK-001")) {
      MissionReplayEngine.loadMission("MARSWALK-001");
    }
    result.push({
      missionId: "MARSWALK-001",
      name: "Jezero Delta Front Traverse (Flagship)",
      status: "ACTIVE",
      eventCount: MissionEventStore.getEventsByMission("MARSWALK-001").length,
      crewCommander: "Alex Vance",
    });
    seen.add("MARSWALK-001");

    for (const m of storedMissions) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      result.push({
        missionId: m.id,
        name: m.name,
        status: m.status,
        eventCount: byMission.get(m.id) || 0,
        crewCommander: "Mission Command",
        updatedAt: m.updatedAt,
      });
    }

    for (const [mid, count] of byMission.entries()) {
      if (seen.has(mid)) continue;
      seen.add(mid);
      result.push({
        missionId: mid,
        name: `Recorded Mission (${mid})`,
        status: "RECORDED",
        eventCount: count,
        crewCommander: "Mission Command",
      });
    }

    res.json({ success: true, data: result });
  },

  getReplayState(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    MissionReplayEngine.loadMission(missionId);
    const state = MissionReplayEngine.getReplayState();
    const summary = MissionReplayEngine.getReplaySummary();
    const events = MissionReplayEngine.getEvents();
    const auditIntegrity = MissionEventStore.verifyChain();
    res.json({ success: true, data: { state, summary, events, auditIntegrity } });
  },

  startReplay(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const state = MissionReplayEngine.startReplay(missionId);
    res.json({ success: true, data: state });
  },

  pauseReplay(req: Request, res: Response) {
    const state = MissionReplayEngine.pauseReplay();
    res.json({ success: true, data: state });
  },

  resumeReplay(req: Request, res: Response) {
    const state = MissionReplayEngine.resumeReplay();
    res.json({ success: true, data: state });
  },

  stepReplay(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : undefined;
    if (missionId && MissionReplayEngine.getReplayState().missionId !== missionId) {
      MissionReplayEngine.loadMission(missionId);
    }
    const direction = req.body.direction === "BACKWARD" ? "BACKWARD" : "FORWARD";
    const state = MissionReplayEngine.stepReplay(direction);
    res.json({ success: true, data: state });
  },

  seekReplay(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : undefined;
    if (missionId && MissionReplayEngine.getReplayState().missionId !== missionId) {
      MissionReplayEngine.loadMission(missionId);
    }
    const mode = req.body.mode === "INDEX" ? "INDEX" : req.body.mode === "SIM_TIME" ? "SIM_TIME" : undefined;
    const target = Number(req.body.target ?? req.body.timestamp ?? 0);
    const state = MissionReplayEngine.seekReplay(target, mode);
    res.json({ success: true, data: state });
  },

  resetReplay(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : undefined;
    if (missionId && MissionReplayEngine.getReplayState().missionId !== missionId) {
      MissionReplayEngine.loadMission(missionId);
    }
    const state = MissionReplayEngine.resetReplay();
    res.json({ success: true, data: state });
  },

  reconstructHistoricalState(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
    const sequenceNumber = req.query.sequenceNumber !== undefined ? Number(req.query.sequenceNumber) : undefined;
    const timestamp = typeof req.query.timestamp === "string" ? req.query.timestamp : undefined;
    const snapshotId = typeof req.query.snapshotId === "string" ? req.query.snapshotId : undefined;

    const reconstructed = HistoricalReconstructionService.reconstructAt({
      missionId,
      eventId,
      sequenceNumber,
      timestamp,
      snapshotId,
    });
    res.json({ success: true, data: reconstructed });
  },

  inspectReplayEvent(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
    const detail = HistoricalReconstructionService.inspectEvent(missionId, eventId);
    if (!detail) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Mission event not found" } });
      return;
    }
    res.json({ success: true, data: detail });
  },

  compareHistoricalStates(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const leftTarget = req.body?.leftTarget || { type: "SEQUENCE", sequenceNumber: 1 };
    const rightTarget = req.body?.rightTarget || { type: "LIVE" };
    const comparison = HistoricalReconstructionService.compareStates(missionId, leftTarget, rightTarget);
    res.json({ success: true, data: comparison });
  },

  exportReplayData(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const format = (req.query.format === "csv" || req.query.format === "markdown" ? req.query.format : "json") as "csv" | "json" | "markdown";
    const kind = (req.query.kind === "snapshot" || req.query.kind === "summary" || req.query.kind === "event" ? req.query.kind : "events") as "events" | "snapshot" | "summary" | "event";
    const exported = HistoricalReconstructionService.exportMissionData({
      missionId,
      format,
      kind,
      eventId: typeof req.query.eventId === "string" ? req.query.eventId : undefined,
      sequenceNumber: req.query.sequenceNumber !== undefined ? Number(req.query.sequenceNumber) : undefined,
      timestamp: typeof req.query.timestamp === "string" ? req.query.timestamp : undefined,
      agentId: typeof req.query.agentId === "string" ? req.query.agentId : undefined,
      eventType: typeof req.query.eventType === "string" ? req.query.eventType : undefined,
    });
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.body);
  },

  getReplaySnapshots(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const snaps = MissionReplayEngine.stateManager
      .getAllSnapshots()
      .filter((s) => !s.missionId || s.missionId === missionId)
      .map((s) => ({
        snapshotId: s.snapshotId,
        missionId: s.missionId || missionId,
        tag: s.tag,
        timestamp: s.timestamp,
        simTimeMinutes: s.simTimeMinutes,
        stateHash: s.stateHash,
        verified: MissionReplayEngine.stateManager.getSnapshot(s.snapshotId)
          ? (MissionReplayEngine.stateManager.constructor as any).verifySnapshotIntegrity(s)
          : false,
      }));
    res.json({ success: true, data: snaps });
  },

  // --- Phase 6 What-If Simulation Engine ---
  cloneMission(req: Request, res: Response) {
    const missionId = req.body.missionId || "MARSWALK-001";
    const clone = SimulationScenarioManager.cloneMissionState(missionId);
    res.json({ success: true, data: { missionId, clonedAt: new Date().toISOString(), state: clone } });
  },

  runWhatIf(req: Request, res: Response) {
    const baselineMissionId = req.body.baselineMissionId || "MARSWALK-001";
    const decisionOverride = req.body.decisionOverride;
    const scenarios = req.body.scenarios;
    const affectedAgentId = req.body.affectedAgentId;
    const forkSimTimeMinutes = Number(req.body.forkSimTimeMinutes || 18);

    const result = SimulationScenarioManager.evaluateWhatIf({
      baselineMissionId,
      decisionOverride,
      scenarios,
      affectedAgentId,
      forkSimTimeMinutes,
      rationale: req.body.rationale,
    });
    MissionEventStore.appendEvent({
      missionId: baselineMissionId,
      actor: "SIMULATION_ENGINE",
      entityId: (result as any).simulationId || (result as any).scenarioId || "what-if",
      eventType: "WHAT_IF_EXECUTED",
      payload: { decisionOverride, forkSimTimeMinutes, rationale: req.body.rationale },
    });
    res.json({ success: true, data: result });
  },

  runMonteCarlo(req: Request, res: Response) {
    const runCount = Number(req.body.runCount || 100);
    const seed = Number(req.body.seed || 20261107);
    const batteryVariancePercent = req.body.batteryVariancePercent !== undefined ? Number(req.body.batteryVariancePercent) : undefined;
    const traversalSpeedVariancePercent = req.body.traversalSpeedVariancePercent !== undefined ? Number(req.body.traversalSpeedVariancePercent) : undefined;
    const slopeVarianceDeg = req.body.slopeVarianceDeg !== undefined ? Number(req.body.slopeVarianceDeg) : undefined;
    const commOutageRate = req.body.commOutageRate !== undefined ? Number(req.body.commOutageRate) : undefined;

    const result = SimulationScenarioManager.evaluateMonteCarlo({
      runCount,
      seed,
      batteryVariancePercent,
      traversalSpeedVariancePercent,
      slopeVarianceDeg,
      commOutageRate,
    });
    MissionEventStore.appendEvent({
      missionId: "MARSWALK-001",
      actor: "MONTE_CARLO_ENGINE",
      entityId: `mc-${seed}-${runCount}`,
      eventType: "MONTE_CARLO_EXECUTED",
      payload: { runCount, seed, successProbabilityPercent: result.successProbabilityPercent },
    });
    res.json({ success: true, data: result });
  },

  injectFailure(req: Request, res: Response) {
    const failureType = req.body.failureType || "SENSOR_DEGRADED";
    const targetAgentId = req.body.targetAgentId || "agent-rover-01";
    const result = FailureInjectionEngine.injectFailure({
      failureType,
      targetAgentId,
      severity: req.body.severity || "CRITICAL",
    });
    res.json({ success: true, data: result });
  },

  // --- Phase 6 Safety Validation & Analytics ---
  validateMission(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const result = MissionValidationEngine.validateMission(missionId);
    res.json({ success: true, data: result });
  },

  getMissionAnalytics(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const result = MissionAnalyticsService.getAnalytics(missionId, {
      fromIso: typeof req.query.from === "string" && req.query.from ? req.query.from : undefined,
      toIso: typeof req.query.to === "string" && req.query.to ? req.query.to : undefined,
      limit: limitRaw,
      includeDemo: req.query.includeDemo === "false" ? false : true,
      agentId: typeof req.query.agentId === "string" && req.query.agentId ? req.query.agentId : undefined,
      severity: typeof req.query.severity === "string" && req.query.severity ? req.query.severity : undefined,
    });
    res.json({ success: true, data: result });
  },

  compareMissions(req: Request, res: Response) {
    const missionIds = Array.isArray(req.body?.missionIds)
      ? req.body.missionIds.filter((x: unknown): x is string => typeof x === "string")
      : ["MARSWALK-001"];
    if (missionIds.length === 0) {
      res.status(400).json({ success: false, error: { code: "INVALID_INPUT", message: "Provide at least one missionId." } });
      return;
    }
    const result = MissionAnalyticsService.compareMissions(missionIds);
    res.json({ success: true, data: result });
  },

  exportMissionAnalytics(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const sectionRaw = typeof req.query.section === "string" ? req.query.section : "overview";
    const section = (["overview", "timeseries", "agents", "routes", "hazards"].includes(sectionRaw)
      ? sectionRaw
      : "overview") as "overview" | "timeseries" | "agents" | "routes" | "hazards";
    const format = req.query.format === "csv" ? "csv" : "json";
    const limitRaw = req.query.limit ? Number(req.query.limit) : undefined;
    const exported = MissionAnalyticsService.exportAnalytics(missionId, section, format, {
      fromIso: typeof req.query.from === "string" && req.query.from ? req.query.from : undefined,
      toIso: typeof req.query.to === "string" && req.query.to ? req.query.to : undefined,
      limit: limitRaw,
      agentId: typeof req.query.agentId === "string" && req.query.agentId ? req.query.agentId : undefined,
      severity: typeof req.query.severity === "string" && req.query.severity ? req.query.severity : undefined,
    });
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.content);
  },

  // --- Recovery Batch 7: Isolated Judging Demo ---
  getJudgingDemoCatalog(_req: Request, res: Response) {
    res.json({ success: true, data: JudgingDemoService.getCatalog() });
  },

  listJudgingDemoRuns(_req: Request, res: Response) {
    res.json({ success: true, data: JudgingDemoService.listRuns() });
  },

  async runJudgingDemo(req: Request, res: Response) {
    try {
      const scenarioId = (req.body?.scenarioId || "NOMINAL_EXPLORATION") as JudgingScenarioId;
      if (scenarioId !== "NOMINAL_EXPLORATION" && scenarioId !== "OPERATIONAL_FAILURE") {
        res.status(400).json({ success: false, error: { code: "INVALID_SCENARIO", message: `Unsupported scenario '${scenarioId}'` } });
        return;
      }
      const run = await JudgingDemoService.runFullScenario(scenarioId);
      res.json({ success: true, data: run });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  async stepJudgingDemo(req: Request, res: Response) {
    try {
      const scenarioId = (req.body?.scenarioId || "NOMINAL_EXPLORATION") as JudgingScenarioId;
      if (scenarioId !== "NOMINAL_EXPLORATION" && scenarioId !== "OPERATIONAL_FAILURE") {
        res.status(400).json({ success: false, error: { code: "INVALID_SCENARIO", message: `Unsupported scenario '${scenarioId}'` } });
        return;
      }
      const runId = typeof req.body?.runId === "string" ? req.body.runId : undefined;
      const stepIndex = typeof req.body?.stepIndex === "number" ? req.body.stepIndex : undefined;
      const run = await JudgingDemoService.executeManualStep({ scenarioId, runId, stepIndex });
      res.json({ success: true, data: run });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  async resetJudgingDemo(_req: Request, res: Response) {
    try {
      const result = await JudgingDemoService.resetDemoData();
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  getProvenance(req: Request, res: Response) {
    const key = String(req.query.key || "slope");
    const val = String(req.query.value || "21.8°");
    const result = DecisionLineageService.getProvenanceDetails(key, val);
    res.json({ success: true, data: result });
  },

  getDecisionLineage(req: Request, res: Response) {
    const rawId = req.params.eventId;
    const eventId = typeof rawId === "string" ? rawId : "evt-flagship-detour";
    const result = DecisionLineageService.getDecisionLineage(eventId);
    res.json({ success: true, data: result });
  },

  // --- Recovery Batch 3: Task Lifecycle, Agent Status, Telemetry, Comms & EVA Sessions ---
  getTasks(req: Request, res: Response) {
    const missionId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
    const tasks = TaskLifecycleService.getAllTasks(missionId);
    res.json({ success: true, data: tasks });
  },

  createAndAssignTask(req: Request, res: Response) {
    try {
      const schema = AssignTaskSchema.extend({
        agentId: z.string().min(1),
        missionId: z.string().optional(),
        targetDescription: z.string().optional(),
        scienceObjective: z.string().optional(),
        requiredCapabilities: z.array(z.string()).optional(),
        dependencies: z.array(z.string()).optional(),
        autoStart: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid task payload", details: parsed.error.flatten() } });
        return;
      }
      const d = parsed.data;
      const result = TaskLifecycleService.createAndAssignTask({
        agentId: d.agentId,
        missionId: d.missionId,
        name: d.name,
        taskType: d.taskType,
        priority: d.priority,
        targetCoordinate: d.targetCoordinate,
        targetDescription: d.targetDescription,
        requiredCapabilities: d.requiredCapabilities as any,
        dependencies: d.dependencies,
        scienceObjective: d.scienceObjective as any,
        autoStart: d.autoStart,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  transitionTask(req: Request, res: Response) {
    try {
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      const actionSchema = z.object({
        action: z.enum(["START", "PAUSE", "RESUME", "COMPLETE", "CANCEL", "FAIL"]),
        reason: z.string().optional(),
      });
      const parsed = actionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid task transition action" } });
        return;
      }
      const result = TaskLifecycleService.transitionTask(taskId, parsed.data.action, parsed.data.reason);
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  transitionAgentStatus(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const schema = z.object({
        status: z.enum(["IDLE", "PLANNING", "EXECUTING", "PAUSED", "RETURNING", "UNAVAILABLE", "COMMS_LOST", "EMERGENCY", "COMPLETE"]),
        reason: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid agent status" } });
        return;
      }
      const result = TaskLifecycleService.transitionAgentStatus(id, parsed.data.status as AgentStatus, parsed.data.reason);
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  updateAgentTelemetry(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const agent = AgentRegistry.getAgentById(id);
    if (!agent) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Agent not found" } });
      return;
    }

    const schema = z.object({
      batteryPercent: z.number().min(0).max(100).optional(),
      speedKph: z.number().min(0).max(20000).optional(),
      internalTempC: z.number().min(-150).max(100).optional(),
      signalStrengthPercent: z.number().min(0).max(100).optional(),
      suitOxygenReserveMinutes: z.number().min(0).max(480).optional(),
      position: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid telemetry update" } });
      return;
    }

    const now = new Date().toISOString();
    const d = parsed.data;
    if (d.batteryPercent !== undefined) {
      agent.telemetry.batteryPercent = Number(d.batteryPercent.toFixed(1));
      agent.telemetry.batteryStatus =
        d.batteryPercent < 15 ? "CRITICAL" : d.batteryPercent < 25 ? "RED" : d.batteryPercent < 45 ? "YELLOW" : "GREEN";
    }
    if (d.speedKph !== undefined) agent.telemetry.speedKph = d.speedKph;
    if (d.internalTempC !== undefined) agent.telemetry.internalTempC = d.internalTempC;
    if (d.signalStrengthPercent !== undefined) {
      agent.telemetry.signalStrengthPercent = d.signalStrengthPercent;
      agent.telemetry.lineOfSightToRelay = d.signalStrengthPercent > 0;
    }
    if (d.position) agent.position = d.position;
    if (d.suitOxygenReserveMinutes !== undefined && agent.type === "ASTRONAUT") {
      const astro = agent as AstronautAgent;
      astro.suitOxygenReserveMinutes = d.suitOxygenReserveMinutes;
      astro.telemetry.suitOxygenPercent = Math.round((d.suitOxygenReserveMinutes / 240) * 100);
    }

    agent.telemetry.lastHeartbeat = now;
    agent.provenance = ProvenanceService.createDerivedProvenance(
      "Controlled Simulated Telemetry Update",
      ["Operator Telemetry Simulator"],
      "Modeled Telemetry Injection (SIMULATED)"
    );
    AgentRegistry.updateAgent(agent);

    const safetyWarnings: string[] = [];
    if (agent.telemetry.batteryPercent < 20) {
      safetyWarnings.push(`S1 Safety Alert: ${agent.callsign} battery (${agent.telemetry.batteryPercent}%) below 20% reserve`);
    }
    if (agent.type === "ASTRONAUT" && ((agent as AstronautAgent).suitOxygenReserveMinutes ?? 240) < 30) {
      safetyWarnings.push(`S3 Safety Alert: ${agent.callsign} oxygen reserve below 30 minutes`);
    }

    TaskLifecycleService.syncDigitalTwin();
    MissionEventStore.appendEvent({
      missionId: "MARSWALK-001",
      actor: agent.callsign,
      agentId: agent.id,
      entityId: agent.id,
      eventType: "TELEMETRY_UPDATED",
      resultingState: {
        batteryPercent: agent.telemetry.batteryPercent,
        speedKph: agent.telemetry.speedKph,
        signalStrengthPercent: agent.telemetry.signalStrengthPercent,
        position: agent.position,
      },
      payload: {
        batteryPercent: agent.telemetry.batteryPercent,
        signalStrengthPercent: agent.telemetry.signalStrengthPercent,
        position: agent.position,
        safetyWarnings,
        classification: "SIMULATED",
      },
      provenance: agent.provenance,
    });
    res.json({ success: true, data: { agent, telemetryClassification: "SIMULATED", safetyWarnings } });
  },

  enqueueCommPacket(req: Request, res: Response) {
    const schema = z.object({
      sourceAgentId: z.string().min(1),
      priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "BULK", "EMERGENCY_SAFETY", "MISSION_CRITICAL_OPS", "NAVIGATION_TELEMETRY", "SCIENTIFIC_OBSERVATIONS", "ROUTINE_STATUS"]).default("HIGH"),
      type: z.enum(["TELEMETRY", "HAZARD_ALERT", "SCIENCE_DATA", "COMMAND", "EMERGENCY"]).default("TELEMETRY"),
      payloadSizeKb: z.number().min(1).max(50000).default(24),
      storeAndForward: z.boolean().optional(),
      ttlMinutes: z.number().min(1).max(1440).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid packet payload" } });
      return;
    }

    const simState = MissionOperationsEngine.getSimulationState();
    const orbiter = OrbitalVisibilityEngine.calculateVisibility({ latitude: 18.4447, longitude: 77.4508 }, simState.simulationTimeMinutes);
    const linkUp = orbiter.state === "PASS_ACTIVE" || orbiter.state === "PASS_ENDING";
    const packet = CommunicationQueueService.enqueuePacket(parsed.data as any, linkUp ? "QUEUED" : "BUFFERED");
    TaskLifecycleService.syncDigitalTwin();
    MissionEventStore.appendEvent({
      missionId: "MARSWALK-001",
      actor: parsed.data.sourceAgentId,
      agentId: parsed.data.sourceAgentId,
      entityId: packet.packetId,
      eventType: packet.status === "QUEUED" ? "PACKET_QUEUED" : "PACKET_BUFFERED",
      resultingState: { status: packet.status },
      payload: { packetId: packet.packetId, priority: packet.priority, type: packet.type, status: packet.status },
    });
    res.status(201).json({ success: true, data: { packet, linkAvailable: linkUp, queueLength: CommunicationQueueService.getQueue().length } });
  },

  flushCommQueue(req: Request, res: Response) {
    const forceOrbiterAvailable = req.body?.orbiterAvailable;
    const simState = MissionOperationsEngine.getSimulationState();
    const orbiter = OrbitalVisibilityEngine.calculateVisibility({ latitude: 18.4447, longitude: 77.4508 }, simState.simulationTimeMinutes);
    const isOrbiterAvailable =
      typeof forceOrbiterAvailable === "boolean"
        ? forceOrbiterAvailable
        : orbiter.state === "PASS_ACTIVE" || orbiter.state === "PASS_ENDING";
    const bandwidthKbps = isOrbiterAvailable ? Math.max(512, orbiter.bandwidthKbps || 2048) : 0;

    const result = CommunicationQueueService.flushQueue(isOrbiterAvailable, bandwidthKbps);
    TaskLifecycleService.syncDigitalTwin();
    for (const pkt of result.transmitted) {
      MissionEventStore.appendEvent({
        missionId: "MARSWALK-001",
        actor: pkt.sourceAgentId,
        agentId: pkt.sourceAgentId,
        entityId: pkt.packetId,
        eventType: "PACKET_DELIVERED",
        resultingState: { status: "DELIVERED" },
        payload: { packetId: pkt.packetId, priority: pkt.priority, type: pkt.type, status: "DELIVERED" },
      });
    }
    res.json({
      success: true,
      data: {
        isOrbiterAvailable,
        bandwidthKbps,
        transmittedCount: result.transmitted.length,
        bufferedCount: result.buffered.length,
        expiredCount: result.expired.length,
        queue: CommunicationQueueService.getQueue(),
      },
    });
  },

  // --- EVA Console Sessions ---
  listEvaSessions(req: Request, res: Response) {
    const missionId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
    res.json({ success: true, data: EvaSessionService.listSessions(missionId) });
  },

  createEvaSession(req: Request, res: Response) {
    try {
      const schema = z.object({
        missionId: z.string().optional(),
        title: z.string().min(3),
        crewAgentId: z.string().optional(),
        supportRoverId: z.string().optional(),
        routeId: z.string().optional(),
        plannedDurationMinutes: z.number().min(15).max(480).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid EVA session payload" } });
        return;
      }
      const created = EvaSessionService.createSession(parsed.data);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  getEvaSession(req: Request, res: Response) {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = EvaSessionService.getSessionById(id);
    if (!session) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "EVA session not found" } });
      return;
    }
    res.json({ success: true, data: session });
  },

  transitionEvaSession(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const schema = z.object({
        action: z.enum(["START", "PAUSE", "RESUME", "EMERGENCY_RETURN", "COMPLETE", "ABORT"]),
        reason: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid EVA action" } });
        return;
      }
      const updated = EvaSessionService.transitionSession(id, parsed.data.action, parsed.data.reason);
      res.json({ success: true, data: updated });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  advanceEvaSession(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const minutes = Number(req.body?.minutes ?? 15);
      const updated = EvaSessionService.advanceSessionTime(id, minutes);
      res.json({ success: true, data: updated });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  simulateEvaEmergencyReturn(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = EvaSessionService.simulateEmergencyReturn(id, {
        scenario: req.body?.scenario,
        speedFactor: req.body?.speedFactor !== undefined ? Number(req.body.speedFactor) : undefined,
        extraHazardDelayMinutes: req.body?.extraHazardDelayMinutes !== undefined ? Number(req.body.extraHazardDelayMinutes) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  // Batch 9: Dynamic Scenario Builder CRUD & Isolated Execution
  listScenarios(_req: Request, res: Response) {
    try {
      const scenarios = ScenarioBuilderService.listScenarios();
      res.json({ success: true, data: scenarios });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  getScenario(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const scenario = ScenarioBuilderService.getScenario(id);
      if (!scenario) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Scenario ${id} not found` } });
        return;
      }
      res.json({ success: true, data: scenario });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  createScenario(req: Request, res: Response) {
    try {
      const created = ScenarioBuilderService.createScenario(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      if (err instanceof ScenarioValidationError) {
        res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
        return;
      }
      handleOpsError(res, err);
    }
  },

  updateScenario(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = ScenarioBuilderService.updateScenario(id, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Scenario ${id} not found` } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      if (err instanceof ScenarioValidationError) {
        res.status(400).json({ success: false, error: { code: err.code, message: err.message } });
        return;
      }
      handleOpsError(res, err);
    }
  },

  duplicateScenario(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const copy = ScenarioBuilderService.duplicateScenario(id, req.body?.name);
      if (!copy) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Scenario ${id} not found` } });
        return;
      }
      res.status(201).json({ success: true, data: copy });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  deleteScenario(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = ScenarioBuilderService.deleteScenario(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Scenario ${id} not found` } });
        return;
      }
      res.json({ success: true, data: { deleted: true, id } });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  executeScenario(req: Request, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const outcome = ScenarioBuilderService.executeScenario(id);
      if (!outcome) {
        res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Scenario ${id} not found` } });
        return;
      }
      res.json({ success: true, data: outcome });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  // Batch 9: Structured Explainable Copilot + Confirmation Gate + Multi-Objective Plan Comparison
  structuredCopilotQuery(req: Request, res: Response) {
    try {
      const query = String(req.body?.query || "").trim();
      if (!query) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "query is required" } });
        return;
      }
      const missionId = req.body?.missionId ? String(req.body.missionId) : undefined;
      const result = missionReasoningService.queryStructuredCopilot(query, missionId);
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  confirmCopilotAction(req: Request, res: Response) {
    try {
      const missionId = String(req.body?.missionId || "").trim();
      const actionType = req.body?.actionType;
      if (!missionId || !actionType) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "missionId and actionType are required" },
        });
        return;
      }
      const result = missionReasoningService.confirmCopilotAction({
        missionId,
        actionType,
        payload: req.body?.payload,
        confirmed: req.body?.confirmed,
        userRole: req.body?.userRole,
      });
      res.status(result.statusCode).json(result.body);
    } catch (err) {
      handleOpsError(res, err);
    }
  },

  comparePlanningAlternatives(req: Request, res: Response) {
    try {
      const result = MissionAnalyticsService.comparePlanningAlternatives({
        missionId: req.body?.missionId,
        maxDurationMinutes: req.body?.maxDurationMinutes !== undefined ? Number(req.body.maxDurationMinutes) : undefined,
        returnRequired: req.body?.returnRequired !== undefined ? Boolean(req.body.returnRequired) : undefined,
        maxAllowedSlopeDeg: req.body?.maxAllowedSlopeDeg !== undefined ? Number(req.body.maxAllowedSlopeDeg) : undefined,
        targetIds: Array.isArray(req.body?.targetIds) ? req.body.targetIds : undefined,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      handleOpsError(res, err);
    }
  },
};
