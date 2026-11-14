import {
  AgentCapability,
  AgentStatus,
  AgentTask,
  PlanetaryAgent,
  RoverAgent,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "../agents/agentTypes.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentTaskPlanner } from "../agents/agentTaskPlanner.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { auditChainService } from "../security/auditChainService.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { MissionReplayEngine } from "../replay/missionReplayEngine.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { MarsCoordinate, ScienceObjectiveId } from "../../types/index.js";

export type TaskTransitionAction = "START" | "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL" | "FAIL";

export class OperationsValidationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const DEFAULT_BASE_COORD: MarsCoordinate = { latitude: 18.4447, longitude: 77.4508 };

const TASK_TYPE_DEFAULT_CAPABILITIES: Partial<Record<TaskType, AgentCapability[]>> = {
  COLLECT_SCIENCE: ["SPECTROMETER"],
  SURVEY_TERRAIN: ["TERRAIN_RECON"],
  RELAY_SIGNAL: ["COMM_RELAY"],
  EMERGENCY_SUPPORT: ["EMERGENCY_SUPPORT"],
};

const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskTransitionAction[]> = {
  PENDING: ["START", "CANCEL"],
  BLOCKED: ["START", "CANCEL"],
  IN_PROGRESS: ["PAUSE", "COMPLETE", "CANCEL", "FAIL"],
  PAUSED: ["RESUME", "COMPLETE", "CANCEL", "FAIL"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

const ACTION_TO_STATUS: Record<TaskTransitionAction, TaskStatus> = {
  START: "IN_PROGRESS",
  PAUSE: "PAUSED",
  RESUME: "IN_PROGRESS",
  COMPLETE: "COMPLETED",
  CANCEL: "CANCELLED",
  FAIL: "FAILED",
};

export class TaskLifecycleService {
  private static tasks: Map<string, AgentTask> = new Map();
  private static seeded = false;

  private static ensureSeeded(): void {
    if (this.seeded) return;
    for (const agent of AgentRegistry.getAllAgents()) {
      if (agent.currentTask) {
        const seededTask: AgentTask = {
          ...agent.currentTask,
          missionId: agent.currentTask.missionId || "MARSWALK-001",
          assignedAt: agent.currentTask.assignedAt || agent.lastUpdated,
        };
        this.tasks.set(seededTask.id, seededTask);
        agent.currentTask = seededTask;
      }
    }
    this.seeded = true;
  }

  public static reset(): void {
    this.tasks.clear();
    this.seeded = false;
    this.ensureSeeded();
  }

  public static syncDigitalTwin(missionId: string = "MARSWALK-001"): void {
    try {
      const canonical = MissionStateCoordinator.synthesizeCanonicalState(missionId);
      MissionStateCoordinator.updateDomain("fleet", canonical.fleet, "SYSTEM_SYNC", missionId);
      MissionReplayEngine.stateManager.hydrateFromCanonicalState(canonical);
    } catch {
      // Non-fatal in isolated unit tests
    }
  }

  public static getAllTasks(missionId?: string): AgentTask[] {
    this.ensureSeeded();
    const list = Array.from(this.tasks.values());
    if (!missionId) return list;
    return list.filter((t) => (t.missionId || "MARSWALK-001") === missionId);
  }

  public static getTaskById(taskId: string): AgentTask | undefined {
    this.ensureSeeded();
    return this.tasks.get(taskId);
  }

  public static agentSupportsCapabilities(
    agent: PlanetaryAgent,
    requiredCapabilities: AgentCapability[]
  ): { ok: boolean; missing: AgentCapability[] } {
    const missing: AgentCapability[] = [];
    for (const cap of requiredCapabilities) {
      const hasListed = agent.capabilities.includes(cap);
      let hasStructured = false;
      if (agent.structuredCapabilities) {
        if (cap === "SAMPLE_DRILL") hasStructured = agent.structuredCapabilities.hasDrill;
        else if (cap === "SPECTROMETER") hasStructured = agent.structuredCapabilities.hasSpectrometer;
        else if (cap === "TERRAIN_RECON") hasStructured = agent.structuredCapabilities.hasLidar;
        else if (cap === "COMM_RELAY") hasStructured = agent.structuredCapabilities.communicationRelay.isRelay;
      }
      if (!hasListed && !hasStructured) {
        missing.push(cap);
      }
    }
    return { ok: missing.length === 0, missing };
  }

  private static validateDependencies(task: AgentTask): void {
    if (!task.dependencies || task.dependencies.length === 0) return;
    const unmet: string[] = [];
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== "COMPLETED") {
        unmet.push(`${depId} (${dep ? dep.status : "MISSING"})`);
      }
    }
    if (unmet.length > 0) {
      throw new OperationsValidationError(
        "UNMET_TASK_DEPENDENCIES",
        `Cannot start task "${task.name}" until dependencies are COMPLETED: ${unmet.join(", ")}`,
        400,
        { unmetDependencies: unmet }
      );
    }
  }

  public static createAndAssignTask(input: {
    agentId: string;
    missionId?: string;
    name: string;
    taskType: TaskType;
    priority: TaskPriority;
    targetCoordinate: MarsCoordinate;
    targetDescription?: string;
    requiredCapabilities?: AgentCapability[];
    dependencies?: string[];
    scienceObjective?: ScienceObjectiveId;
    requiredCommunication?: boolean;
    autoStart?: boolean;
  }): { task: AgentTask; agent: PlanetaryAgent; feasibility: ReturnType<typeof AgentTaskPlanner.evaluateTaskFeasibility> } {
    this.ensureSeeded();

    const agent = AgentRegistry.getAgentById(input.agentId);
    if (!agent) {
      throw new OperationsValidationError("NOT_FOUND", `Agent '${input.agentId}' not found`, 404);
    }

    if (agent.status === "UNAVAILABLE" || agent.status === "EMERGENCY" || agent.status === "COMMS_LOST") {
      throw new OperationsValidationError(
        "AGENT_UNAVAILABLE",
        `Agent ${agent.callsign} is currently ${agent.status} and cannot accept new tasks`,
        409,
        { agentStatus: agent.status }
      );
    }

    const requiredCaps =
      input.requiredCapabilities && input.requiredCapabilities.length > 0
        ? input.requiredCapabilities
        : TASK_TYPE_DEFAULT_CAPABILITIES[input.taskType] || [];

    if (requiredCaps.length > 0) {
      const capCheck = this.agentSupportsCapabilities(agent, requiredCaps);
      if (!capCheck.ok) {
        throw new OperationsValidationError(
          "CAPABILITY_MISMATCH",
          `Agent ${agent.callsign} lacks required capabilities for ${input.taskType}: ${capCheck.missing.join(", ")}`,
          400,
          { missingCapabilities: capCheck.missing, agentCapabilities: agent.capabilities }
        );
      }
    }

    const feasibility = AgentTaskPlanner.evaluateTaskFeasibility(agent, input.targetCoordinate, DEFAULT_BASE_COORD);
    if (!feasibility.feasible) {
      throw new OperationsValidationError(
        "TASK_INFEASIBLE",
        `Task rejected by S1-S8 safety & feasibility planner: ${feasibility.reasons.join("; ")}`,
        400,
        { feasibility }
      );
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const missionId = input.missionId || "MARSWALK-001";
    const now = new Date().toISOString();

    const task: AgentTask = {
      id: taskId,
      missionId,
      agentId: agent.id,
      taskType: input.taskType,
      priority: input.priority,
      name: input.name,
      target: {
        coordinate: input.targetCoordinate,
        description: input.targetDescription,
      },
      estimatedDurationMin: feasibility.estimatedDurationMin,
      requiredBatteryPercent: feasibility.totalBatteryRequiredPercent,
      requiredCommunication: input.requiredCommunication ?? true,
      requiredCapabilities: requiredCaps,
      dependencies: input.dependencies,
      scienceObjective: input.scienceObjective,
      riskLevel: feasibility.riskLevel,
      status: "PENDING",
      assignedAt: now,
    };

    if (input.autoStart) {
      this.validateDependencies(task);
      task.status = "IN_PROGRESS";
      task.startedAt = now;
      agent.status = "EXECUTING";
      agent.telemetry.speedKph = agent.type === "ROVER" ? (agent as RoverAgent).speedKph || 3.0 : 2.8;
    } else if (agent.status === "IDLE") {
      agent.status = "PLANNING";
    }

    this.tasks.set(task.id, task);
    agent.currentTask = task;
    AgentRegistry.updateAgent(agent);

    MissionEventStore.appendEvent({
      missionId,
      eventType: "AGENT_ASSIGNED",
      actor: agent.callsign,
      payload: {
        taskId: task.id,
        taskName: task.name,
        taskType: task.taskType,
        status: task.status,
        coordinate: task.target.coordinate,
      },
      provenance: ProvenanceService.createDerivedProvenance(
        "Operations Task Lifecycle",
        ["AgentTaskPlanner"],
        "Task Assignment"
      ),
    });

    auditChainService.appendEvent({
      userId: "MISSION_COMMAND",
      role: "MISSION_COMMAND",
      action: "MODIFY_PRIORITIES",
      missionPlanId: missionId,
      details: { assignTask: true, agentId: agent.id, taskId: task.id, taskType: task.taskType, status: task.status },
    });

    this.syncDigitalTwin(missionId);
    return { task, agent, feasibility };
  }

  public static transitionTask(
    taskId: string,
    action: TaskTransitionAction,
    reason?: string
  ): { task: AgentTask; agent?: PlanetaryAgent } {
    this.ensureSeeded();
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new OperationsValidationError("NOT_FOUND", `Task '${taskId}' not found`, 404);
    }

    const allowed = VALID_TASK_TRANSITIONS[task.status] || [];
    if (!allowed.includes(action)) {
      throw new OperationsValidationError(
        "INVALID_STATE_TRANSITION",
        `Cannot ${action} task '${task.name}' while in status '${task.status}'. Allowed: ${allowed.join(", ") || "none (terminal)"}`,
        400,
        { currentStatus: task.status, attemptedAction: action, allowedActions: allowed }
      );
    }

    const agent = AgentRegistry.getAgentById(task.agentId);
    if (action === "START" || action === "RESUME") {
      this.validateDependencies(task);
      if (agent && (agent.status === "UNAVAILABLE" || agent.status === "EMERGENCY" || agent.status === "COMMS_LOST")) {
        throw new OperationsValidationError(
          "AGENT_UNAVAILABLE",
          `Cannot ${action.toLowerCase()} task because ${agent.callsign} is ${agent.status}`,
          409,
          { agentStatus: agent.status }
        );
      }
    }

    const now = new Date().toISOString();
    const nextStatus = ACTION_TO_STATUS[action];
    task.status = nextStatus;
    if (reason) task.statusReason = reason;

    if (action === "START" && !task.startedAt) task.startedAt = now;
    if (action === "PAUSE") task.pausedAt = now;
    if (action === "COMPLETE" || action === "CANCEL" || action === "FAIL") {
      task.completedAt = now;
      if (action === "FAIL" && reason) task.failureReason = reason;
      if (action === "COMPLETE") task.outcome = reason || "Completed nominal operational objectives";
    }

    if (agent) {
      if (nextStatus === "IN_PROGRESS") {
        agent.status = "EXECUTING";
        agent.telemetry.speedKph = agent.type === "ROVER" ? (agent as RoverAgent).speedKph || 3.0 : 2.8;
        agent.currentTask = task;
      } else if (nextStatus === "PAUSED") {
        agent.status = "PAUSED";
        agent.telemetry.speedKph = 0;
        agent.currentTask = task;
      } else {
        agent.status = "IDLE";
        agent.telemetry.speedKph = 0;
        if (agent.currentTask?.id === task.id) {
          agent.currentTask = undefined;
        }
      }
      AgentRegistry.updateAgent(agent);
    }

    const missionId = task.missionId || "MARSWALK-001";
    MissionEventStore.appendEvent({
      missionId,
      eventType: action === "COMPLETE" ? "SCIENCE_TARGET_COMPLETED" : "COMMAND_EXECUTED",
      actor: agent?.callsign || task.agentId,
      payload: { taskId: task.id, action, nextStatus, reason },
      provenance: ProvenanceService.createDerivedProvenance(
        "Operations Task Lifecycle",
        ["TaskStateMachine"],
        `Task ${action}`
      ),
    });

    this.syncDigitalTwin(missionId);
    return { task, agent };
  }

  public static transitionAgentStatus(
    agentId: string,
    nextStatus: AgentStatus,
    reason?: string
  ): { agent: PlanetaryAgent; reassignedTask?: AgentTask; reassignedToAgent?: PlanetaryAgent | null } {
    this.ensureSeeded();
    const agent = AgentRegistry.getAgentById(agentId);
    if (!agent) {
      throw new OperationsValidationError("NOT_FOUND", `Agent '${agentId}' not found`, 404);
    }

    const previousStatus = agent.status;
    agent.status = nextStatus;
    if (nextStatus === "PAUSED" || nextStatus === "IDLE" || nextStatus === "UNAVAILABLE" || nextStatus === "COMPLETE") {
      agent.telemetry.speedKph = 0;
    } else if (nextStatus === "EXECUTING" || nextStatus === "RETURNING") {
      agent.telemetry.speedKph = agent.type === "ROVER" ? (agent as RoverAgent).speedKph || 3.2 : 2.8;
    }

    let reassignedTask: AgentTask | undefined;
    let reassignedToAgent: PlanetaryAgent | null | undefined;

    // Automatic reassignment if agent becomes UNAVAILABLE while holding an active task
    if (nextStatus === "UNAVAILABLE" && agent.currentTask && ["PENDING", "IN_PROGRESS", "PAUSED"].includes(agent.currentTask.status)) {
      const task = this.tasks.get(agent.currentTask.id) || agent.currentTask;
      const requiredCaps = task.requiredCapabilities || TASK_TYPE_DEFAULT_CAPABILITIES[task.taskType] || [];
      const candidates = AgentRegistry.getAllAgents().filter((cand) => {
        if (cand.id === agent.id) return false;
        if (cand.type === "ORBITER") return false;
        if (!["IDLE", "PLANNING"].includes(cand.status)) return false;
        if (cand.telemetry.batteryPercent < 25) return false;
        return this.agentSupportsCapabilities(cand, requiredCaps).ok;
      });

      if (candidates.length > 0) {
        const target = candidates[0];
        task.agentId = target.id;
        task.statusReason = reason || `Auto-reassigned from ${agent.callsign} (${previousStatus} -> UNAVAILABLE)`;
        target.currentTask = task;
        target.status = task.status === "IN_PROGRESS" ? "EXECUTING" : "PLANNING";
        AgentRegistry.updateAgent(target);
        agent.currentTask = undefined;
        this.tasks.set(task.id, task);
        reassignedTask = task;
        reassignedToAgent = target;
      } else {
        task.status = "BLOCKED";
        task.statusReason = reason || `Blocked: ${agent.callsign} UNAVAILABLE and no capable available replacement found`;
        agent.currentTask = undefined;
        this.tasks.set(task.id, task);
        reassignedTask = task;
        reassignedToAgent = null;
      }
    }

    AgentRegistry.updateAgent(agent);

    const missionId = agent.currentTask?.missionId || "MARSWALK-001";
    MissionEventStore.appendEvent({
      missionId,
      eventType: "COMMAND_EXECUTED",
      actor: agent.callsign,
      payload: {
        previousStatus,
        nextStatus,
        reason,
        autoReassignedTaskId: reassignedTask?.id,
        reassignedTo: reassignedToAgent?.callsign || null,
      },
      provenance: ProvenanceService.createDerivedProvenance(
        "Operations Agent State Machine",
        ["AgentRegistry"],
        "Agent Status Transition"
      ),
    });

    this.syncDigitalTwin(missionId);
    return { agent, reassignedTask, reassignedToAgent };
  }
}
