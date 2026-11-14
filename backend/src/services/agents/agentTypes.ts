import { MarsCoordinate, ScienceObjectiveId, DataProvenance } from "../../types/index.js";

export type AgentType = "ASTRONAUT" | "ROVER" | "ORBITER" | "MISSION_CONTROL";

export type AgentStatus =
  | "IDLE"
  | "PLANNING"
  | "EXECUTING"
  | "PAUSED"
  | "RETURNING"
  | "UNAVAILABLE"
  | "COMMS_LOST"
  | "EMERGENCY"
  | "COMPLETE";

export type AgentCapability =
  | "TERRAIN_RECON"
  | "SAMPLE_DRILL"
  | "SPECTROMETER"
  | "COMM_RELAY"
  | "EMERGENCY_SUPPORT"
  | "PRESSURE_SUIT"
  | "HIGH_SPEED_DRIVE"
  | "ORBITAL_IMAGERY";

export interface StructuredAgentCapabilities {
  mobility: {
    maxSlopeDeg: number;
    speedKph: number;
    maxRangeKm: number;
    roughnessTolerance: number; // 0.0 - 1.0
  };
  scientificInstruments: string[];
  hasDrill: boolean;
  hasSpectrometer: boolean;
  hasLidar: boolean;
  sampleTubeCapacity: number;
  sampleTubesRemaining: number;
  communicationRelay: {
    isRelay: boolean;
    relayRangeKm: number;
    relayBandwidthKbps: number;
  };
  resourceCapacityWh: number;
  enduranceMinutes: number;
}

export type TaskType =
  | "SURVEY_TERRAIN"
  | "INSPECT_HAZARD"
  | "COLLECT_SCIENCE"
  | "VERIFY_ROUTE"
  | "RELAY_SIGNAL"
  | "RETURN_TO_BASE"
  | "FOLLOW_ASTRONAUT"
  | "EMERGENCY_SUPPORT";

export type TaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "BLOCKED" | "CANCELLED" | "FAILED";

export interface AgentTask {
  id: string;
  missionId?: string;
  agentId: string;
  taskType: TaskType;
  priority: TaskPriority;
  name: string;
  target: {
    coordinate: MarsCoordinate;
    targetId?: string;
    description?: string;
  };
  estimatedDurationMin: number;
  requiredBatteryPercent: number;
  requiredCommunication: boolean;
  requiredCapabilities?: AgentCapability[];
  scienceObjective?: ScienceObjectiveId;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  status: TaskStatus;
  assignedAt?: string;
  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  statusReason?: string;
  outcome?: string;
  dependencies?: string[];           // Task IDs that must be COMPLETED before this starts
  collaboratingAgentIds?: string[];  // Multi-agent collaborative support
  deadlineMinutes?: number;          // Operational MET ceiling
  workloadUnits?: number;            // Normalized complexity units (1-10)
  failureReason?: string;
}

export interface AgentTelemetry {
  batteryPercent: number;
  batteryStatus: "GREEN" | "YELLOW" | "RED" | "CRITICAL";
  speedKph: number;
  headingDeg: number;
  internalTempC: number;
  signalStrengthPercent: number;
  lineOfSightToRelay: boolean;
  activeRelayId?: string;
  energyConsumptionRateWhPerKm: number;
  suitOxygenPercent?: number;
  heartRateBpm?: number;
  lastHeartbeat: string;
}

export interface PlanetaryAgent {
  id: string;
  name: string;
  callsign: string;
  type: AgentType;
  status: AgentStatus;
  position: MarsCoordinate;
  capabilities: AgentCapability[];
  structuredCapabilities?: StructuredAgentCapabilities;
  telemetry: AgentTelemetry;
  currentTask?: AgentTask;
  assignedRouteId?: string;
  activeWaypoints?: MarsCoordinate[];
  lastUpdated: string;
  provenance: DataProvenance;
}

export interface RoverAgent extends PlanetaryAgent {
  type: "ROVER";
  profileRole: "SCOUT" | "SCIENCE" | "RELAY";
  maxRangeKm: number;
  speedKph: number;
  communicationRangeKm: number;
  scientificPayloads: string[];
  mobilityRating: number; // 0.0 - 1.0 (climbing capability)
  hazardTolerance: number; // Max slope degrees tolerated (e.g., 18° vs 12°)
  batteryCapacityWh: number;
  currentBatteryWh: number;
}

export interface OrbiterAgent extends PlanetaryAgent {
  type: "ORBITER";
  orbitalAltitudeKm: number;
  inclinationDeg: number;
  orbitalPeriodMinutes: number;
  coverageRadiusKm: number;
  bandwidthKbps: number;
  nextPassWindowStart: string;
  nextPassDurationMinutes: number;
}

export interface AstronautAgent extends PlanetaryAgent {
  type: "ASTRONAUT";
  suitType: "xEMU_PLANETARY";
  suitOxygenReserveMinutes: number;
  maxContinuousEVAMinutes: number;
  metabolicEnergyWatts: number;
  safeStandbyLocation: MarsCoordinate;
}
