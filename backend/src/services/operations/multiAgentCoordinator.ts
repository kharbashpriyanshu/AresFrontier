import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { ScienceObjectiveId } from "../../types/index.js";
import { AgentTask, PlanetaryAgent } from "../agents/agentTypes.js";
import { AgentTaskPlanner } from "../agents/agentTaskPlanner.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";

export type ScienceQueueStatus = "QUEUED" | "ASSIGNED" | "EN_ROUTE" | "OBSERVING" | "COMPLETED";

export interface ScienceQueueItem {
  id: string;
  targetName: string;
  coordinate: import("../../types/index.js").MarsCoordinate;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  scienceObjective: ScienceObjectiveId;
  recommendedAgentCallsign: string;
  supportingAgentCallsign?: string;
  requiredInstrument: string;
  status: ScienceQueueStatus;
  supportingEvidence: string[];
  assignedAt?: string;
  completedAt?: string;
  sampleReturnPayloadId?: string;
  provenance: import("../../types/index.js").DataProvenance;
}

export class MultiAgentCoordinator {
  private static scienceQueue: ScienceQueueItem[] = [
    {
      id: "sci-queue-01",
      targetName: "Jezero Delta Front Sedimentary Scarp",
      coordinate: { latitude: 18.4485, longitude: 77.402 },
      priority: "CRITICAL",
      scienceObjective: "ANCIENT_WATER_ACTIVITY",
      recommendedAgentCallsign: "ROVER-02 SCIENCE",
      supportingAgentCallsign: "ASTRONAUT-01",
      requiredInstrument: "Deep UV Raman + Abrasion Core Drill",
      status: "ASSIGNED",
      supportingEvidence: [
        "MGS MOLA MEGDR Lacustrine Deltaic Bottomset Altimetry",
        "MRO HiRISE Stereo DTM 0.25m/px Cross-Bedding Layers",
        "2001 Mars Odyssey THEMIS Daytime Thermal Regolith Bedrock",
        "Mars 2020 Perseverance SuperCam In-Situ Spectroscopy",
      ],
      assignedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "SUPERCAM-PIXL", 100),
    },
    {
      id: "sci-queue-02",
      targetName: "Kodiak Butte Isolated Delta Remnant",
      coordinate: { latitude: 18.425, longitude: 77.415 },
      priority: "HIGH",
      scienceObjective: "SEDIMENTARY_HISTORY",
      recommendedAgentCallsign: "ROVER-01 SCOUT",
      supportingAgentCallsign: "ROVER-02 SCIENCE",
      requiredInstrument: "High-Resolution Laser Profiler + Hazcam",
      status: "EN_ROUTE",
      supportingEvidence: [
        "MRO HiRISE Sub-Meter Foreset Dip Strata",
        "MGS MOLA Regional Elevation Differential (-2540m areoid)",
      ],
      assignedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      provenance: ProvenanceService.createHiriseProvenance("PSP_001415_1985"),
    },
    {
      id: "sci-queue-03",
      targetName: "South Séítah Olivine Cumulate Ridge",
      coordinate: { latitude: 18.432, longitude: 77.448 },
      priority: "MEDIUM",
      scienceObjective: "MINERALOGICAL_DIVERSITY",
      recommendedAgentCallsign: "ROVER-02 SCIENCE",
      requiredInstrument: "X-Ray Fluorescence Spectrometer (PIXL)",
      status: "QUEUED",
      supportingEvidence: [
        "CRISM Spectral Band Absorption at 1.0 & 2.0 Microns",
        "Mars 2020 Abraded Patch In-Situ Ground Truth",
      ],
      provenance: ProvenanceService.createRoverProvenance("Mars 2020 (Perseverance)", "PIXL-ABRASION", 124),
    },
  ];

  public static getScienceQueue(): ScienceQueueItem[] {
    return this.scienceQueue;
  }

  public static updateQueueItemStatus(
    id: string,
    status: ScienceQueueStatus,
    agentCallsign?: string
  ): ScienceQueueItem {
    const item = this.scienceQueue.find((q) => q.id === id);
    if (!item) {
      throw new Error(`Science queue item ${id} not found`);
    }

    item.status = status;
    if (agentCallsign) {
      item.recommendedAgentCallsign = agentCallsign;
    }
    if (status === "COMPLETED") {
      item.completedAt = new Date().toISOString();
      item.sampleReturnPayloadId = `SAMPLE-${Date.now().toString().slice(-4)}`;
    }

    AgentStateStore.recordEvent({
      agentId: item.recommendedAgentCallsign,
      eventType: status === "COMPLETED" ? "SCIENCE_OBSERVATION_RECORDED" : "TASK_ASSIGNED",
      severity: "INFO",
      message: `Science Queue: ${item.targetName} transitioned to ${status} (${item.recommendedAgentCallsign})`,
      details: { queueId: item.id, status, objective: item.scienceObjective },
    });

    return item;
  }

  private static activeTasks: Map<string, AgentTask> = new Map();

  public static getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Dynamically allocates a task to the most suitable fleet agent considering
   * structured capabilities, distance, battery SoC, communication availability, and workload.
   */
  public static allocateTask(
    task: AgentTask,
    options: { requireHumanApproval?: boolean } = {}
  ): {
    assignedAgent: PlanetaryAgent | null;
    success: boolean;
    ranking: Array<{ agentId: string; callsign: string; suitabilityScore: number; eligible: boolean; rejectionReasons?: string[] }>;
    requiresHumanCommandApproval: boolean;
  } {
    const allAgents = AgentRegistry.getAllAgents();
    const candidateRankings: Array<{
      agentId: string;
      callsign: string;
      suitabilityScore: number;
      eligible: boolean;
      rejectionReasons?: string[];
    }> = [];

    const activeTaskList = Array.from(this.activeTasks.values());

    for (const agent of allAgents) {
      if (agent.type === "MISSION_CONTROL") continue;

      const eligibility = AgentTaskPlanner.checkTaskEligibility(agent, task, activeTaskList);
      if (!eligibility.eligible) {
        candidateRankings.push({
          agentId: agent.id,
          callsign: agent.callsign,
          suitabilityScore: 0,
          eligible: false,
          rejectionReasons: eligibility.reasons,
        });
        continue;
      }

      // Compute suitability score:
      // 1. Distance factor (0-30 pts): closer is better
      const distKm = calculateMarsDistanceKm(agent.position, task.target.coordinate);
      const distScore = Math.max(0, 30 - distKm * 4);

      // 2. Battery SoC factor (0-30 pts): higher remaining reserve is safer
      const batteryScore = (agent.telemetry.batteryPercent / 100) * 30;

      // 3. Capability precision match (0-30 pts)
      let capabilityScore = 15;
      const caps = agent.structuredCapabilities;
      if (caps) {
        if (task.taskType === "COLLECT_SCIENCE" && caps.hasDrill) capabilityScore = 30;
        else if (task.taskType === "SURVEY_TERRAIN" && caps.hasLidar) capabilityScore = 30;
        else if (task.taskType === "RELAY_SIGNAL" && caps.communicationRelay.isRelay) capabilityScore = 30;
        else if (task.taskType === "EMERGENCY_SUPPORT" && agent.type === "ROVER" && caps.mobility.speedKph >= 4.0) capabilityScore = 30;
      }

      // 4. Communication link factor (0-10 pts)
      const commScore = agent.telemetry.lineOfSightToRelay ? 10 : 3;

      const suitabilityScore = Math.round(distScore + batteryScore + capabilityScore + commScore);

      candidateRankings.push({
        agentId: agent.id,
        callsign: agent.callsign,
        suitabilityScore,
        eligible: true,
      });
    }

    // Sort descending by suitabilityScore
    candidateRankings.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    const bestCandidate = candidateRankings.find((c) => c.eligible);
    const requiresHumanApproval =
      options.requireHumanApproval ?? (task.priority === "CRITICAL" || task.riskLevel === "CRITICAL");

    if (!bestCandidate) {
      return {
        assignedAgent: null,
        success: false,
        ranking: candidateRankings,
        requiresHumanCommandApproval: requiresHumanApproval,
      };
    }

    const assignedAgent = AgentRegistry.getAgentById(bestCandidate.agentId)!;
    task.agentId = assignedAgent.id;
    task.status = "IN_PROGRESS";
    task.startedAt = new Date().toISOString();

    this.activeTasks.set(task.id, task);
    assignedAgent.currentTask = task;
    assignedAgent.status = "EXECUTING";
    AgentRegistry.updateAgent(assignedAgent);

    AgentStateStore.recordEvent({
      agentId: assignedAgent.callsign,
      eventType: "TASK_ASSIGNED",
      severity: task.priority === "CRITICAL" ? "WARNING" : "INFO",
      message: `Dynamic Task Allocation: '${task.name}' assigned to ${assignedAgent.callsign} (Suitability: ${bestCandidate.suitabilityScore}/100)`,
      details: { taskId: task.id, priority: task.priority, riskLevel: task.riskLevel },
    });

    return {
      assignedAgent,
      success: true,
      ranking: candidateRankings,
      requiresHumanCommandApproval: requiresHumanApproval,
    };
  }

  /**
   * Reassigns an active task to an alternate agent due to operational priorities or safety constraints.
   */
  public static reassignTask(
    taskId: string,
    newAgentId: string,
    reason: string
  ): { success: boolean; task: AgentTask | null; message: string } {
    let task = this.activeTasks.get(taskId);
    if (!task) {
      const agentWithTask = AgentRegistry.getAllAgents().find((a) => a.currentTask?.id === taskId);
      if (agentWithTask?.currentTask) {
        task = agentWithTask.currentTask;
        this.activeTasks.set(task.id, task);
      }
    }

    if (!task) {
      return { success: false, task: null, message: `Task '${taskId}' not found in active tasks` };
    }

    const previousAgent = AgentRegistry.getAgentById(task.agentId);
    const newAgent = AgentRegistry.getAgentById(newAgentId);
    if (!newAgent) {
      return { success: false, task, message: `New agent '${newAgentId}' not found in registry` };
    }

    const eligibility = AgentTaskPlanner.checkTaskEligibility(newAgent, task, Array.from(this.activeTasks.values()));
    if (!eligibility.eligible) {
      return {
        success: false,
        task,
        message: `Agent ${newAgent.callsign} cannot safely perform task: ${eligibility.reasons.join(", ")}`,
      };
    }

    // Unassign from previous agent
    if (previousAgent && previousAgent.currentTask?.id === taskId) {
      previousAgent.currentTask = undefined;
      previousAgent.status = "IDLE";
      AgentRegistry.updateAgent(previousAgent);
    }

    // Assign to new agent
    task.agentId = newAgent.id;
    newAgent.currentTask = task;
    newAgent.status = "EXECUTING";
    AgentRegistry.updateAgent(newAgent);
    this.activeTasks.set(task.id, task);

    AgentStateStore.recordEvent({
      agentId: newAgent.callsign,
      eventType: "TASK_ASSIGNED",
      severity: "WARNING",
      message: `Task Reassignment: '${task.name}' transferred from ${previousAgent?.callsign || "UNASSIGNED"} to ${newAgent.callsign}. Reason: ${reason}`,
      details: { taskId: task.id, previousAgentId: previousAgent?.id, newAgentId: newAgent.id, reason },
    });

    return {
      success: true,
      task,
      message: `Task successfully transferred to ${newAgent.callsign}`,
    };
  }

  /**
   * Handles agent failure (e.g. wheel motor lock, comms loss, low battery critical cutoff),
   * updating agent status and automatically replanning or blocking affected tasks.
   */
  public static handleAgentFailure(
    failedAgentId: string,
    failureReason: string
  ): {
    affectedTasks: AgentTask[];
    reassignedTasks: AgentTask[];
    blockedTasks: AgentTask[];
  } {
    const failedAgent = AgentRegistry.getAgentById(failedAgentId);
    if (failedAgent) {
      failedAgent.status = failureReason.toLowerCase().includes("comm") ? "COMMS_LOST" : "EMERGENCY";
      AgentRegistry.updateAgent(failedAgent);
    }

    const affectedTasks: AgentTask[] = [];
    const reassignedTasks: AgentTask[] = [];
    const blockedTasks: AgentTask[] = [];

    for (const task of this.activeTasks.values()) {
      if (task.agentId === failedAgentId && task.status !== "COMPLETED") {
        affectedTasks.push(task);
        task.failureReason = failureReason;

        // Attempt automated failover to an eligible backup agent
        const allocation = this.allocateTask(task, { requireHumanApproval: false });
        if (allocation.success && allocation.assignedAgent && allocation.assignedAgent.id !== failedAgentId) {
          reassignedTasks.push(task);
        } else {
          task.status = "BLOCKED";
          blockedTasks.push(task);
        }
      }
    }

    AgentStateStore.recordEvent({
      agentId: failedAgent?.callsign || failedAgentId,
      eventType: "EMERGENCY_DECLARED",
      severity: "CRITICAL",
      message: `AGENT FAILURE DETECTED on ${failedAgent?.callsign || failedAgentId}: ${failureReason}. ${reassignedTasks.length} tasks failover-reassigned, ${blockedTasks.length} tasks blocked.`,
      details: {
        failedAgentId,
        failureReason,
        reassignedTaskIds: reassignedTasks.map((t) => t.id),
        blockedTaskIds: blockedTasks.map((t) => t.id),
      },
    });

    return {
      affectedTasks,
      reassignedTasks,
      blockedTasks,
    };
  }

  /**
   * Assigns a collaborative task requiring multi-agent synchrony (e.g. Scout + Science or Astronaut + Rover).
   */
  public static assignCollaborativeTask(
    primaryTask: AgentTask,
    supportingAgentIds: string[]
  ): {
    success: boolean;
    primaryTask: AgentTask;
    supportingAgents: PlanetaryAgent[];
    message: string;
  } {
    const primaryAgent = AgentRegistry.getAgentById(primaryTask.agentId);
    if (!primaryAgent) {
      return {
        success: false,
        primaryTask,
        supportingAgents: [],
        message: `Primary agent '${primaryTask.agentId}' not found`,
      };
    }

    const supportingAgents: PlanetaryAgent[] = [];
    for (const suppId of supportingAgentIds) {
      const supp = AgentRegistry.getAgentById(suppId);
      if (supp && supp.id !== primaryAgent.id) {
        supportingAgents.push(supp);
      }
    }

    primaryTask.collaboratingAgentIds = supportingAgents.map((s) => s.id);
    primaryTask.status = "IN_PROGRESS";
    this.activeTasks.set(primaryTask.id, primaryTask);

    primaryAgent.currentTask = primaryTask;
    primaryAgent.status = "EXECUTING";
    AgentRegistry.updateAgent(primaryAgent);

    supportingAgents.forEach((supp) => {
      AgentStateStore.recordEvent({
        agentId: supp.callsign,
        eventType: "TASK_ASSIGNED",
        severity: "INFO",
        message: `Collaborative Support: ${supp.callsign} assigned to support ${primaryAgent.callsign} on task '${primaryTask.name}'`,
        details: { primaryTaskId: primaryTask.id, primaryAgentId: primaryAgent.id },
      });
    });

    return {
      success: true,
      primaryTask,
      supportingAgents,
      message: `Collaborative assignment confirmed: ${primaryAgent.callsign} supported by ${supportingAgents.map((s) => s.callsign).join(", ")}`,
    };
  }
}
