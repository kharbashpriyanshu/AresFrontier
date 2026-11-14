import { PlanetaryAgent, RoverAgent, AgentStatus } from "./agentTypes.js";
import { AgentStateStore } from "./agentStateStore.js";
import { hazardEngine } from "../hazard/hazardEngine.js";
import { terrainEngine } from "../terrain/terrainEngine.js";
import { MarsCoordinate } from "../../types/index.js";
import { ObservationHazardFusion } from "../hazard/observationHazardFusion.js";
import { ObservationStore } from "../sensors/observationStore.js";

export interface DecisionCycleResult {
  agentId: string;
  previousStatus: AgentStatus;
  currentStatus: AgentStatus;
  decisionAction: "CONTINUE" | "PAUSE" | "REPLAN" | "EMERGENCY_STOP" | "TASK_COMPLETE";
  detectedHazards: string[];
  batteryStatus: "GREEN" | "YELLOW" | "RED" | "CRITICAL";
  communicationStatus: "CONNECTED" | "DEGRADED" | "LOST";
  rationale: string;
  recommendedAction?: string;
}

export class AgentDecisionEngine {
  /**
   * Executes a single deterministic observation & assessment cycle for an autonomous agent.
   */
  public static runCycle(agent: PlanetaryAgent, recoveryLocation: MarsCoordinate): DecisionCycleResult {
    const isRover = agent.type === "ROVER";
    const rover = isRover ? (agent as RoverAgent) : null;
    const previousStatus = agent.status;

    // 1. Observe: current coordinate and planned waypoint
    const currentCoord = agent.position;
    const targetCoord = agent.currentTask?.target.coordinate || currentCoord;

    // 2. Assess Terrain & Hazards
    const terrain = terrainEngine.assessPoint(currentCoord);
    const hazards = hazardEngine.assessPointHazards(currentCoord).hazards;
    const targetHazards = hazardEngine.assessPointHazards(targetCoord).hazards;
    const allDetected = [...hazards, ...targetHazards];
    const hazardNames = allDetected.map((h) => h.name || h.type);

    // 3. Battery Health Assessment
    let batteryStatus: "GREEN" | "YELLOW" | "RED" | "CRITICAL" = "GREEN";
    const batteryPct = agent.telemetry.batteryPercent;

    if (batteryPct < 10) batteryStatus = "CRITICAL";
    else if (batteryPct < 20) batteryStatus = "RED";
    else if (batteryPct < 35) batteryStatus = "YELLOW";

    agent.telemetry.batteryStatus = batteryStatus;

    // 4. Communication Status
    let commsStatus: "CONNECTED" | "DEGRADED" | "LOST" = "CONNECTED";
    if (agent.telemetry.signalStrengthPercent < 15) commsStatus = "LOST";
    else if (agent.telemetry.signalStrengthPercent < 50 || !agent.telemetry.lineOfSightToRelay) commsStatus = "DEGRADED";

    // 5. Decision Rules
    let decisionAction: "CONTINUE" | "PAUSE" | "REPLAN" | "EMERGENCY_STOP" | "TASK_COMPLETE" = "CONTINUE";
    let newStatus = agent.status;
    let rationale = "Telemetry normal. Traversal continues within authorized flight corridor.";
    let recommendedAction: string | undefined = undefined;

    // Rule A: Critical battery trigger
    if (batteryStatus === "CRITICAL") {
      decisionAction = "EMERGENCY_STOP";
      newStatus = "EMERGENCY";
      rationale = `Battery critical (${batteryPct}%). Locomotion suspended immediately to protect electronics.`;
      recommendedAction = "Deploy stationary solar array or request emergency UTV recharge.";
    }
    // Rule B: Hazard tolerance exceeded via Sensor-Observation Hazard Fusion
    else if (rover) {
      const recentObs = ObservationStore.getObservationsForAgent(agent.id, 5);
      const fusedHazard = ObservationHazardFusion.evaluateHazardSync(currentCoord, recentObs, rover.hazardTolerance);

      if (fusedHazard.requiresReplan || allDetected.some((h) => h.severity === "CRITICAL" || h.severity === "HIGH")) {
        decisionAction = "PAUSE";
        newStatus = "PAUSED";
        const severeHazard = allDetected.find((h) => h.severity === "CRITICAL" || h.severity === "HIGH");
        const reasonStr = severeHazard
          ? `${severeHazard.name || severeHazard.type} (${severeHazard.severity})`
          : `${fusedHazard.classification}: Slope ${fusedHazard.estimatedSlopeDeg.toFixed(1)}° ± ${fusedHazard.uncertaintyDeg.toFixed(1)}° > limit ${rover.hazardTolerance}°`;
        rationale = `Autonomous safety stop: ${reasonStr} detected along traverse line. Pausing to avoid rollover risk.`;
        recommendedAction = "Trigger replanning engine to calculate alternate low-gradient detour.";
      }
    }
    // Rule C: Complete Task
    else if (agent.currentTask && agent.currentTask.status === "IN_PROGRESS") {
      const distToTarget = Math.sqrt(
        Math.pow(currentCoord.latitude - targetCoord.latitude, 2) +
        Math.pow(currentCoord.longitude - targetCoord.longitude, 2)
      );
      if (distToTarget < 0.001) {
        decisionAction = "TASK_COMPLETE";
        newStatus = "IDLE";
        rationale = `Target waypoint reached. ${agent.currentTask.name} completed successfully.`;
        agent.currentTask.status = "COMPLETED";
      }
    }

    // Apply state change if changed
    agent.status = newStatus;
    AgentStateStore.updateAgentState(agent, {
      agentId: agent.id,
      eventType:
        decisionAction === "PAUSE"
          ? "HAZARD_DETECTED"
          : decisionAction === "EMERGENCY_STOP"
          ? "EMERGENCY_DECLARED"
          : decisionAction === "TASK_COMPLETE"
          ? "TASK_COMPLETED"
          : "TASK_STARTED",
      severity: decisionAction === "EMERGENCY_STOP" ? "CRITICAL" : decisionAction === "PAUSE" ? "WARNING" : "INFO",
      message: `${agent.callsign}: ${rationale}`,
      details: {
        decisionAction,
        batteryPercent: batteryPct,
        batteryStatus,
        commsStatus,
        detectedHazards: hazardNames,
      },
    });

    return {
      agentId: agent.id,
      previousStatus,
      currentStatus: newStatus,
      decisionAction,
      detectedHazards: hazardNames,
      batteryStatus,
      communicationStatus: commsStatus,
      rationale,
      recommendedAction,
    };
  }
}
