import { AgentTask, PlanetaryAgent, RoverAgent, TaskPriority, TaskType } from "./agentTypes.js";
import { MarsCoordinate } from "../../types/index.js";
import { calculateMarsDistanceKm } from "../../utils/marsCoordinates.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { hazardEngine } from "../hazard/hazardEngine.js";

export interface TaskFeasibilityResult {
  feasible: boolean;
  estimatedDurationMin: number;
  energyRequiredWh: number;
  batteryRequiredPercent: number;
  returnEnergyWh: number;
  returnBatteryPercent: number;
  totalBatteryRequiredPercent: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  reasons: string[];
  safeReturnFeasible: boolean;
}

export class AgentTaskPlanner {
  /**
   * Evaluates task feasibility for a specific planetary agent before assignment.
   */
  public static evaluateTaskFeasibility(
    agent: PlanetaryAgent,
    targetCoord: MarsCoordinate,
    baseRecoveryCoord: MarsCoordinate
  ): TaskFeasibilityResult {
    const reasons: string[] = [];
    const distanceToTargetKm = calculateMarsDistanceKm(agent.position, targetCoord);
    const distanceReturnKm = calculateMarsDistanceKm(targetCoord, baseRecoveryCoord);
    const totalTraverseKm = distanceToTargetKm + distanceReturnKm;

    // Default rates based on agent type
    const isRover = agent.type === "ROVER";
    const rover = isRover ? (agent as RoverAgent) : null;
    const baseSpeed = rover ? rover.speedKph : 3.0;
    const baseEnergyRate = agent.telemetry.energyConsumptionRateWhPerKm || 100;

    // Sample terrain between current position and target
    const terrain = terrainEngine.assessPoint(targetCoord);
    const slopeMultiplier = 1 + Math.max(0, terrain.averageSlopeDeg / 15);
    const roughnessMultiplier = 1 + (terrain.roughnessIndex || 0.1) * 0.5;
    const compoundEnergyMultiplier = slopeMultiplier * roughnessMultiplier;

    // Energy modeling
    const taskEnergyWh = distanceToTargetKm * baseEnergyRate * compoundEnergyMultiplier;
    const returnEnergyWh = distanceReturnKm * baseEnergyRate * slopeMultiplier;
    const totalEnergyWh = taskEnergyWh + returnEnergyWh;

    const capacityWh = rover ? rover.batteryCapacityWh : 2400;
    const currentWh = rover ? rover.currentBatteryWh : (capacityWh * agent.telemetry.batteryPercent) / 100;

    const batteryRequiredPercent = (taskEnergyWh / capacityWh) * 100;
    const returnBatteryPercent = (returnEnergyWh / capacityWh) * 100;
    const totalBatteryRequiredPercent = (totalEnergyWh / capacityWh) * 100;

    const remainingAfterMissionPercent = ((currentWh - totalEnergyWh) / capacityWh) * 100;

    // Check hazards near target
    const hazardAssessment = hazardEngine.assessPointHazards(targetCoord);
    const hazards = hazardAssessment.hazards;
    let riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";

    if (hazards.length > 0) {
      const highestSev = hazards[0].severity;
      if (highestSev === "CRITICAL") riskLevel = "CRITICAL";
      else if (highestSev === "HIGH") riskLevel = "HIGH";
      else if (highestSev === "MODERATE") riskLevel = "MODERATE";
    }

    if (terrain.maxSlopeDeg > 18) {
      riskLevel = "CRITICAL";
      reasons.push(`Target terrain slope (${terrain.maxSlopeDeg.toFixed(1)}°) exceeds safe locomotion limit`);
    }

    // Safety checks
    let safeReturnFeasible = true;
    if (remainingAfterMissionPercent < 20) {
      safeReturnFeasible = false;
      reasons.push(
        `Insufficient emergency battery reserve after return (${remainingAfterMissionPercent.toFixed(1)}% < 20% safety margin)`
      );
    }

    if (rover && terrain.maxSlopeDeg > rover.hazardTolerance) {
      reasons.push(
        `Slope gradient (${terrain.maxSlopeDeg.toFixed(1)}°) exceeds ${rover.callsign} tolerance (${rover.hazardTolerance}°)`
      );
    }

    const estimatedDurationMin = Math.round((distanceToTargetKm / baseSpeed) * 60) + 15; // 15 min dwell
    const feasible = safeReturnFeasible && riskLevel !== "CRITICAL";

    return {
      feasible,
      estimatedDurationMin,
      energyRequiredWh: Math.round(taskEnergyWh),
      batteryRequiredPercent: Math.round(batteryRequiredPercent),
      returnEnergyWh: Math.round(returnEnergyWh),
      returnBatteryPercent: Math.round(returnBatteryPercent),
      totalBatteryRequiredPercent: Math.round(totalBatteryRequiredPercent),
      riskLevel,
      reasons,
      safeReturnFeasible,
    };
  }

  /**
   * Constructs an authorized AgentTask with validated constraints.
   */
  public static createTask(params: {
    agentId: string;
    taskType: TaskType;
    priority: TaskPriority;
    name: string;
    targetCoordinate: MarsCoordinate;
    targetId?: string;
    description?: string;
    scienceObjective?: import("../../types/index.js").ScienceObjectiveId;
    estimatedDurationMin: number;
    requiredBatteryPercent: number;
    requiredCommunication?: boolean;
    riskLevel?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    dependencies?: string[];
    collaboratingAgentIds?: string[];
    deadlineMinutes?: number;
    workloadUnits?: number;
  }): AgentTask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      agentId: params.agentId,
      taskType: params.taskType,
      priority: params.priority,
      name: params.name,
      target: {
        coordinate: params.targetCoordinate,
        targetId: params.targetId,
        description: params.description,
      },
      estimatedDurationMin: params.estimatedDurationMin,
      requiredBatteryPercent: params.requiredBatteryPercent,
      requiredCommunication: params.requiredCommunication ?? false,
      scienceObjective: params.scienceObjective,
      riskLevel: params.riskLevel || "LOW",
      status: "PENDING",
      dependencies: params.dependencies || [],
      collaboratingAgentIds: params.collaboratingAgentIds || [],
      deadlineMinutes: params.deadlineMinutes,
      workloadUnits: params.workloadUnits || 1,
    };
  }

  /**
   * Verifies capability alignment and dependency satisfaction for a planned task.
   */
  public static checkTaskEligibility(
    agent: PlanetaryAgent,
    task: AgentTask,
    activeTasks: AgentTask[] = []
  ): { eligible: boolean; reasons: string[]; blockedByDependency?: string } {
    const reasons: string[] = [];

    // 1. Dependency satisfaction check
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        const depTask = activeTasks.find((t) => t.id === depId);
        if (!depTask || depTask.status !== "COMPLETED") {
          return {
            eligible: false,
            blockedByDependency: depId,
            reasons: [`Task depends on uncompleted task '${depId}' (status: ${depTask?.status || "UNKNOWN"})`],
          };
        }
      }
    }

    // 2. Structured capabilities verification
    const caps = agent.structuredCapabilities;
    if (caps) {
      if (task.taskType === "COLLECT_SCIENCE") {
        if (task.target.description?.toLowerCase().includes("drill") && !caps.hasDrill) {
          reasons.push(`${agent.callsign} lacks rotary abrasion core drill required for target`);
        }
        if (task.target.description?.toLowerCase().includes("sample") && caps.sampleTubesRemaining <= 0) {
          reasons.push(`${agent.callsign} has exhausted available physical sample tubes`);
        }
      }

      if (task.taskType === "RELAY_SIGNAL" && !caps.communicationRelay.isRelay) {
        reasons.push(`${agent.callsign} lacks high-gain tactical communication relay payload`);
      }

      if (task.taskType === "SURVEY_TERRAIN" && !caps.hasLidar && !caps.scientificInstruments.some((i) => i.toLowerCase().includes("hazcam") || i.toLowerCase().includes("laser"))) {
        reasons.push(`${agent.callsign} lacks terrain laser profiling payload`);
      }

      // Mobility slope ceiling
      const terrain = terrainEngine.assessPoint(task.target.coordinate);
      if (terrain.maxSlopeDeg > caps.mobility.maxSlopeDeg) {
        reasons.push(`Target slope (${terrain.maxSlopeDeg.toFixed(1)}°) exceeds ${agent.callsign} mobility ceiling (${caps.mobility.maxSlopeDeg.toFixed(1)}°)`);
      }
    }

    // 3. Human EVA Specific Constraints
    if (agent.type === "ASTRONAUT") {
      if (task.estimatedDurationMin > 180) {
        reasons.push(`Task duration (${task.estimatedDurationMin} min) breaches nominal EVA safe ceiling of 180 min`);
      }
      const terrain = terrainEngine.assessPoint(task.target.coordinate);
      if (terrain.maxSlopeDeg > 20.0) {
        reasons.push(`Terrain slope (${terrain.maxSlopeDeg.toFixed(1)}°) breaches spacesuit 20° walking ceiling`);
      }
    }

    // 4. Battery / Power Reserve Check
    const currentSoc = agent.telemetry.batteryPercent;
    if (currentSoc - task.requiredBatteryPercent < 20.0) {
      reasons.push(`Task depletes battery to ${(currentSoc - task.requiredBatteryPercent).toFixed(1)}%, breaching 20% emergency reserve (Invariant S1)`);
    }

    // 5. Workload capacity
    if (agent.status === "EMERGENCY" || agent.status === "COMMS_LOST") {
      reasons.push(`${agent.callsign} is in non-operational state: ${agent.status}`);
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }
}
