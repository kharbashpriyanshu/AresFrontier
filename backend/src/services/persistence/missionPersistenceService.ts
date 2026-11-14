import fs from "fs";
import path from "path";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore, OperationEvent } from "../agents/agentStateStore.js";
import { ReplanningEngine, ReplanProposal } from "../operations/replanningEngine.js";
import { MultiAgentCoordinator, ScienceQueueItem } from "../operations/multiAgentCoordinator.js";
import { MissionOperationsEngine, SimulationState } from "../operations/missionOperationsEngine.js";
import { auditChainService } from "../security/auditChainService.js";
import { PlanetaryAgent } from "../agents/agentTypes.js";
import { SensorObservation, CommunicationPacket } from "../../types/index.js";
import { ObservationStore } from "../sensors/observationStore.js";
import { CommunicationQueueService } from "../comms/communicationQueueService.js";

export interface PersistedMissionState {
  version: string;
  savedAt: string;
  simState: SimulationState;
  agents: PlanetaryAgent[];
  events: OperationEvent[];
  scienceQueue: ScienceQueueItem[];
  replanProposals: ReplanProposal[];
  observations?: SensorObservation[];
  communicationQueue?: CommunicationPacket[];
  missionStatus?: "NOMINAL" | "DEGRADED" | "CRITICAL" | "PAUSED";
}

const baseDataDir = process.cwd().endsWith("backend")
  ? path.resolve(process.cwd(), "data")
  : path.resolve(process.cwd(), "backend", "data");

export class MissionPersistenceService {
  private static storageDir: string = baseDataDir;
  private static stateFilePath: string = path.resolve(baseDataDir, "mission_state.json");
  private static checkpointsDir: string = path.resolve(baseDataDir, "checkpoints");

  public static initialize(): void {
    if (!fs.existsSync(this.storageDir)) {
      try {
        fs.mkdirSync(this.storageDir, { recursive: true });
      } catch {
        // Fallback
      }
    }
    if (!fs.existsSync(this.checkpointsDir)) {
      try {
        fs.mkdirSync(this.checkpointsDir, { recursive: true });
      } catch {
        // Fallback
      }
    }

    // Try loading persistent state
    this.loadState();
  }

  /**
   * Captures the full runtime mission state and writes atomically to persistent storage.
   * Utilizes write -> fsync -> rename atomic pattern.
   */
  public static saveState(): PersistedMissionState {
    const agents = AgentRegistry.getAllAgents();
    const simState = MissionOperationsEngine.getSimulationState();
    const events = AgentStateStore.getEvents(500);
    const scienceQueue = MultiAgentCoordinator.getScienceQueue();
    const replanProposals = ReplanningEngine.getActiveProposals();
    const observations = ObservationStore.getAllObservations();
    const communicationQueue = CommunicationQueueService.getQueue();

    const state: PersistedMissionState = {
      version: "5.0.0",
      savedAt: new Date().toISOString(),
      simState,
      agents,
      events,
      scienceQueue,
      replanProposals,
      observations,
      communicationQueue,
      missionStatus: simState.isRunning ? "NOMINAL" : "PAUSED",
    };

    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }

      // 3-Phase Atomic Write
      const tmpPath = `${this.stateFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
      const fd = fs.openSync(tmpPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync(tmpPath, this.stateFilePath);
    } catch (err) {
      console.error("Failed to write persistent mission state atomically to disk", err);
    }

    return state;
  }

  /**
   * Loads saved mission state from disk and restores runtime in-memory engines.
   */
  public static loadState(): boolean {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return false;
      }

      const raw = fs.readFileSync(this.stateFilePath, "utf-8");
      const state: PersistedMissionState = JSON.parse(raw);

      if (state.simState) {
        MissionOperationsEngine.setSimulationState(state.simState);
      }

      if (state.agents && Array.isArray(state.agents)) {
        state.agents.forEach((agent) => AgentRegistry.updateAgent(agent));
      }

      if (state.events && Array.isArray(state.events)) {
        AgentStateStore.clearEvents();
        // Restore events preserving chronological order
        state.events.slice().reverse().forEach((e) => AgentStateStore.recordEvent(e));
      }

      if (state.observations && Array.isArray(state.observations)) {
        ObservationStore.clear();
        state.observations.forEach((obs) => ObservationStore.recordObservation(obs));
      }

      if (state.communicationQueue && Array.isArray(state.communicationQueue)) {
        CommunicationQueueService.setQueue(state.communicationQueue);
      }

      return true;
    } catch (err) {
      console.warn("Could not load mission state from disk. Preserving initialized defaults.", err);
      return false;
    }
  }

  /**
   * Explicit mission state reset.
   */
  public static resetMissionState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
      }
    } catch {
      // Ignore
    }
    AgentRegistry.resetAgents();
    MissionOperationsEngine.resetSimulation();
    AgentStateStore.clearEvents();
    ObservationStore.clear();
  }

  /**
   * Creates an immutable checkpoint snapshot using atomic persistence.
   */
  public static createCheckpoint(checkpointId: string): string {
    const state = this.saveState();
    const safeId = checkpointId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(this.checkpointsDir, `checkpoint-${safeId}.json`);

    try {
      if (!fs.existsSync(this.checkpointsDir)) {
        fs.mkdirSync(this.checkpointsDir, { recursive: true });
      }

      const tmpPath = `${filePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
      const fd = fs.openSync(tmpPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync(tmpPath, filePath);

      auditChainService.appendEvent({
        userId: "MISSION_PERSISTENCE",
        role: "MISSION_COMMAND",
        action: "OPTIMIZE_ROUTE",
        missionPlanId: "CHECKPOINT",
        details: { checkpointId: safeId, savedAt: state.savedAt },
      });

      return safeId;
    } catch (err) {
      throw new Error(`Failed to create checkpoint snapshot: ${err}`);
    }
  }

  /**
   * Restores state from an existing checkpoint snapshot.
   */
  public static restoreCheckpoint(checkpointId: string): boolean {
    const safeId = checkpointId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(this.checkpointsDir, `checkpoint-${safeId}.json`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Checkpoint '${safeId}' does not exist`);
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const state: PersistedMissionState = JSON.parse(raw);

    if (state.simState) {
      MissionOperationsEngine.setSimulationState(state.simState);
    }

    if (state.agents && Array.isArray(state.agents)) {
      state.agents.forEach((agent) => AgentRegistry.updateAgent(agent));
    }

    if (state.events && Array.isArray(state.events)) {
      AgentStateStore.clearEvents();
      state.events.slice().reverse().forEach((e) => AgentStateStore.recordEvent(e));
    }

    if (state.observations && Array.isArray(state.observations)) {
      ObservationStore.clear();
      state.observations.forEach((obs) => ObservationStore.recordObservation(obs));
    }

    if (state.communicationQueue && Array.isArray(state.communicationQueue)) {
      CommunicationQueueService.setQueue(state.communicationQueue);
    }

    auditChainService.appendEvent({
      userId: "MISSION_PERSISTENCE",
      role: "MISSION_COMMAND",
      action: "OPTIMIZE_ROUTE",
      missionPlanId: "CHECKPOINT_RESTORE",
      details: { checkpointId: safeId, restoredAt: new Date().toISOString() },
    });

    return true;
  }
}
