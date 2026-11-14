import { MissionEventRecord } from "../../types/index.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { ReplayState, ReplayEventFilter, ReplaySummary } from "./replayTypes.js";
import { ReplayStateManager } from "./replayStateManager.js";
import { ReplaySerializer } from "./replaySerializer.js";

export class MissionReplayEngine {
  private static activeMissionId: string = "MARSWALK-001";
  private static events: MissionEventRecord[] = [];
  private static currentIndex: number = 0;
  private static replayStatus: "IDLE" | "PLAYING" | "PAUSED" | "COMPLETED" = "IDLE";
  private static stateManager: ReplayStateManager = new ReplayStateManager();

  /**
   * Initializes replay engine with a specific mission ID.
   */
  public static loadMission(missionId: string): boolean {
    this.activeMissionId = missionId;
    this.events = MissionEventStore.getEvents(1000).filter((e) => e.missionId === missionId);

    // If no events exist yet for this mission, seed deterministic benchmark events
    if (this.events.length === 0) {
      this.seedBenchmarkEvents(missionId);
    }

    this.currentIndex = 0;
    this.replayStatus = "IDLE";
    this.stateManager.reset();
    return true;
  }

  /**
   * Starts or resumes playback for a mission.
   */
  public static startReplay(missionId?: string): ReplayState {
    if (missionId && missionId !== this.activeMissionId) {
      this.loadMission(missionId);
    } else if (this.events.length === 0) {
      this.loadMission(this.activeMissionId);
    }

    this.replayStatus = "PLAYING";
    return this.getReplayState();
  }

  /**
   * Steps the replay forward or backward by 1 event.
   */
  public static stepReplay(direction: "FORWARD" | "BACKWARD" = "FORWARD"): ReplayState {
    if (this.events.length === 0) {
      this.loadMission(this.activeMissionId);
    }

    if (direction === "FORWARD") {
      if (this.currentIndex < this.events.length - 1) {
        this.currentIndex += 1;
        this.stateManager.applyEvent(this.events[this.currentIndex]);
      } else {
        this.replayStatus = "COMPLETED";
      }
    } else {
      if (this.currentIndex > 0) {
        this.currentIndex -= 1;
        this.stateManager.rebuildStateUpToIndex(this.events, this.currentIndex);
        this.replayStatus = "PAUSED";
      }
    }

    return this.getReplayState();
  }

  public static pauseReplay(): ReplayState {
    this.replayStatus = "PAUSED";
    return this.getReplayState();
  }

  public static resumeReplay(): ReplayState {
    this.replayStatus = "PLAYING";
    return this.getReplayState();
  }

  /**
   * Seeks to a specific event index or simulation time (in seconds).
   */
  public static seekReplay(target: number): ReplayState {
    if (this.events.length === 0) {
      this.loadMission(this.activeMissionId);
    }

    let targetIndex = 0;
    if (target > 60) {
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < this.events.length; i++) {
        const simSec = this.events[i].simulationTime !== undefined
          ? this.events[i].simulationTime!
          : i * 120;
        const diff = Math.abs(simSec - target);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      targetIndex = closestIdx;
    } else {
      targetIndex = Math.max(0, Math.min(Math.floor(target), this.events.length - 1));
    }

    this.currentIndex = targetIndex;
    this.stateManager.rebuildStateUpToIndex(this.events, this.currentIndex);
    return this.getReplayState();
  }

  public static resetReplay(): ReplayState {
    this.currentIndex = 0;
    this.replayStatus = "IDLE";
    this.stateManager.reset();
    if (this.events.length > 0) {
      this.stateManager.applyEvent(this.events[0]);
    }
    return this.getReplayState();
  }

  public static getReplayState(): ReplayState {
    const curEvent = this.events.length > 0 && this.currentIndex < this.events.length
      ? this.events[this.currentIndex]
      : undefined;

    const simTime = curEvent?.simulationTime !== undefined
      ? curEvent.simulationTime
      : this.currentIndex * 120; // 2 min per event fallback

    return {
      missionId: this.activeMissionId,
      status: this.replayStatus,
      currentEventIndex: this.currentIndex,
      currentSimTimeSeconds: simTime,
      totalEvents: this.events.length,
      currentEvent: curEvent,
      agents: this.stateManager.getAgents(),
      activeHazards: this.stateManager.getHazards(),
      activeRouteWaypoints: this.stateManager.getWaypoints(),
      metrics: this.stateManager.getMetrics(),
      lastUpdated: new Date().toISOString(),
    };
  }

  public static getReplaySummary(): ReplaySummary {
    return ReplaySerializer.createSummary(this.getReplayState(), this.events);
  }

  public static filterEvents(filter: ReplayEventFilter): MissionEventRecord[] {
    return this.events.filter((e) => {
      if (filter.agentId && e.actor !== filter.agentId && e.agentId !== filter.agentId) return false;
      if (filter.eventType && e.eventType !== filter.eventType) return false;
      if (filter.minSimTime !== undefined && (e.simulationTime || 0) < filter.minSimTime) return false;
      if (filter.maxSimTime !== undefined && (e.simulationTime || 0) > filter.maxSimTime) return false;
      return true;
    });
  }

  public static getEvents(): MissionEventRecord[] {
    return [...this.events];
  }

  private static seedBenchmarkEvents(missionId: string): void {
    const initialEvents: Omit<MissionEventRecord, "eventId" | "previousEventHash" | "eventHash">[] = [
      {
        missionId,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        simulationTime: 0,
        actor: "MISSION_CONTROL",
        eventType: "MISSION_STARTED",
        payload: { objective: "Jezero Delta Front Traverse", crewCommander: "Alex Vance" },
        provenance: { sourceType: "BENCHMARK", sourceName: "Flight Director", dataMode: "BENCHMARK" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        simulationTime: 600,
        actor: "agent-rover-01",
        eventType: "AGENT_ASSIGNED",
        payload: { task: "RECONNAISSANCE", coordinate: { latitude: 18.4485, longitude: 77.4320 } },
        provenance: { sourceType: "ROVER", sourceName: "Ares Scout Telemetry", dataMode: "SIMULATED" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 2400000).toISOString(),
        simulationTime: 1200,
        actor: "agent-rover-01",
        eventType: "SENSOR_OBSERVATION",
        payload: { sensor: "HAZCAM", measuredSlopeDeg: 21.8, uncertaintyDeg: 1.1 },
        provenance: { sourceType: "ROVER", sourceName: "Stereo HazCam", dataMode: "SIMULATED" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        simulationTime: 1800,
        actor: "agent-rover-01",
        eventType: "HAZARD_DETECTED",
        payload: {
          hazardType: "SLOPE_EXCESSIVE",
          coordinate: { latitude: 18.4520, longitude: 77.4180 },
          slopeDeg: 21.8,
        },
        provenance: { sourceType: "MODEL", sourceName: "ObservationHazardFusion", dataMode: "DERIVED" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 1500000).toISOString(),
        simulationTime: 2100,
        actor: "agent-rover-01",
        eventType: "COMMAND_EXECUTED",
        payload: { command: "PAUSE", reason: "Autonomous safety stop on corroborated hazard" },
        provenance: { sourceType: "ROVER", sourceName: "DecisionEngine", dataMode: "SIMULATED" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        simulationTime: 2400,
        actor: "MISSION_CONTROL",
        eventType: "REPLAN_PROPOSED",
        payload: {
          replanId: "replan-benchmark-01",
          proposedWaypoints: [
            { latitude: 18.4485, longitude: 77.4320 },
            { latitude: 18.4540, longitude: 77.4250 },
            { latitude: 18.4580, longitude: 77.4120 },
          ],
        },
        provenance: { sourceType: "MODEL", sourceName: "ReplanningEngine", dataMode: "DERIVED" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 900000).toISOString(),
        simulationTime: 2700,
        actor: "MISSION_CONTROL",
        eventType: "REPLAN_APPROVED",
        payload: { approvedBy: "Flight Director Vance", role: "MISSION_COMMAND" },
        provenance: { sourceType: "AUDIT", sourceName: "AuditChainService", dataMode: "BENCHMARK" },
      },
      {
        missionId,
        timestamp: new Date(Date.now() - 300000).toISOString(),
        simulationTime: 3300,
        actor: "agent-rover-02",
        eventType: "SCIENCE_TARGET_COMPLETED",
        payload: { targetId: "sci-delta-silt", targetName: "Delta Foreset Carbonate Bed" },
        provenance: { sourceType: "ROVER", sourceName: "Raman Spectrometer", dataMode: "SIMULATED" },
      },
    ];

    for (const evt of initialEvents) {
      const recorded = MissionEventStore.appendEvent(evt as any);
      this.events.push(recorded);
    }
  }
}
