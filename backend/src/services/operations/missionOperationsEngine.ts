import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore, OperationEvent } from "../agents/agentStateStore.js";
import { AgentDecisionEngine } from "../agents/agentDecisionEngine.js";
import { CommunicationEngine, NetworkTopology } from "../comms/communicationEngine.js";
import { RelayPlanner, RelayRoute } from "../comms/relayPlanner.js";
import { ReplanningEngine, ReplanProposal } from "./replanningEngine.js";
import { MultiAgentCoordinator, ScienceQueueItem } from "./multiAgentCoordinator.js";
import { MissionTimelineEngine, TimelineEvent } from "./missionTimelineEngine.js";
import { RoverAgent } from "../agents/agentTypes.js";
import { SensorObservationEngine } from "../sensors/sensorObservationEngine.js";
import { ObservationHazardFusion } from "../hazard/observationHazardFusion.js";

export interface SimulationState {
  isRunning: boolean;
  simulationTimeMinutes: number;
  timeScale: number; // 1x, 2x, 5x, 10x
  scenarioSeed: number;
  activeEmergency?: {
    scenarioId: string;
    title: string;
    affectedAgentCallsigns: string[];
    severity: "WARNING" | "CRITICAL";
    recommendedMitigation: string;
  };
}

export class MissionOperationsEngine {
  private static simState: SimulationState = {
    isRunning: false,
    simulationTimeMinutes: 45,
    timeScale: 1.0,
    scenarioSeed: 20261107,
  };

  public static getSimulationState(): SimulationState {
    return this.simState;
  }

  public static setSimulationState(state: Partial<SimulationState>): void {
    this.simState = { ...this.simState, ...state };
  }

  public static setSimulationRunning(running: boolean, timeScale: number = 1.0): SimulationState {
    this.simState.isRunning = running;
    this.simState.timeScale = timeScale;
    AgentStateStore.recordEvent({
      agentId: "MISSION_CONTROL",
      eventType: "TASK_STARTED",
      severity: "INFO",
      message: `Simulation clock ${running ? "started" : "paused"} at ${this.simState.simulationTimeMinutes} min (${timeScale}x rate)`,
    });
    return this.simState;
  }

  public static advanceSimulation(minutes: number): {
    simState: SimulationState;
    events: OperationEvent[];
    network: NetworkTopology;
  } {
    this.simState.simulationTimeMinutes += minutes;
    MissionTimelineEngine.advanceSimulationTimeline(this.simState.simulationTimeMinutes);

    // Run decision cycles for all active rovers
    const agents = AgentRegistry.getAllAgents();
    agents.forEach((agent) => {
      if (agent.type === "ROVER" && agent.status === "EXECUTING") {
        AgentDecisionEngine.runCycle(agent, { latitude: 18.4447, longitude: 77.4508 });
      }
    });

    const network = CommunicationEngine.evaluateNetwork(agents, this.simState.simulationTimeMinutes);
    const events = AgentStateStore.getEvents(10);

    return {
      simState: this.simState,
      events,
      network,
    };
  }

  public static resetSimulation(): SimulationState {
    this.simState = {
      isRunning: false,
      simulationTimeMinutes: 30,
      timeScale: 1.0,
      scenarioSeed: 20261107,
    };
    AgentStateStore.reset();
    MissionTimelineEngine.reset();
    return this.simState;
  }

  /**
   * Flagship Phase 4 Deterministic Demo:
   * ROVER-01 detects a steep scarp hazard -> pauses -> reports -> comms relay plans detour -> replan proposal generated.
   */
  public static async triggerDemoScenario(): Promise<{
    replanProposal: ReplanProposal;
    relayRoute: RelayRoute;
    affectedAgent: RoverAgent;
  }> {
    const scoutRover = AgentRegistry.getAgentById("agent-rover-01") as RoverAgent;
    if (!scoutRover) {
      throw new Error("Scout rover agent not initialized");
    }

    // 1. Move rover closer to the Kodiak Butte delta scarp
    scoutRover.position = { latitude: 18.451, longitude: 77.418 };
    scoutRover.status = "PAUSED";
    scoutRover.telemetry.speedKph = 0;

    AgentRegistry.updateAgent(scoutRover);

    // 2. Generate real-time sensor observations at detected coordinate
    const observations = await SensorObservationEngine.sampleAgentSensors(scoutRover.id, scoutRover.position);
    const fusedHazard = await ObservationHazardFusion.evaluateHazard(scoutRover.position, observations, scoutRover.hazardTolerance);

    // 3. Log sensor-derived hazard detection
    AgentStateStore.recordEvent({
      agentId: scoutRover.id,
      eventType: "HAZARD_DETECTED",
      severity: "WARNING",
      message: `${scoutRover.callsign}: Sensor fusion corroboration — ${fusedHazard.actionableWarning}`,
      details: {
        hazardType: "STEEP_SLOPE",
        classification: fusedHazard.classification,
        measuredSlope: fusedHazard.estimatedSlopeDeg,
        uncertainty: fusedHazard.uncertaintyDeg,
        corroboratingSensors: fusedHazard.corroboratingSensors,
        tolerance: scoutRover.hazardTolerance,
        coordinate: scoutRover.position,
      },
    });

    // 4. Plan Communication Relay Route to Mission Control
    const relayRoute = RelayPlanner.planRelayRoute(scoutRover.id, AgentRegistry.getAllAgents());

    // 5. Trigger Replanning Engine
    const replanProposal = await ReplanningEngine.triggerReplan({
      triggerType: "HAZARD_DETECTED",
      initiatorAgentId: scoutRover.id,
      initiatorCallsign: scoutRover.callsign,
      detectedCoordinate: scoutRover.position,
      hazardId: "hzd-jezero-delta-scarp-local",
      hazardDescription: `Sensor-corroborated ${fusedHazard.estimatedSlopeDeg}° slope with perched boulders at Kodiak corridor`,
      reason: "Slope gradient exceeds rover 20° stability ceiling. Automated safety pause engaged.",
    });

    this.simState.activeEmergency = {
      scenarioId: "SCENARIO_C_HAZARD",
      title: "High-Gradient Scarp Detected by Scout Rover",
      affectedAgentCallsigns: [scoutRover.callsign, "ASTRONAUT-01"],
      severity: "WARNING",
      recommendedMitigation: "Approve proposed detour corridor along low-gradient valley floor.",
    };

    return {
      replanProposal,
      relayRoute,
      affectedAgent: scoutRover,
    };
  }

  /**
   * Simulates emergency scenarios (Section 18).
   */
  public static triggerEmergency(scenario: "BATTERY_CRITICAL" | "COMMS_LOST" | "HAZARD" | "IMMOBILIZED"): {
    emergencyId: string;
    title: string;
    details: string;
  } {
    let title = "";
    let details = "";
    const emergencyId = `emg-${Date.now()}`;

    switch (scenario) {
      case "BATTERY_CRITICAL":
        title = "ROVER-02 Battery Critical (<10%)";
        details = "Science rover battery drained to 8.5%. Safe return mode engaged at low power.";
        const sciRover = AgentRegistry.getAgentById("agent-rover-02");
        if (sciRover) {
          sciRover.status = "EMERGENCY";
          sciRover.telemetry.batteryPercent = 8.5;
          sciRover.telemetry.batteryStatus = "CRITICAL";
          AgentRegistry.updateAgent(sciRover);
        }
        break;
      case "COMMS_LOST":
        title = "Astronaut Direct Comms Blackout";
        details = "Astronaut entered crater shadow zone. Tactical relay ROVER-03 auto-repositioned.";
        const astro = AgentRegistry.getAgentById("agent-astronaut-01");
        if (astro) {
          astro.telemetry.signalStrengthPercent = 5;
          astro.telemetry.lineOfSightToRelay = false;
          AgentRegistry.updateAgent(astro);
        }
        break;
      case "HAZARD":
        return this.triggerDemoScenario() as any;
      case "IMMOBILIZED":
        title = "ROVER-01 Wheel Odometry Slip Anomaly";
        details = "Scree regolith slippage exceeded 80%. Automated stop triggered to prevent trenching.";
        break;
    }

    AgentStateStore.recordEvent({
      agentId: "MISSION_CONTROL",
      eventType: "EMERGENCY_DECLARED",
      severity: "CRITICAL",
      message: `Emergency Response Engine: ${title} — ${details}`,
      details: { scenario, emergencyId },
    });

    return { emergencyId, title, details };
  }
}
