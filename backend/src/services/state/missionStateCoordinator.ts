import fs from "fs";
import path from "path";
import {
  UnifiedMissionState,
  UnifiedMissionStateSchema,
  DomainKey,
  MissionMetadata,
  MissionObjectivesState,
  FleetState,
  RouteState,
  HazardState,
  ResourceState,
  CommunicationState,
  TaskState,
  SimulationStateSlice,
  DigitalTwinStateSlice,
  RegionalGeologyState,
  ScientificTargetState,
  DecisionLineageStateSlice,
  ProvenanceStateSlice,
  ValidationStateSlice,
  EventHistoryStateSlice,
} from "../../types/unifiedMissionState.js";
import { AgentRegistry } from "../agents/agentRegistry.js";
import { AgentStateStore } from "../agents/agentStateStore.js";
import { MissionOperationsEngine } from "../operations/missionOperationsEngine.js";
import { MultiAgentCoordinator } from "../operations/multiAgentCoordinator.js";
import { ReplanningEngine } from "../operations/replanningEngine.js";
import { CommunicationEngine } from "../comms/communicationEngine.js";
import { CommunicationQueueService } from "../comms/communicationQueueService.js";
import { ObservationStore } from "../sensors/observationStore.js";
import { hazardEngine } from "../hazard/hazardEngine.js";
import { scienceObjectiveEngine } from "../science/scienceObjectiveEngine.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../nasa/adapters/benchmarkData.js";
import { missionRepository } from "../../repositories/missionRepository.js";
import { MissionValidationEngine } from "../validation/missionValidationEngine.js";
import { MissionEventStore } from "../persistence/missionEventStore.js";
import { auditChainService } from "../security/auditChainService.js";
import { ProvenanceService } from "../planetary/provenanceService.js";
import { DecisionLineageService } from "../intelligence/decisionLineageService.js";
import { MissionReplayEngine } from "../replay/missionReplayEngine.js";
import { ScienceObjectiveId, DataMode } from "../../types/index.js";
import { AstronautAgent, RoverAgent, OrbiterAgent } from "../agents/agentTypes.js";

import { CANONICAL_BACKEND_DATA_DIR } from "../../utils/dataDir.js";

const baseDataDir = CANONICAL_BACKEND_DATA_DIR;

export class MissionStateCoordinator {
  private static stateFilePath: string = path.resolve(baseDataDir, "unified_mission_state.json");
  private static cachedState: UnifiedMissionState | null = null;
  private static missionStates: Map<string, UnifiedMissionState> = new Map();
  private static writeMutex: Promise<void> = Promise.resolve();

  /**
   * Initializes the coordinator, loading persisted unified state if available,
   * or synthesizing canonical state from initialized subsystems.
   */
  public static initialize(): void {
    if (!fs.existsSync(baseDataDir)) {
      try {
        fs.mkdirSync(baseDataDir, { recursive: true });
      } catch {
        // Fallback
      }
    }

    this.loadFromDisk();
    if (!this.cachedState) {
      this.cachedState = this.synthesizeCanonicalState("MARSWALK-001");
      this.saveToDisk();
    }
  }

  /**
   * Constructs the complete canonical 18-domain mission state from active subsystems.
   */
  public static synthesizeCanonicalState(missionId: string = "MARSWALK-001"): UnifiedMissionState {
    const agents = AgentRegistry.getAllAgents();
    const astronauts = agents.filter((a) => a.type === "ASTRONAUT") as AstronautAgent[];
    const rovers = agents.filter((a) => a.type === "ROVER") as RoverAgent[];
    const orbiters = agents.filter((a) => a.type === "ORBITER") as OrbiterAgent[];

    const simState = MissionOperationsEngine.getSimulationState();
    const network = CommunicationEngine.evaluateNetwork(agents, simState.simulationTimeMinutes);
    const commQueue = CommunicationQueueService.getQueue();
    const scienceQueue = MultiAgentCoordinator.getScienceQueue();
    const replanProposals = ReplanningEngine.getActiveProposals();
    const validation = MissionValidationEngine.validateMission(missionId);
    const catalogHazards = hazardEngine.getAllHazards();
    const events = MissionEventStore.getEvents(500);

    // Fleet battery telemetry
    const fleetBatterySoc: Record<string, number> = {};
    const powerGenerationMode: Record<string, "SOLAR" | "RTG" | "BATTERY_ONLY"> = {};
    const lineOfSightToRelay: Record<string, boolean> = {};

    rovers.forEach((r) => {
      fleetBatterySoc[r.callsign] = r.telemetry.batteryPercent;
      powerGenerationMode[r.callsign] = r.profileRole === "SCOUT" ? "SOLAR" : "RTG";
      lineOfSightToRelay[r.callsign] = r.telemetry.lineOfSightToRelay;
    });
    astronauts.forEach((a) => {
      fleetBatterySoc[a.callsign] = a.telemetry.batteryPercent;
      powerGenerationMode[a.callsign] = "BATTERY_ONLY";
      lineOfSightToRelay[a.callsign] = a.telemetry.lineOfSightToRelay;
    });

    // Lead astronaut vitals
    const leadAstronaut = astronauts[0];
    const astronautOxygenReserve = leadAstronaut ? (leadAstronaut.suitOxygenReserveMinutes || 240) : 240;
    const astronautMetabolicWatts = leadAstronaut ? (leadAstronaut.metabolicEnergyWatts || 280) : 280;

    // Active route from repository (never overwrite with empty stub)
    const storedMission = missionRepository.getMissionByIdSync(missionId);
    const defaultRouteId = storedMission?.routeId || "route-jezero-delta-sol100";
    const repoRoute = missionRepository.getRouteByIdSync(defaultRouteId) || missionRepository.getRouteByIdSync("route-jezero-delta-sol100");
    const defaultRoute = repoRoute || {
      id: defaultRouteId,
      name: "Jezero Delta Front & Séítah Exploration Traverse",
      points: [],
      segments: [],
      totalDistanceKm: 4.14,
      estimatedDurationMinutes: 129,
      elevationProfile: [],
      elevationGainM: 65,
      elevationLossM: 45,
      maxSlopeDegrees: 3.8,
      overallDifficulty: "low" as const,
      createdAt: new Date().toISOString(),
    };

    const routesMap: Record<string, any> = {
      [defaultRoute.id]: defaultRoute,
    };

    // Metadata (synced with StoredMission if present in repository)
    const resolvedRouteId = defaultRoute.id;
    const metadata: MissionMetadata = {
      id: missionId,
      name: storedMission?.name || (missionId.startsWith("MARSWALK") ? `Marswalk-001 (Jezero Crater Astrobiology Traverse - ${missionId})` : `EVA Mission (${missionId})`),
      sol: 100,
      missionPhase: "SURFACE_TRAVERSE",
      status: storedMission?.status || "APPROVED",
      commanderId: leadAstronaut ? leadAstronaut.callsign : "ASTRONAUT-01",
      createdAt: storedMission?.createdAt || new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      updatedAt: storedMission?.updatedAt || new Date().toISOString(),
      activeRouteId: resolvedRouteId,
      parameters: storedMission?.parameters || {
        routeId: resolvedRouteId,
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        maxDurationMinutes: 240,
        astronautSkillLevel: "standard",
        returnRequired: true,
      },
      tags: ["EVA", "Astrobiology", "Jezero-Western-Delta", "Multi-Agent"],
    };

    // Objectives
    const objectives: MissionObjectivesState = {
      primaryScienceObjective: storedMission?.objectiveId || "ANCIENT_WATER_ACTIVITY",
      secondaryScienceObjectives: ["PAST_HABITABILITY", "MINERALOGICAL_DIVERSITY"],
      operationalObjectives: [
        {
          id: "op-obj-01",
          type: "SAMPLE_RETURN_CACHING",
          title: "Collect Bottomset Mudstone Core at Kodiak Remnant",
          priority: "CRITICAL",
          status: "IN_PROGRESS",
          assignedAgentCallsign: "ROVER-02 SCIENCE",
          successCriteria: "Extract 1 hermetically sealed drill core tube with >20g rock sample",
        },
        {
          id: "op-obj-02",
          type: "LONG_RANGE_SCOUTING",
          title: "Scout Northern Delta Front Scarp Incline",
          priority: "HIGH",
          status: "IN_PROGRESS",
          assignedAgentCallsign: "ROVER-01 SCOUT",
          successCriteria: "Map slope gradients below 20 degrees with 0.25m lidar resolution",
        },
        {
          id: "op-obj-03",
          type: "COMMUNICATION_RELAY_DEPLOYMENT",
          title: "Maintain Line-of-Sight UHF Relay for Surface Crew",
          priority: "HIGH",
          status: "ACHIEVED",
          assignedAgentCallsign: "ROVER-03 RELAY",
          successCriteria: "Zero surface crew communication blackout duration during EVA egress",
        },
      ],
      scienceWeight: 0.45,
      safetyWeight: 0.40,
      efficiencyWeight: 0.15,
    };

    // Science Targets
    const scienceTargets: ScientificTargetState = {
      targets: VERIFIED_NASA_SCIENCE_TARGETS,
      selectedTargetIds: ["tgt-kodiak-butte", "tgt-seitah-olivine", "tgt-belva-crater-rim"],
      samplePriorities: {
        "tgt-kodiak-butte": ["Fine-grained silts", "Bottomset clay layers"],
        "tgt-seitah-olivine": ["Olivine cumulate core", "Carbonate cement"],
        "tgt-belva-crater-rim": ["Impact melt glass", "Basement megabreccia"],
      },
      targetsCollectedCount: 1,
    };

    // Fleet
    const fleet: FleetState = {
      astronauts,
      rovers,
      orbiters,
      activeAgentIds: agents.map((a) => a.id),
      lastTelemetrySync: new Date().toISOString(),
    };

    // Routes
    const routes: RouteState = {
      activeRouteId: defaultRouteId,
      routes: routesMap,
      candidateProfiles: [],
      activeWaypoints: [],
      totalTraverseDistanceKm: 4.14,
      totalEstimatedMinutes: 129,
    };

    // Regional Geology
    const geology: RegionalGeologyState = {
      siteName: "Jezero Crater Western Fan (Octavia E. Butler Landing)",
      geologicalUnit: "Nf-ld (Noachian-Hesperian Fluvial-Lacustrine Deltaic Unit)",
      stratigraphicContext: "Gilbert-type delta foreset/bottomset succession overlying olivine floor unit",
      mineralogyContext: "Fe/Mg smectite clays, magnesium carbonates, olivine phenocrysts (CRISM/PIXL)",
      thermalInertiaContext: "Bedrock outcrops ~450 J m^-2 K^-1 s^-1/2; sand dunes ~180 J m^-2 K^-1 s^-1/2",
      iceResourceProspects: "Low direct near-surface ice; high potential for clay mineral structural bound water",
      regionalElevationDatumM: -2530,
      averageRoughnessIndex: 0.35,
      dataSourceAttribution: "NASA Mars 2020 Mission Archive & MGS MOLA MEGDR",
    };

    // Hazards
    const hazards: HazardState = {
      catalogHazards,
      derivedSlopeHazards: [],
      sensorCorroboratedHazards: [],
      activeRiskLevel: "MODERATE",
      unmitigatedHazardsCount: 0,
    };

    // Resources
    const resources: ResourceState = {
      fleetBatterySoc,
      minBatteryReservePercent: 20.0,
      powerGenerationMode,
      astronautOxygenReserveMinutes: astronautOxygenReserve,
      astronautMetabolicWatts: astronautMetabolicWatts,
      sampleTubeStorage: {
        totalTubes: 43,
        sealedTubes: 24,
        remainingCapacity: 19,
      },
      onboardDataStorageGb: {
        totalCapacityGb: 128,
        usedGb: 42.6,
        bufferedTelemetryMb: 14.2,
      },
    };

    // Communication
    const communication: CommunicationState = {
      networkTopology: network,
      activeLinks: network.links,
      orbitalPass: network.orbitalVisibility,
      packetQueue: commQueue,
      blackoutActive: !network.missionControlReachable,
      lineOfSightToRelay,
    };

    // Tasks
    const tasks: TaskState = {
      tasks: [],
      scienceQueue,
      replanProposals,
      completedTasksCount: 4,
    };

    // Simulation
    const simulation: SimulationStateSlice = {
      simState,
      monteCarlo: null,
      whatIfBranches: [],
      injectedFailures: [],
    };

    // Digital Twin
    const replayState = MissionReplayEngine.getReplayState();
    const digitalTwin: DigitalTwinStateSlice = {
      twinMode: "LIVE_SYNCHRONIZED",
      replayCursor: replayState,
      telemetryDeviationScore: 0.02,
      lastSynchronizedAt: new Date().toISOString(),
    };

    // Decision Lineage
    const lineage: DecisionLineageStateSlice = {
      decisionLineageGraphs: {},
      latestDecisionNode: null,
      auditChainVerification: auditChainService.verifyChain(),
    };

    // Provenance
    const dataModeDist: Record<DataMode, number> = {
      BENCHMARK: 12,
      CACHED: 8,
      LIVE: 3,
      FALLBACK: 4,
      DERIVED: 9,
      SIMULATED: 6,
      HEURISTIC: 2,
      DEMO: 1,
    };

    const provenance: ProvenanceStateSlice = {
      provenanceCatalog: {
        mola: ProvenanceService.createMolaProvenance("BENCHMARK_DATA"),
        viking: ProvenanceService.createVikingProvenance(),
        hirise: ProvenanceService.createHiriseProvenance("PSP_002172_1985"),
      },
      overallDataConfidence: 0.94,
      dataModeDistribution: dataModeDist,
    };

    // Validation
    const validationSlice: ValidationStateSlice = {
      healthScore: validation.health ? validation.health.overallScore : 89,
      invariantReports: validation.invariants || [],
      overallSystemStatus: validation.overallStatus === "VALID" ? "NOMINAL" : "DEGRADED",
    };

    // Event History
    const eventHistory: EventHistoryStateSlice = {
      totalEvents: events.length,
      recentEvents: events.slice(-20),
      latestEventHash: events.length > 0 ? events[events.length - 1].eventHash : undefined,
    };

    return {
      schemaVersion: "1.0.0",
      missionId,
      savedAt: new Date().toISOString(),
      metadata,
      objectives,
      scienceTargets,
      fleet,
      routes,
      geology,
      hazards,
      resources,
      communication,
      tasks,
      simulation,
      digitalTwin,
      lineage,
      provenance,
      validation: validationSlice,
      events: eventHistory,
    };
  }

  // ==========================================================================
  // Canonical State Retrieval & Updates
  // ==========================================================================

  public static getCanonicalState(missionId?: string): UnifiedMissionState {
    const targetId = missionId || this.cachedState?.missionId || "MARSWALK-001";
    const existing = this.missionStates.get(targetId);
    if (existing) {
      this.cachedState = existing;
      return existing;
    }
    if (this.cachedState && this.cachedState.missionId === targetId) {
      this.missionStates.set(targetId, this.cachedState);
      return this.cachedState;
    }
    const synthesized = this.synthesizeCanonicalState(targetId);
    this.missionStates.set(targetId, synthesized);
    this.cachedState = synthesized;
    return synthesized;
  }

  public static invalidateMissionState(missionId: string): void {
    this.missionStates.delete(missionId);
    if (this.cachedState?.missionId === missionId) {
      this.cachedState = null;
    }
  }

  /**
   * Updates a specific domain of the unified state, validates it,
   * synchronizes dependent subsystems, and writes atomically to disk.
   */
  public static updateDomain<K extends DomainKey>(
    domain: K,
    patch: Partial<UnifiedMissionState[K]>,
    actorId: string = "MISSION_COMMAND",
    missionId?: string
  ): UnifiedMissionState {
    const currentState = this.getCanonicalState(missionId);

    const updatedDomain = {
      ...currentState[domain],
      ...patch,
    };

    const updatedState: UnifiedMissionState = {
      ...currentState,
      savedAt: new Date().toISOString(),
      [domain]: updatedDomain,
      metadata: {
        ...(domain === "metadata" ? (updatedDomain as MissionMetadata) : currentState.metadata),
        updatedAt: new Date().toISOString(),
      },
    };

    // Synchronize to underlying domain subsystems
    this.synchronizeDomainToSubsystems(domain, updatedDomain);

    // Validate updated canonical state
    const validation = UnifiedMissionStateSchema.safeParse(updatedState);
    if (!validation.success) {
      const errorMsg = validation.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      throw new Error(`Domain update rejected due to schema violation: ${errorMsg}`);
    }

    this.cachedState = updatedState;
    this.missionStates.set(updatedState.missionId, updatedState);

    // Record audit event
    auditChainService.appendEvent({
      userId: actorId,
      role: "MISSION_COMMAND",
      action: "OPTIMIZE_ROUTE",
      missionPlanId: currentState.missionId,
      details: {
        domainUpdated: domain,
        timestamp: updatedState.savedAt,
      },
    });

    this.saveToDisk();
    return updatedState;
  }

  private static synchronizeDomainToSubsystems(domain: DomainKey, data: any): void {
    try {
      if (domain === "fleet" && data.rovers && Array.isArray(data.rovers)) {
        data.rovers.forEach((r: RoverAgent) => AgentRegistry.updateAgent(r));
      }
      if (domain === "fleet" && data.astronauts && Array.isArray(data.astronauts)) {
        data.astronauts.forEach((a: AstronautAgent) => AgentRegistry.updateAgent(a));
      }
      if (domain === "communication" && data.packetQueue) {
        CommunicationQueueService.setQueue(data.packetQueue);
      }
      if (domain === "routes" && data.routes) {
        Object.values(data.routes).forEach((r: any) => {
          if (r && r.id && Array.isArray(r.points) && r.points.length >= 2) {
            missionRepository.saveRoute(r);
          }
        });
      }
    } catch (err) {
      console.warn(`[MissionStateCoordinator] Warning during subsystem synchronization for domain ${domain}:`, err);
    }
  }

  // ==========================================================================
  // Persistence: Atomic Write & Corrupted File Safe Recovery
  // ==========================================================================

  public static saveToDisk(): boolean {
    if (!this.cachedState) return false;

    try {
      if (!fs.existsSync(baseDataDir)) {
        fs.mkdirSync(baseDataDir, { recursive: true });
      }

      const tmpPath = `${this.stateFilePath}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.cachedState, null, 2), "utf-8");
      const fd = fs.openSync(tmpPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fs.renameSync(tmpPath, this.stateFilePath);
      return true;
    } catch (err) {
      console.error("[MissionStateCoordinator] Failed atomic write of unified mission state:", err);
      return false;
    }
  }

  public static loadFromDisk(): boolean {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return false;
      }

      const raw = fs.readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw);

      const validation = UnifiedMissionStateSchema.safeParse(parsed);
      if (validation.success) {
        this.cachedState = validation.data as unknown as UnifiedMissionState;
        return true;
      } else {
        console.warn("[MissionStateCoordinator] Unified state schema mismatch on disk. Re-synthesizing canonical state.");
        return false;
      }
    } catch (err) {
      console.warn("[MissionStateCoordinator] Corrupted unified state on disk. Safely restoring defaults.", err);
      this.backupCorruptedState();
      return false;
    }
  }

  private static backupCorruptedState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const backupPath = `${this.stateFilePath}.corrupted.${Date.now()}`;
        fs.renameSync(this.stateFilePath, backupPath);
      }
    } catch {
      // Ignore
    }
  }

  public static resetState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
      }
    } catch {
      // Ignore
    }
    this.cachedState = null;
    this.missionStates.clear();
  }
}
