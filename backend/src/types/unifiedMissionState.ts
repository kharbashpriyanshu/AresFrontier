import { z } from "zod";
import {
  MarsCoordinate,
  MarsRoute,
  RoutePoint,
  ScienceTarget,
  ScienceObjectiveId,
  RouteCandidate,
  Hazard,
  FusedHazardReport,
  DataProvenance,
  DataMode,
  MissionParameters,
  EVAAssessment,
  MissionEventRecord,
  CommunicationPacket,
  SensorObservation,
} from "./index.js";
import {
  PlanetaryAgent,
  AstronautAgent,
  RoverAgent,
  OrbiterAgent,
  AgentTask,
} from "../services/agents/agentTypes.js";
import {
  CommunicationLink,
  NetworkTopology,
} from "../services/comms/communicationEngine.js";
import { OrbitalVisibilityWindow } from "./index.js";
import { ScienceQueueItem } from "../services/operations/multiAgentCoordinator.js";
import { ReplanProposal } from "../services/operations/replanningEngine.js";
import { SimulationState } from "../services/operations/missionOperationsEngine.js";
import { WhatIfSimulationResult } from "../services/simulation/whatIfSimulationEngine.js";
import { MonteCarloResult } from "../services/simulation/monteCarloEngine.js";
import { FailureInjectionResult } from "../services/simulation/failureInjectionEngine.js";
import { ReplayState } from "../services/replay/replayTypes.js";
import {
  DecisionLineageGraph,
  DecisionNode,
} from "../services/intelligence/decisionLineageService.js";
import {
  AuditVerificationResult,
} from "./index.js";
import { InvariantValidationReport } from "../services/validation/validationTypes.js";

// ============================================================================
// 1. Mission Metadata & Lifecycle Configuration
// ============================================================================

export type MissionLifecycleStatus =
  | "DRAFT"
  | "PLANNED"
  | "ASSESSED"
  | "APPROVED"
  | "LOCKED"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ABORTED"
  | "DEGRADED";

export type MissionPhase =
  | "PRE_MISSION_CHECK"
  | "SURFACE_TRAVERSE"
  | "SCIENCE_SURVEY"
  | "SAMPLE_EXTRACTION"
  | "EMERGENCY_STANDBY"
  | "POST_EVA_RECOVERY";

export interface MissionMetadata {
  id: string;
  name: string;
  sol: number;
  missionPhase: MissionPhase;
  status: MissionLifecycleStatus;
  commanderId: string;
  createdAt: string;
  updatedAt: string;
  activeRouteId?: string;
  parameters: MissionParameters;
  tags?: string[];
}

// ============================================================================
// 2. Mission Objectives & Priorities
// ============================================================================

export type OperationalObjectiveType =
  | "SAMPLE_RETURN_CACHING"
  | "ISRU_WATER_ICE_PROSPECTING"
  | "COMMUNICATION_RELAY_DEPLOYMENT"
  | "EMERGENCY_EXTRACTION_RECON"
  | "LONG_RANGE_SCOUTING"
  | "HABITAT_SITE_SURVEY";

export interface OperationalObjective {
  id: string;
  type: OperationalObjectiveType;
  title: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "QUEUED" | "IN_PROGRESS" | "ACHIEVED" | "BLOCKED";
  assignedAgentCallsign?: string;
  targetCoordinate?: MarsCoordinate;
  successCriteria: string;
}

export interface MissionObjectivesState {
  primaryScienceObjective: ScienceObjectiveId;
  secondaryScienceObjectives: ScienceObjectiveId[];
  operationalObjectives: OperationalObjective[];
  scienceWeight: number; // 0.0 - 1.0
  safetyWeight: number;  // 0.0 - 1.0
  efficiencyWeight: number; // 0.0 - 1.0
}

// ============================================================================
// 3. Scientific Targets & Geological Context
// ============================================================================

export interface RegionalGeologyState {
  siteName: string;
  geologicalUnit: string;
  stratigraphicContext: string;
  mineralogyContext: string;
  thermalInertiaContext: string;
  iceResourceProspects: string;
  regionalElevationDatumM: number;
  averageRoughnessIndex: number;
  dataSourceAttribution: string;
}

export interface ScientificTargetState {
  targets: ScienceTarget[];
  selectedTargetIds: string[];
  samplePriorities: Record<string, string[]>;
  targetsCollectedCount: number;
}

// ============================================================================
// 4. Planetary Fleet State (Rover, Astronaut, Orbiter)
// ============================================================================

export interface FleetState {
  astronauts: AstronautAgent[];
  rovers: RoverAgent[];
  orbiters: OrbiterAgent[];
  activeAgentIds: string[];
  lastTelemetrySync: string;
}

// ============================================================================
// 5. Routes & Waypoints State
// ============================================================================

export interface RouteState {
  activeRouteId: string | null;
  routes: Record<string, MarsRoute>;
  candidateProfiles: RouteCandidate[];
  activeWaypoints: RoutePoint[];
  totalTraverseDistanceKm: number;
  totalEstimatedMinutes: number;
}

// ============================================================================
// 6. Hazard Intelligence & Corroboration State
// ============================================================================

export interface HazardState {
  catalogHazards: Hazard[];
  derivedSlopeHazards: Hazard[];
  sensorCorroboratedHazards: FusedHazardReport[];
  activeRiskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  unmitigatedHazardsCount: number;
}

// ============================================================================
// 7. Battery, Power & Consumables State
// ============================================================================

export interface ResourceState {
  fleetBatterySoc: Record<string, number>;
  minBatteryReservePercent: number; // default 20.0
  powerGenerationMode: Record<string, "SOLAR" | "RTG" | "BATTERY_ONLY">;
  astronautOxygenReserveMinutes: number;
  astronautMetabolicWatts: number;
  sampleTubeStorage: {
    totalTubes: number;
    sealedTubes: number;
    remainingCapacity: number;
  };
  onboardDataStorageGb: {
    totalCapacityGb: number;
    usedGb: number;
    bufferedTelemetryMb: number;
  };
}

// ============================================================================
// 8. Communication Network & Topology State
// ============================================================================

export interface CommunicationState {
  networkTopology: NetworkTopology;
  activeLinks: CommunicationLink[];
  orbitalPass?: OrbitalVisibilityWindow;
  packetQueue: CommunicationPacket[];
  blackoutActive: boolean;
  lineOfSightToRelay: Record<string, boolean>;
}

// ============================================================================
// 9. Mission Tasks & Collaborative Allocations
// ============================================================================

export interface TaskState {
  tasks: AgentTask[];
  scienceQueue: ScienceQueueItem[];
  replanProposals: ReplanProposal[];
  completedTasksCount: number;
}

// ============================================================================
// 10. Simulation, What-If & Uncertainty State
// ============================================================================

export interface SimulationStateSlice {
  simState: SimulationState;
  monteCarlo: MonteCarloResult | null;
  whatIfBranches: WhatIfSimulationResult[];
  injectedFailures: FailureInjectionResult[];
}

// ============================================================================
// 11. Digital Twin Representation State
// ============================================================================

export interface DigitalTwinStateSlice {
  twinMode: "STANDBY" | "LIVE_SYNCHRONIZED" | "REPLAY_DISPATCH" | "SANDBOX_BRANCH";
  replayCursor: ReplayState | null;
  telemetryDeviationScore: number;
  lastSynchronizedAt: string;
}

// ============================================================================
// 12. Decisions, Provenance & Validation State
// ============================================================================

export interface DecisionLineageStateSlice {
  decisionLineageGraphs: Record<string, DecisionLineageGraph>;
  latestDecisionNode: DecisionNode | null;
  auditChainVerification?: AuditVerificationResult;
}

export interface ProvenanceStateSlice {
  provenanceCatalog: Record<string, DataProvenance>;
  overallDataConfidence: number;
  dataModeDistribution: Record<DataMode, number>;
}

export interface ValidationStateSlice {
  healthScore: number;
  invariantReports: InvariantValidationReport[];
  overallSystemStatus: "NOMINAL" | "DEGRADED" | "CRITICAL" | "PAUSED";
}

export interface EventHistoryStateSlice {
  totalEvents: number;
  recentEvents: MissionEventRecord[];
  latestEventHash?: string;
}

// ============================================================================
// CANONICAL UNIFIED MISSION STATE INTERFACE
// ============================================================================

export interface UnifiedMissionState {
  schemaVersion: "1.0.0";
  missionId: string;
  savedAt: string;
  metadata: MissionMetadata;
  objectives: MissionObjectivesState;
  scienceTargets: ScientificTargetState;
  fleet: FleetState;
  routes: RouteState;
  geology: RegionalGeologyState;
  hazards: HazardState;
  resources: ResourceState;
  communication: CommunicationState;
  tasks: TaskState;
  simulation: SimulationStateSlice;
  digitalTwin: DigitalTwinStateSlice;
  lineage: DecisionLineageStateSlice;
  provenance: ProvenanceStateSlice;
  validation: ValidationStateSlice;
  events: EventHistoryStateSlice;
}

export type DomainKey =
  | "metadata"
  | "objectives"
  | "scienceTargets"
  | "fleet"
  | "routes"
  | "geology"
  | "hazards"
  | "resources"
  | "communication"
  | "tasks"
  | "simulation"
  | "digitalTwin"
  | "lineage"
  | "provenance"
  | "validation"
  | "events";

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

export const MarsCoordinateSchema = z.object({
  latitude: z.number().min(-90.0).max(90.0),
  longitude: z.number().min(-180.0).max(360.0),
});

export const MissionLifecycleStatusSchema = z.enum([
  "DRAFT",
  "PLANNED",
  "ASSESSED",
  "APPROVED",
  "LOCKED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ABORTED",
  "DEGRADED",
]);

export const MissionPhaseSchema = z.enum([
  "PRE_MISSION_CHECK",
  "SURFACE_TRAVERSE",
  "SCIENCE_SURVEY",
  "SAMPLE_EXTRACTION",
  "EMERGENCY_STANDBY",
  "POST_EVA_RECOVERY",
]);

export const MissionParametersSchema = z.object({
  routeId: z.string().optional(),
  startCoordinate: MarsCoordinateSchema.default({ latitude: 18.4447, longitude: 77.4508 }),
  destinationCoordinate: MarsCoordinateSchema.optional(),
  maxDurationMinutes: z.number().positive().default(240),
  astronautSkillLevel: z.enum(["standard", "expert"]).default("standard"),
  returnRequired: z.boolean().default(true),
  contingencyMarginMinutes: z.number().min(0).default(30),
});

export const MissionMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sol: z.number().int().min(0).default(100),
  missionPhase: MissionPhaseSchema.default("PRE_MISSION_CHECK"),
  status: MissionLifecycleStatusSchema.default("PLANNED"),
  commanderId: z.string().default("ASTRONAUT-01"),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeRouteId: z.string().optional(),
  parameters: MissionParametersSchema,
  tags: z.array(z.string()).optional(),
});

export const OperationalObjectiveSchema = z.object({
  id: z.string(),
  type: z.enum([
    "SAMPLE_RETURN_CACHING",
    "ISRU_WATER_ICE_PROSPECTING",
    "COMMUNICATION_RELAY_DEPLOYMENT",
    "EMERGENCY_EXTRACTION_RECON",
    "LONG_RANGE_SCOUTING",
    "HABITAT_SITE_SURVEY",
  ]),
  title: z.string(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  status: z.enum(["QUEUED", "IN_PROGRESS", "ACHIEVED", "BLOCKED"]).default("QUEUED"),
  assignedAgentCallsign: z.string().optional(),
  targetCoordinate: MarsCoordinateSchema.optional(),
  successCriteria: z.string(),
});

export const MissionObjectivesStateSchema = z.object({
  primaryScienceObjective: z.enum([
    "ANCIENT_WATER_ACTIVITY",
    "PAST_HABITABILITY",
    "MINERALOGICAL_DIVERSITY",
    "VOLCANIC_HISTORY",
    "SEDIMENTARY_HISTORY",
    "ASTROBIOLOGY_RELEVANCE",
  ]),
  secondaryScienceObjectives: z.array(z.string()),
  operationalObjectives: z.array(OperationalObjectiveSchema),
  scienceWeight: z.number().min(0).max(1).default(0.4),
  safetyWeight: z.number().min(0).max(1).default(0.4),
  efficiencyWeight: z.number().min(0).max(1).default(0.2),
});

export const RegionalGeologyStateSchema = z.object({
  siteName: z.string(),
  geologicalUnit: z.string(),
  stratigraphicContext: z.string(),
  mineralogyContext: z.string(),
  thermalInertiaContext: z.string(),
  iceResourceProspects: z.string(),
  regionalElevationDatumM: z.number(),
  averageRoughnessIndex: z.number().min(0).max(1),
  dataSourceAttribution: z.string(),
});

export const ResourceStateSchema = z.object({
  fleetBatterySoc: z.record(z.string(), z.number().min(0).max(100)),
  minBatteryReservePercent: z.number().min(5).max(50).default(20.0),
  powerGenerationMode: z.record(z.string(), z.enum(["SOLAR", "RTG", "BATTERY_ONLY"])),
  astronautOxygenReserveMinutes: z.number().min(0),
  astronautMetabolicWatts: z.number().min(0),
  sampleTubeStorage: z.object({
    totalTubes: z.number().int().min(0),
    sealedTubes: z.number().int().min(0),
    remainingCapacity: z.number().int().min(0),
  }),
  onboardDataStorageGb: z.object({
    totalCapacityGb: z.number().positive(),
    usedGb: z.number().min(0),
    bufferedTelemetryMb: z.number().min(0),
  }),
});

export const ValidationStateSchema = z.object({
  healthScore: z.number().min(0).max(100),
  invariantReports: z.array(z.any()),
  overallSystemStatus: z.enum(["NOMINAL", "DEGRADED", "CRITICAL", "PAUSED"]),
});

export const UnifiedMissionStateSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  missionId: z.string().min(1),
  savedAt: z.string(),
  metadata: MissionMetadataSchema,
  objectives: MissionObjectivesStateSchema,
  scienceTargets: z.object({
    targets: z.array(z.any()),
    selectedTargetIds: z.array(z.string()),
    samplePriorities: z.record(z.string(), z.array(z.string())),
    targetsCollectedCount: z.number().int().min(0),
  }),
  fleet: z.object({
    astronauts: z.array(z.any()),
    rovers: z.array(z.any()),
    orbiters: z.array(z.any()),
    activeAgentIds: z.array(z.string()),
    lastTelemetrySync: z.string(),
  }),
  routes: z.object({
    activeRouteId: z.string().nullable(),
    routes: z.record(z.string(), z.any()),
    candidateProfiles: z.array(z.any()),
    activeWaypoints: z.array(z.any()),
    totalTraverseDistanceKm: z.number().min(0),
    totalEstimatedMinutes: z.number().min(0),
  }),
  geology: RegionalGeologyStateSchema,
  hazards: z.object({
    catalogHazards: z.array(z.any()),
    derivedSlopeHazards: z.array(z.any()),
    sensorCorroboratedHazards: z.array(z.any()),
    activeRiskLevel: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
    unmitigatedHazardsCount: z.number().int().min(0),
  }),
  resources: ResourceStateSchema,
  communication: z.object({
    networkTopology: z.any(),
    activeLinks: z.array(z.any()),
    orbitalPass: z.any().optional(),
    packetQueue: z.array(z.any()),
    blackoutActive: z.boolean(),
    lineOfSightToRelay: z.record(z.string(), z.boolean()),
  }),
  tasks: z.object({
    tasks: z.array(z.any()),
    scienceQueue: z.array(z.any()),
    replanProposals: z.array(z.any()),
    completedTasksCount: z.number().int().min(0),
  }),
  simulation: z.object({
    simState: z.any(),
    monteCarlo: z.any().nullable(),
    whatIfBranches: z.array(z.any()),
    injectedFailures: z.array(z.any()),
  }),
  digitalTwin: z.object({
    twinMode: z.enum(["STANDBY", "LIVE_SYNCHRONIZED", "REPLAY_DISPATCH", "SANDBOX_BRANCH"]),
    replayCursor: z.any().nullable(),
    telemetryDeviationScore: z.number().min(0),
    lastSynchronizedAt: z.string(),
  }),
  lineage: z.object({
    decisionLineageGraphs: z.record(z.string(), z.any()),
    latestDecisionNode: z.any().nullable(),
    auditChainVerification: z.any().optional(),
  }),
  provenance: z.object({
    provenanceCatalog: z.record(z.string(), z.any()),
    overallDataConfidence: z.number().min(0).max(1),
    dataModeDistribution: z.record(z.string(), z.number()),
  }),
  validation: ValidationStateSchema,
  events: z.object({
    totalEvents: z.number().int().min(0),
    recentEvents: z.array(z.any()),
    latestEventHash: z.string().optional(),
  }),
});
