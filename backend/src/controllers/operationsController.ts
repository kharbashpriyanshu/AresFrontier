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
import { MonteCarloEngine } from "../services/simulation/monteCarloEngine.js";
import { FailureInjectionEngine } from "../services/simulation/failureInjectionEngine.js";
import { MissionValidationEngine } from "../services/validation/missionValidationEngine.js";
import { MissionAnalyticsService } from "../services/intelligence/missionAnalyticsService.js";
import { DecisionLineageService } from "../services/intelligence/decisionLineageService.js";
import { MissionCommandEnvelope } from "../types/index.js";

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
      agent.status = "EXECUTING";
      agent.assignedRouteId = "route-return-base";
    }

    AgentRegistry.updateAgent(agent);
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
  getReplayMissions(req: Request, res: Response) {
    res.json({
      success: true,
      data: [
        {
          missionId: "MARSWALK-001",
          name: "Jezero Delta Front Traverse (Flagship)",
          status: "COMPLETED",
          eventCount: MissionReplayEngine.getEvents().length,
          crewCommander: "Alex Vance",
        },
        {
          missionId: "COMM-BLACKOUT-001",
          name: "Orbital Blackout & Telemetry Buffer Recovery",
          status: "COMPLETED",
          eventCount: 6,
          crewCommander: "Alex Vance",
        },
        {
          missionId: "SECURITY-001",
          name: "Command Intrusion & Anti-Replay Defense",
          status: "COMPLETED",
          eventCount: 4,
          crewCommander: "Alex Vance",
        },
        {
          missionId: "EMERGENCY-001",
          name: "Critical Battery Safety Corridor Preservation",
          status: "COMPLETED",
          eventCount: 5,
          crewCommander: "Alex Vance",
        },
      ],
    });
  },

  getReplayState(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    MissionReplayEngine.loadMission(missionId);
    const state = MissionReplayEngine.getReplayState();
    const summary = MissionReplayEngine.getReplaySummary();
    const events = MissionReplayEngine.getEvents();
    res.json({ success: true, data: { state, summary, events } });
  },

  startReplay(req: Request, res: Response) {
    const rawId = req.params.missionId;
    const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
    const state = MissionReplayEngine.startReplay(missionId);
    res.json({ success: true, data: state });
  },

  stepReplay(req: Request, res: Response) {
    const direction = req.body.direction === "BACKWARD" ? "BACKWARD" : "FORWARD";
    const state = MissionReplayEngine.stepReplay(direction);
    res.json({ success: true, data: state });
  },

  seekReplay(req: Request, res: Response) {
    const target = Number(req.body.target || req.body.timestamp || 0);
    const state = MissionReplayEngine.seekReplay(target);
    res.json({ success: true, data: state });
  },

  resetReplay(req: Request, res: Response) {
    const state = MissionReplayEngine.resetReplay();
    res.json({ success: true, data: state });
  },

  // --- Phase 6 What-If Simulation Engine ---
  cloneMission(req: Request, res: Response) {
    const missionId = req.body.missionId || "MARSWALK-001";
    const clone = SimulationScenarioManager.cloneMissionState(missionId);
    res.json({ success: true, data: { missionId, clonedAt: new Date().toISOString(), state: clone } });
  },

  runWhatIf(req: Request, res: Response) {
    const baselineMissionId = req.body.baselineMissionId || "MARSWALK-001";
    const decisionOverride = req.body.decisionOverride || "IGNORE_HAZARD";
    const forkSimTimeMinutes = Number(req.body.forkSimTimeMinutes || 18);

    const result = WhatIfSimulationEngine.runWhatIfSimulation({
      baselineMissionId,
      decisionOverride,
      forkSimTimeMinutes,
      rationale: req.body.rationale,
    });
    res.json({ success: true, data: result });
  },

  runMonteCarlo(req: Request, res: Response) {
    const runCount = Number(req.body.runCount || 100);
    const seed = Number(req.body.seed || 20261107);
    const result = MonteCarloEngine.runAnalysis({ runCount, seed });
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
    const result = MissionAnalyticsService.getAnalytics(missionId);
    res.json({ success: true, data: result });
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
};
