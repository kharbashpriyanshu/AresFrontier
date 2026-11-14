import { PlanetaryAgent, RoverAgent, AstronautAgent } from "../agents/agentTypes.js";
import { MissionEventRecord, FusedHazardReport, MarsCoordinate } from "../../types/index.js";
import { ReplayState, ReplayMetrics } from "./replayTypes.js";
import { AgentRegistry } from "../agents/agentRegistry.js";

/**
 * Reconstructive Replay State Manager
 * Evaluates event-sourced streams to reconstruct exact agent positions, telemetry,
 * active hazards, and routes without touching live in-memory operational stores.
 */
export class ReplayStateManager {
  private baseAgents: PlanetaryAgent[] = [];
  private currentAgents: PlanetaryAgent[] = [];
  private activeHazards: FusedHazardReport[] = [];
  private activeWaypoints: MarsCoordinate[] = [];
  private metrics: ReplayMetrics = {
    batteryDepletedPercent: 0,
    scienceYieldScore: 0,
    hazardsEncountered: 0,
    hazardsAvoided: 0,
    safetyScore: 95,
    packetsDeliveredCount: 0,
    packetsBufferedCount: 0,
  };

  constructor() {
    this.reset();
  }

  /**
   * Initializes replay baseline with decoupled copies of default agents.
   */
  public reset(): void {
    const liveAgents = AgentRegistry.getAllAgents();
    this.baseAgents = JSON.parse(JSON.stringify(liveAgents));
    this.currentAgents = JSON.parse(JSON.stringify(this.baseAgents));
    this.activeHazards = [];
    this.activeWaypoints = [
      { latitude: 18.4447, longitude: 77.4508 },
      { latitude: 18.4485, longitude: 77.4320 },
      { latitude: 18.4550, longitude: 77.4100 },
    ];
    this.metrics = {
      batteryDepletedPercent: 0,
      scienceYieldScore: 0,
      hazardsEncountered: 0,
      hazardsAvoided: 0,
      safetyScore: 95,
      packetsDeliveredCount: 0,
      packetsBufferedCount: 0,
    };
  }

  public getAgents(): PlanetaryAgent[] {
    return JSON.parse(JSON.stringify(this.currentAgents));
  }

  public getHazards(): FusedHazardReport[] {
    return JSON.parse(JSON.stringify(this.activeHazards));
  }

  public getWaypoints(): MarsCoordinate[] {
    return [...this.activeWaypoints];
  }

  public getMetrics(): ReplayMetrics {
    return { ...this.metrics };
  }

  /**
   * Applies an event to reconstruct world state at that moment in time.
   */
  public applyEvent(event: MissionEventRecord): void {
    const actor = event.actor;
    const p = event.payload || {};

    const agent = this.currentAgents.find((a) => a.id === actor || a.callsign.includes(actor));

    switch (event.eventType) {
      case "MISSION_STARTED":
        this.reset();
        break;

      case "AGENT_ASSIGNED":
        if (agent) {
          agent.status = "EXECUTING";
          if (p.coordinate) {
            agent.position = p.coordinate as MarsCoordinate;
          }
        }
        break;

      case "SENSOR_OBSERVATION":
        if (p.measuredSlopeDeg && Number(p.measuredSlopeDeg) > 15) {
          this.metrics.hazardsEncountered += 1;
        }
        break;

      case "HAZARD_DETECTED":
        if (p.hazard) {
          this.activeHazards.push(p.hazard as FusedHazardReport);
        } else if (p.coordinate) {
          this.activeHazards.push({
            hazardId: `haz-replay-${Date.now()}`,
            location: p.coordinate as MarsCoordinate,
            classification: "SENSOR_DERIVED",
            evidenceType: "SENSOR_EVIDENCE",
            estimatedSlopeDeg: Number(p.slopeDeg || 21.4),
            uncertaintyDeg: 0.9,
            confidenceInterval: [20.5, 22.3],
            obstacleProbability: 0.85,
            corroboratingSensors: ["HAZCAM"],
            actionableWarning: "Replay event hazard detection",
            requiresReplan: true,
            provenance: event.provenance,
          });
        }
        break;

      case "COMMAND_ISSUED":
      case "COMMAND_EXECUTED":
        if (agent) {
          const cmd = String(p.command || "");
          if (cmd === "PAUSE") agent.status = "PAUSED";
          else if (cmd === "RESUME") agent.status = "EXECUTING";
          else if (cmd === "EMERGENCY_STOP") agent.status = "EMERGENCY";
        }
        break;

      case "REPLAN_PROPOSED":
        this.metrics.hazardsAvoided += 1;
        if (p.proposedWaypoints && Array.isArray(p.proposedWaypoints)) {
          this.activeWaypoints = p.proposedWaypoints;
        }
        break;

      case "REPLAN_APPROVED":
        if (agent && agent.status === "PAUSED") {
          agent.status = "EXECUTING";
        }
        break;

      case "COMMUNICATION_LOST":
        this.currentAgents.forEach((a) => {
          if (a.telemetry) a.telemetry.lineOfSightToRelay = false;
        });
        break;

      case "COMMUNICATION_RESTORED":
        this.currentAgents.forEach((a) => {
          if (a.telemetry) a.telemetry.lineOfSightToRelay = true;
        });
        break;

      case "SCIENCE_TARGET_COMPLETED":
        this.metrics.scienceYieldScore += 25;
        break;
    }

    // Incremental simulated energy drain
    if (agent && agent.telemetry) {
      if (p.batteryPercent !== undefined) {
        agent.telemetry.batteryPercent = Number(p.batteryPercent);
      } else if (agent.status === "EXECUTING") {
        agent.telemetry.batteryPercent = Math.max(10, agent.telemetry.batteryPercent - 0.2);
        this.metrics.batteryDepletedPercent += 0.2;
      }
    }
  }

  /**
   * Reconstructs state from scratch up to a specific event index.
   */
  public rebuildStateUpToIndex(events: MissionEventRecord[], targetIndex: number): void {
    this.reset();
    const bound = Math.min(targetIndex, events.length - 1);
    for (let i = 0; i <= bound; i++) {
      this.applyEvent(events[i]);
    }
  }
}
