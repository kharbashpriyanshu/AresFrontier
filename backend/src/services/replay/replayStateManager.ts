import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PlanetaryAgent, RoverAgent, AstronautAgent } from "../agents/agentTypes.js";
import { MissionEventRecord, FusedHazardReport, MarsCoordinate, Hazard, RoutePoint } from "../../types/index.js";
import { ReplayState, ReplayMetrics } from "./replayTypes.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { UnifiedMissionState } from "../../types/unifiedMissionState.js";
import { MissionStateCoordinator } from "../state/missionStateCoordinator.js";
import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";

export interface DigitalTwinSnapshot {
  snapshotId: string;
  missionId?: string;
  tag: string;
  timestamp: string;
  simTimeMinutes: number;
  stateHash: string;
  agents: PlanetaryAgent[];
  activeHazards: FusedHazardReport[];
  activeWaypoints: MarsCoordinate[];
  metrics: ReplayMetrics;
  tasks?: Record<string, any>;
  packets?: Record<string, any>;
  evaSessions?: Record<string, any>;
  routeId?: string | null;
}

export interface StateInconsistencyReport {
  isConsistent: boolean;
  discrepancies: Array<{
    domain: string;
    entityId: string;
    digitalTwinValue: any;
    canonicalValue: any;
    severity: "WARN" | "CRITICAL";
  }>;
  evaluatedAt: string;
}

/**
 * Reconstructive Replay & Digital Twin State Manager
 * Synchronizes the expedition's physical, operational, and simulation state with the
 * canonical mission state while maintaining immutable event-sourced replay capabilities.
 */
export class ReplayStateManager {
  private static readonly snapshotsFilePath = path.resolve(CANONICAL_BACKEND_DATA_DIR, "digital_twin_snapshots.json");
  private baseAgents: PlanetaryAgent[] = [];
  private currentAgents: PlanetaryAgent[] = [];
  private activeHazards: FusedHazardReport[] = [];
  private activeWaypoints: MarsCoordinate[] = [];
  private snapshots: Map<string, DigitalTwinSnapshot> = new Map();
  private reconstructedTasks: Record<string, any> = {};
  private reconstructedPackets: Record<string, any> = {};
  private reconstructedEvaSessions: Record<string, any> = {};
  private activeRouteId: string | null = null;
  private missionStatus: string = "INITIALIZED";
  private reconstructionWarnings: string[] = [];
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
    this.loadPersistedSnapshots();
    this.reset();
  }

  private loadPersistedSnapshots(): void {
    try {
      if (fs.existsSync(ReplayStateManager.snapshotsFilePath)) {
        const raw = fs.readFileSync(ReplayStateManager.snapshotsFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const snap of parsed) {
            if (snap && snap.snapshotId) {
              this.snapshots.set(snap.snapshotId, snap);
            }
          }
        }
      }
    } catch {
      // Ignore corrupt snapshot index on startup; individual snapshot integrity is checked on read
    }
  }

  private persistSnapshots(): void {
    try {
      fs.mkdirSync(path.dirname(ReplayStateManager.snapshotsFilePath), { recursive: true });
      const tmp = `${ReplayStateManager.snapshotsFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(Array.from(this.snapshots.values()), null, 2), "utf-8");
      fs.renameSync(tmp, ReplayStateManager.snapshotsFilePath);
    } catch {
      // Non-fatal fallback
    }
  }

  public static computeSnapshotHash(snap: {
    tag: string;
    simTimeMinutes: number;
    agents: PlanetaryAgent[];
    activeHazards: FusedHazardReport[];
    activeWaypoints: MarsCoordinate[];
    metrics: ReplayMetrics;
  }): string {
    const payload = JSON.stringify({
      tag: snap.tag,
      simTimeMinutes: snap.simTimeMinutes,
      agents: snap.agents,
      hazards: snap.activeHazards,
      waypoints: snap.activeWaypoints,
      metrics: snap.metrics,
    });
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  public static verifySnapshotIntegrity(snapshot: DigitalTwinSnapshot): boolean {
    if (!snapshot || !snapshot.stateHash || !Array.isArray(snapshot.agents)) return false;
    const expected = this.computeSnapshotHash({
      tag: snapshot.tag,
      simTimeMinutes: snapshot.simTimeMinutes,
      agents: snapshot.agents,
      activeHazards: snapshot.activeHazards || [],
      activeWaypoints: snapshot.activeWaypoints || [],
      metrics: snapshot.metrics,
    });
    return snapshot.stateHash === expected;
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
    this.reconstructedTasks = {};
    this.reconstructedPackets = {};
    this.reconstructedEvaSessions = {};
    this.activeRouteId = null;
    this.missionStatus = "INITIALIZED";
    this.reconstructionWarnings = [];
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

  public hydrateFromSnapshot(snapshot: DigitalTwinSnapshot): boolean {
    if (!ReplayStateManager.verifySnapshotIntegrity(snapshot)) {
      this.reconstructionWarnings.push(`Snapshot '${snapshot?.snapshotId}' failed SHA-256 integrity verification; falling back to genesis replay.`);
      return false;
    }
    this.currentAgents = JSON.parse(JSON.stringify(snapshot.agents));
    this.activeHazards = JSON.parse(JSON.stringify(snapshot.activeHazards || []));
    this.activeWaypoints = JSON.parse(JSON.stringify(snapshot.activeWaypoints || []));
    this.metrics = { ...snapshot.metrics };
    this.reconstructedTasks = snapshot.tasks ? JSON.parse(JSON.stringify(snapshot.tasks)) : {};
    this.reconstructedPackets = snapshot.packets ? JSON.parse(JSON.stringify(snapshot.packets)) : {};
    this.reconstructedEvaSessions = snapshot.evaSessions ? JSON.parse(JSON.stringify(snapshot.evaSessions)) : {};
    this.activeRouteId = snapshot.routeId ?? null;
    return true;
  }

  /**
   * Hydrates the Digital Twin directly from the canonical unified mission state.
   */
  public hydrateFromCanonicalState(state?: UnifiedMissionState): void {
    const canonical = state || MissionStateCoordinator.getCanonicalState();
    if (!canonical) return;

    // 1. Sync Fleet Agents and Telemetry
    const agents: PlanetaryAgent[] = [];
    if (canonical.fleet.astronauts) {
      agents.push(...canonical.fleet.astronauts);
    }
    if (canonical.fleet.rovers) {
      agents.push(...canonical.fleet.rovers);
    }
    if (canonical.fleet.orbiters) {
      agents.push(...canonical.fleet.orbiters);
    }

    if (agents.length > 0) {
      this.currentAgents = JSON.parse(JSON.stringify(agents));
      this.baseAgents = JSON.parse(JSON.stringify(agents));
    }

    // 2. Sync Active Route Waypoints
    if (canonical.routes && canonical.routes.activeWaypoints) {
      this.activeWaypoints = canonical.routes.activeWaypoints.map((p: RoutePoint) => ({ ...p.coordinate }));
    }

    // 3. Sync Active Hazards
    const hazardsList = canonical.hazards ? [...(canonical.hazards.catalogHazards || []), ...(canonical.hazards.derivedSlopeHazards || [])] : [];
    if (hazardsList.length > 0) {
      this.activeHazards = hazardsList.map((h: Hazard) => ({
        hazardId: h.id,
        location: h.location,
        classification: "SENSOR_DERIVED",
        evidenceType: "SENSOR_EVIDENCE",
        estimatedSlopeDeg: 18.5,
        uncertaintyDeg: 0.8,
        confidenceInterval: [17.5, 19.5],
        obstacleProbability: h.probability || 0.85,
        corroboratingSensors: ["HAZCAM", "MOLA"],
        actionableWarning: h.reason,
        requiresReplan: h.severity === "CRITICAL" || h.severity === "HIGH",
        provenance: h.provenance || {
          sourceType: "DERIVED",
          sourceName: "Digital Twin Synchronizer",
          derivedFrom: ["Unified Mission State"],
          confidence: 0.9,
          timestamp: new Date().toISOString(),
        },
      }));
    }

    // 4. Sync Resource and Comms metrics
    if (canonical.resources && canonical.resources.fleetBatterySoc) {
      const avgSoc = Object.values(canonical.resources.fleetBatterySoc).reduce((a, b) => a + b, 0) /
        Math.max(1, Object.keys(canonical.resources.fleetBatterySoc).length);
      this.metrics.batteryDepletedPercent = Number((100 - avgSoc).toFixed(1));
    }
    if (canonical.communication && canonical.communication.packetQueue) {
      this.metrics.packetsDeliveredCount = canonical.communication.packetQueue.filter((p) => p.status === "DELIVERED").length;
      this.metrics.packetsBufferedCount = canonical.communication.packetQueue.filter((p) => p.status === "BUFFERED").length;
    }
  }

  /**
   * Applies an incremental update to a specific Digital Twin operational domain.
   */
  public applyIncrementalUpdate(domain: string, payload: any): void {
    if (!payload) return;

    if (domain === "agent_telemetry" && payload.agentId) {
      const agent = this.currentAgents.find((a) => a.id === payload.agentId || a.callsign === payload.agentId);
      if (agent && agent.telemetry) {
        if (payload.batteryPercent !== undefined) agent.telemetry.batteryPercent = payload.batteryPercent;
        if (payload.speedKph !== undefined) agent.telemetry.speedKph = payload.speedKph;
        if (payload.position) agent.position = { ...payload.position };
        if (payload.status) agent.status = payload.status;
        agent.lastUpdated = new Date().toISOString();
      }
    } else if (domain === "hazard_reported" && payload.location) {
      this.activeHazards.push({
        hazardId: `haz-dt-${Date.now()}`,
        location: payload.location,
        classification: "SENSOR_DERIVED",
        evidenceType: "SENSOR_EVIDENCE",
        estimatedSlopeDeg: Number(payload.slopeDeg || 20.0),
        uncertaintyDeg: 0.9,
        confidenceInterval: [19.0, 21.0],
        obstacleProbability: 0.88,
        corroboratingSensors: ["HAZCAM"],
        actionableWarning: payload.reason || "Real-time hazard telemetry alert",
        requiresReplan: true,
        provenance: {
          sourceType: "DERIVED",
          sourceName: "Digital Twin Real-Time Stream",
          confidence: 0.9,
          acquiredAt: new Date().toISOString(),
        },
      });
      this.metrics.hazardsEncountered += 1;
    } else if (domain === "route_updated" && Array.isArray(payload.waypoints)) {
      this.activeWaypoints = payload.waypoints.map((w: MarsCoordinate) => ({ ...w }));
    }
  }

  /**
   * Creates an immutable state snapshot with cryptographic SHA-256 state integrity hash.
   */
  public createSnapshot(tag: string = "operational-checkpoint", simTimeMinutes: number = 0, missionId: string = "MARSWALK-001"): DigitalTwinSnapshot {
    const stateHash = ReplayStateManager.computeSnapshotHash({
      tag,
      simTimeMinutes,
      agents: this.currentAgents,
      activeHazards: this.activeHazards,
      activeWaypoints: this.activeWaypoints,
      metrics: this.metrics,
    });
    const snapshotId = `snap-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;

    const snapshot: DigitalTwinSnapshot = {
      snapshotId,
      missionId,
      tag,
      timestamp: new Date().toISOString(),
      simTimeMinutes,
      stateHash,
      agents: JSON.parse(JSON.stringify(this.currentAgents)),
      activeHazards: JSON.parse(JSON.stringify(this.activeHazards)),
      activeWaypoints: JSON.parse(JSON.stringify(this.activeWaypoints)),
      metrics: { ...this.metrics },
      tasks: JSON.parse(JSON.stringify(this.reconstructedTasks)),
      packets: JSON.parse(JSON.stringify(this.reconstructedPackets)),
      evaSessions: JSON.parse(JSON.stringify(this.reconstructedEvaSessions)),
      routeId: this.activeRouteId,
    };

    this.snapshots.set(snapshotId, snapshot);
    this.persistSnapshots();
    return snapshot;
  }

  public getTasks(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.reconstructedTasks));
  }

  public getPackets(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.reconstructedPackets));
  }

  public getEvaSessions(): Record<string, any> {
    return JSON.parse(JSON.stringify(this.reconstructedEvaSessions));
  }

  public getRouteId(): string | null {
    return this.activeRouteId;
  }

  public getMissionStatus(): string {
    return this.missionStatus;
  }

  public getReconstructionWarnings(): string[] {
    return [...this.reconstructionWarnings];
  }

  public getSnapshot(snapshotId: string): DigitalTwinSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  public getAllSnapshots(): DigitalTwinSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /**
   * Compares Digital Twin operational state with canonical state to detect inconsistencies or stale telemetry.
   */
  public detectInconsistencies(canonicalState?: UnifiedMissionState): StateInconsistencyReport {
    const canonical = canonicalState || MissionStateCoordinator.getCanonicalState();
    const discrepancies: StateInconsistencyReport["discrepancies"] = [];

    if (!canonical) {
      return { isConsistent: true, discrepancies: [], evaluatedAt: new Date().toISOString() };
    }

    // Check agent battery SoC deviations
    if (canonical.fleet.rovers) {
      for (const rover of canonical.fleet.rovers) {
        const dtAgent = this.currentAgents.find((a) => a.id === rover.id);
        if (dtAgent && dtAgent.telemetry) {
          const delta = Math.abs(dtAgent.telemetry.batteryPercent - rover.telemetry.batteryPercent);
          if (delta > 5.0) {
            discrepancies.push({
              domain: "fleet.rovers.battery",
              entityId: rover.id,
              digitalTwinValue: dtAgent.telemetry.batteryPercent,
              canonicalValue: rover.telemetry.batteryPercent,
              severity: delta > 15.0 ? "CRITICAL" : "WARN",
            });
          }
        }
      }
    }

    // Check agent status deviations
    for (const dtAgent of this.currentAgents) {
      const canonicalAgent = [...(canonical.fleet.rovers || []), ...(canonical.fleet.astronauts || [])].find(
        (a) => a.id === dtAgent.id
      );
      if (canonicalAgent && canonicalAgent.status !== dtAgent.status) {
        discrepancies.push({
          domain: "fleet.agent.status",
          entityId: dtAgent.id,
          digitalTwinValue: dtAgent.status,
          canonicalValue: canonicalAgent.status,
          severity: "WARN",
        });
      }
    }

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies,
      evaluatedAt: new Date().toISOString(),
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
    const p = (event.payload || {}) as Record<string, any>;
    const res = (event.resultingState || {}) as Record<string, any>;

    const agent = this.currentAgents.find(
      (a) => a.id === event.agentId || a.id === event.entityId || a.id === actor || a.callsign === actor || a.callsign.includes(actor)
    );

    switch (event.eventType) {
      case "MISSION_STARTED":
        this.reset();
        this.missionStatus = "ACTIVE";
        break;

      case "MISSION_CREATED":
        this.missionStatus = String(res.status || p.status || "DRAFT");
        if (p.routeId || res.routeId) this.activeRouteId = String(res.routeId || p.routeId);
        break;

      case "MISSION_UPDATED":
      case "MISSION_APPROVED":
      case "MISSION_LOCKED":
        if (res.status || p.status) this.missionStatus = String(res.status || p.status);
        if (res.routeId || p.routeId) this.activeRouteId = String(res.routeId || p.routeId);
        break;

      case "ROUTE_CREATED":
      case "ROUTE_SELECTED":
        if (event.entityId || p.routeId) this.activeRouteId = String(event.entityId || p.routeId);
        if (Array.isArray(p.waypoints)) {
          this.activeWaypoints = p.waypoints.map((w: any) => ({ latitude: Number(w.latitude), longitude: Number(w.longitude) }));
        } else if (!Array.isArray(res.waypoints)) {
          this.reconstructionWarnings.push(`Event ${event.eventId} (${event.eventType}) lacks waypoint coordinates; route geometry unchanged.`);
        }
        break;

      case "AGENT_ASSIGNED":
      case "TASK_CREATED":
      case "TASK_TRANSITION":
      case "TASK_REASSIGNED": {
        const taskId = String(p.taskId || event.entityId || `task-${event.eventId}`);
        const prevTask = this.reconstructedTasks[taskId] || {};
        this.reconstructedTasks[taskId] = {
          ...prevTask,
          id: taskId,
          name: p.taskName || p.name || prevTask.name || "Assigned Task",
          taskType: p.taskType || prevTask.taskType,
          status: res.status || p.nextStatus || p.status || prevTask.status || "IN_PROGRESS",
          agentId: res.agentId || p.targetAgentId || event.agentId || agent?.id || prevTask.agentId,
          updatedAt: event.timestamp,
        };
        if (agent) {
          agent.status = String(res.agentStatus || (this.reconstructedTasks[taskId].status === "PAUSED" ? "PAUSED" : "EXECUTING")) as any;
          if (p.coordinate) {
            agent.position = p.coordinate as MarsCoordinate;
          }
          agent.lastUpdated = event.timestamp;
        }
        break;
      }

      case "AGENT_STATUS_CHANGED":
        if (agent) {
          agent.status = String(res.status || p.nextStatus || agent.status) as any;
          agent.lastUpdated = event.timestamp;
        }
        break;

      case "TELEMETRY_UPDATED":
        if (agent && agent.telemetry) {
          const t = res.telemetry ? (res.telemetry as Record<string, any>) : p;
          if (t.batteryPercent !== undefined) agent.telemetry.batteryPercent = Number(t.batteryPercent);
          if (t.speedKph !== undefined) agent.telemetry.speedKph = Number(t.speedKph);
          if (t.signalStrengthPercent !== undefined) agent.telemetry.signalStrengthPercent = Number(t.signalStrengthPercent);
          if (t.position) agent.position = { ...(t.position as MarsCoordinate) };
          agent.telemetry.lastHeartbeat = event.timestamp;
          agent.lastUpdated = event.timestamp;
        } else {
          this.reconstructionWarnings.push(`Event ${event.eventId} (TELEMETRY_UPDATED) missing target agent telemetry.`);
        }
        break;

      case "PACKET_QUEUED":
      case "PACKET_BUFFERED":
      case "PACKET_DELIVERED": {
        const pktId = String(p.packetId || event.entityId || event.eventId);
        this.reconstructedPackets[pktId] = {
          packetId: pktId,
          sourceAgentId: p.sourceAgentId || event.agentId || actor,
          priority: p.priority || "HIGH",
          type: p.type || "TELEMETRY",
          status: res.status || (event.eventType === "PACKET_DELIVERED" ? "DELIVERED" : event.eventType === "PACKET_BUFFERED" ? "BUFFERED" : "QUEUED"),
          updatedAt: event.timestamp,
        };
        const allPkts = Object.values(this.reconstructedPackets);
        this.metrics.packetsDeliveredCount = allPkts.filter((x: any) => x.status === "DELIVERED").length;
        this.metrics.packetsBufferedCount = allPkts.filter((x: any) => x.status === "BUFFERED").length;
        break;
      }

      case "EVA_TRANSITION":
      case "EVA_EMERGENCY_RETURN": {
        const evaId = String(p.evaSessionId || event.entityId || "eva-default");
        this.reconstructedEvaSessions[evaId] = {
          ...(this.reconstructedEvaSessions[evaId] || {}),
          id: evaId,
          status: res.status || p.nextStatus || (event.eventType === "EVA_EMERGENCY_RETURN" ? "EMERGENCY_RETURN" : "ACTIVE"),
          elapsedMinutes: res.elapsedMinutes ?? p.elapsedMinutes,
          updatedAt: event.timestamp,
        };
        break;
      }

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
            hazardId: `haz-replay-${event.eventId}`,
            location: p.coordinate as MarsCoordinate,
            classification: "SENSOR_DERIVED",
            evidenceType: "SENSOR_EVIDENCE",
            estimatedSlopeDeg: Number(p.slopeDeg || 21.4),
            uncertaintyDeg: 0.9,
            confidenceInterval: [20.5, 22.3],
            obstacleProbability: 0.85,
            corroboratingSensors: ["HAZCAM"],
            actionableWarning: String(p.reason || "Replay event hazard detection"),
            requiresReplan: true,
            provenance: event.provenance,
          });
        } else {
          this.reconstructionWarnings.push(`Legacy event ${event.eventId} (HAZARD_DETECTED) lacks hazard coordinates.`);
        }
        break;

      case "COMMAND_ISSUED":
      case "COMMAND_EXECUTED":
        if (agent) {
          const cmd = String(p.command || p.action || "");
          if (cmd === "PAUSE") agent.status = "PAUSED";
          else if (cmd === "RESUME" || cmd === "START") agent.status = "EXECUTING";
          else if (cmd === "EMERGENCY_STOP") agent.status = "EMERGENCY";
          else if (cmd === "RETURN_TO_BASE") agent.status = "RETURNING";
          if (p.nextStatus) agent.status = String(p.nextStatus) as any;
          agent.lastUpdated = event.timestamp;
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
      if (p.batteryPercent !== undefined && event.eventType !== "TELEMETRY_UPDATED") {
        agent.telemetry.batteryPercent = Number(p.batteryPercent);
      } else if (agent.status === "EXECUTING" && event.eventType !== "TELEMETRY_UPDATED") {
        agent.telemetry.batteryPercent = Math.max(10, Number((agent.telemetry.batteryPercent - 0.2).toFixed(1)));
        this.metrics.batteryDepletedPercent = Number((this.metrics.batteryDepletedPercent + 0.2).toFixed(1));
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
