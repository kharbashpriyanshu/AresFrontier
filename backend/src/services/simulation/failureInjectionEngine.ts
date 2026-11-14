import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { ObservationStore } from "../sensors/observationStore.js";
import { CommunicationQueueService } from "../comms/communicationQueueService.js";
import { auditChainService } from "../security/auditChainService.js";
import { RoverAgent, AstronautAgent } from "../agents/agentTypes.js";
import { DeterministicIdGenerator } from "../../utils/deterministicId.js";

export type FailureType =
  | "SENSOR_FAILURE"
  | "SENSOR_DEGRADED"
  | "BATTERY_DRAIN"
  | "COMMUNICATION_BLACKOUT"
  | "ORBITAL_PASS_MISSED"
  | "ROVER_IMMOBILIZED"
  | "HAZARD_APPEARS"
  | "RELAY_UNAVAILABLE"
  | "ASTRONAUT_COMMS_LOST"
  | "SCIENCE_INSTRUMENT_FAILURE";

export interface FailureInjectionParams {
  failureType: FailureType;
  targetAgentId?: string;
  severity?: "WARNING" | "CRITICAL";
  customDetails?: Record<string, unknown>;
}

export interface FailureInjectionResult {
  injectionId: string;
  timestamp: string;
  failureType: FailureType;
  targetAgent: string;
  previousState: string;
  updatedState: string;
  impactDescription: string;
  systemActionTaken: string;
  mitigationRecommendation: string;
  auditBlockHash: string;
}

export class FailureInjectionEngine {
  /**
   * Deterministically injects a subsystem fault into the live or sandbox simulation.
   */
  public static injectFailure(params: FailureInjectionParams): FailureInjectionResult {
    const timestamp = new Date().toISOString();
    const targetAgentId = params.targetAgentId || "agent-rover-01";
    const agent = AgentRegistry.getAgentById(targetAgentId);

    const injectionId = DeterministicIdGenerator.generateId({
      prefix: "fail-inj",
      missionId: "MARSWALK-001",
      agentId: targetAgentId,
      entityType: params.failureType,
    });

    const previousState = agent ? agent.status : "UNKNOWN";
    let updatedState = previousState;
    let impactDescription = "";
    let systemActionTaken = "";
    let mitigation = "";

    switch (params.failureType) {
      case "SENSOR_DEGRADED":
      case "SENSOR_FAILURE":
        impactDescription = `HazCam optical point-cloud degradation (+300% uncertainty). Feature disparity lost.`;
        systemActionTaken = `Sensor-Hazard Fusion downgraded to UNCORROBORATED. Rover speed throttled by 50%.`;
        mitigation = `Switch primary navigation reliance to MOLA laser altimetry differential. Request astronaut visual corridor scan.`;
        if (agent) {
          agent.status = "PAUSED";
          updatedState = "PAUSED";
          AgentRegistry.updateAgent(agent);
        }
        break;

      case "BATTERY_DRAIN":
        impactDescription = `Sudden heater resistance short-circuit. Battery dropped to 14.5% (S1 reserve breached).`;
        systemActionTaken = `Safety Invariant S1 triggered. All science tasks aborted. Rover entered EMERGENCY_STOP.`;
        mitigation = `Direct solar panel arrays toward local noon azimuth. Deploy Ares Relay rover for power umbilical standby.`;
        if (agent) {
          const rover = agent as RoverAgent;
          rover.telemetry.batteryPercent = 14.5;
          rover.status = "EMERGENCY";
          updatedState = "EMERGENCY";
          AgentRegistry.updateAgent(rover);
        }
        break;

      case "COMMUNICATION_BLACKOUT":
      case "ORBITAL_PASS_MISSED":
        impactDescription = `Orbiter transmitter off-nominal. X-band downlink throughput dropped to 0 kbps.`;
        systemActionTaken = `Bulk science packets transitioned to BUFFERED. Autonomous local UHF mesh established via ROVER-03 RELAY.`;
        mitigation = `Hold science telemetry in flash buffer until MET 01:54 pass. Prioritize crew health telemetry over local UHF.`;
        CommunicationQueueService.executeBlackoutScenario();
        updatedState = "BUFFERING";
        break;

      case "ROVER_IMMOBILIZED":
        impactDescription = `Wheel motor stalled in unconsolidated foreset regolith. Slip odometry indicates 88% wheel trenching.`;
        systemActionTaken = `Automated drive pause. Slip-prevention algorithm locked motor brakes to avoid deepening trench.`;
        mitigation = `Execute reverse traverse rock-wiggle maneuver. If unresolved, reroute Astronaut Vance to assist with recovery.`;
        if (agent) {
          agent.status = "PAUSED";
          updatedState = "PAUSED";
          AgentRegistry.updateAgent(agent);
        }
        break;

      case "HAZARD_APPEARS":
        impactDescription = `Unmapped active dust devil track / 24.5° fresh rockfall detected along primary traverse path.`;
        systemActionTaken = `Sensor-Hazard Fusion classified feature as CORROBORATED_CONFIRMED. Replan proposed.`;
        mitigation = `Execute proposed Northern Detour (+0.3 km, +6 min). Human authorization required from Flight Director.`;
        if (agent) {
          agent.status = "PAUSED";
          updatedState = "PAUSED";
          AgentRegistry.updateAgent(agent);
        }
        break;

      case "ASTRONAUT_COMMS_LOST":
        impactDescription = `Astronaut Alex Vance suit transceiver multipath drop behind crater rim. Line-of-sight lost.`;
        systemActionTaken = `Ares Relay rover autonomously commanded to climb local vantage ridge to restore line of sight.`;
        mitigation = `Astronaut to hold position at safe standby coordinate until relay acoustic beacon confirms lock.`;
        const astronaut = AgentRegistry.getAgentById("agent-astronaut-01") as AstronautAgent;
        if (astronaut) {
          astronaut.telemetry.lineOfSightToRelay = false;
          AgentRegistry.updateAgent(astronaut);
        }
        updatedState = "SEARCHING_RELAY";
        break;

      default:
        impactDescription = `Generic subsystem failure injected: ${params.failureType}`;
        systemActionTaken = `Telemetry logged to security audit chain.`;
        mitigation = `Review subsystem health diagnostics in operations console.`;
    }

    AgentStateStore.recordEvent({
      agentId: targetAgentId,
      eventType: "EMERGENCY_DECLARED",
      severity: params.severity || "CRITICAL",
      message: `FAILURE INJECTION: ${params.failureType} -> ${impactDescription}`,
      details: { injectionId, failureType: params.failureType, previousState, updatedState },
    });

    const auditBlock = auditChainService.appendEvent({
      userId: "SIMULATION_CONTROLLER",
      role: "MISSION_COMMAND",
      action: "OPTIMIZE_ROUTE",
      missionPlanId: "FAILURE_TEST",
      details: {
        eventType: "TRIGGER_EMERGENCY",
        injectionId,
        failureType: params.failureType,
        targetAgentId,
        systemActionTaken,
        impactDescription,
      },
    });

    return {
      injectionId,
      timestamp,
      failureType: params.failureType,
      targetAgent: targetAgentId,
      previousState,
      updatedState,
      impactDescription,
      systemActionTaken,
      mitigationRecommendation: mitigation,
      auditBlockHash: auditBlock.integrityHash,
    };
  }
}
