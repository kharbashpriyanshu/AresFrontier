export interface MarsCoordinate {
  latitude: number;
  longitude: number;
}

export interface MarsBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type TerrainDifficulty = "low" | "moderate" | "high";
export type ScientificValue = "low" | "medium" | "high";
export type RoutePointType = "start" | "waypoint" | "science" | "destination";

export interface LocationData {
  id: string;
  name: string;
  coordinate: MarsCoordinate;
  elevationM: number;
  terrainType: string;
  geologicalUnit: string;
  scienceTargetsCount: number;
  nearbyScienceTargets?: ScienceTarget[];
  nasaObservations: {
    mission: string;
    instrument: string;
    observationId: string;
    summary: string;
    landingDate?: string;
  }[];
  suitability: {
    evaRating: "optimal" | "acceptable" | "restricted" | "hazardous";
    slopeIndex: number;
    dustHazard: "low" | "moderate" | "high";
    communicationLineOfSight: boolean;
  };
  isMockData?: boolean;
}

export interface TerrainProfilePoint {
  distanceKm: number;
  elevationM: number;
  slopeDegrees: number;
  coordinate: MarsCoordinate;
}

export interface TerrainData {
  coordinate: MarsCoordinate;
  elevationM: number;
  slopeDegrees: number;
  roughnessIndex: number;
  difficulty: TerrainDifficulty;
  dataSource: string;
  isMockData?: boolean;
}

export interface ScienceTarget {
  id: string;
  coordinate: MarsCoordinate;
  name: string;
  category: "stratigraphy" | "mineralogy" | "paleohydrology" | "volcanology" | "astrobiology" | "geomorphology";
  scientificValue: ScientificValue;
  description: string;
  dataSource: string;
  potentialSamples?: string[];
  associatedFormation?: string;
  isMockData?: boolean;
}

export interface RoutePoint {
  id: string;
  coordinate: MarsCoordinate;
  type: RoutePointType;
  label?: string;
  elevationM?: number;
  targetId?: string;
}

export interface RouteSegment {
  id: string;
  start: MarsCoordinate;
  end: MarsCoordinate;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  averageSlopeDegrees: number;
  difficulty: TerrainDifficulty;
  estimatedMinutes: number;
  hazards: string[];
}

export interface MarsRoute {
  id: string;
  name: string;
  points: RoutePoint[];
  segments: RouteSegment[];
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  elevationProfile: TerrainProfilePoint[];
  elevationGainM: number;
  elevationLossM: number;
  maxSlopeDegrees: number;
  overallDifficulty: TerrainDifficulty;
  createdAt: string;
  provenance?: DataProvenance;
}

export interface MissionParameters {
  routeId?: string;
  maxDurationMinutes: number;
  startCoordinate: MarsCoordinate;
  destinationCoordinate?: MarsCoordinate;
  waypoints?: MarsCoordinate[];
  returnRequired: boolean;
  astronautSkillLevel?: "standard" | "expert";
}

export interface EVAAssessment {
  estimatedDurationMinutes: number;
  totalDistanceKm: number;
  terrainDifficulty: TerrainDifficulty;
  returnMarginMinutes: number;
  feasible: boolean;
  warnings: string[];
  oxygenReserveRemainingPercent: number;
  recommendations: string[];
}

export interface MissionAssessment {
  safetyScore: number;
  scienceScore: number;
  accessibilityScore: number;
  overallScore: number;
  confidence: number;
  warnings: string[];
  recommendedRoute?: string;
  modelIdentifier?: string;
  scoringSource: "model-generated" | "rule-based" | "fallback";
  missionStatus: "MISSION FEASIBLE" | "MISSION RESTRICTED" | "MISSION CONSTRAINT EXCEEDED";
  scoringExplanation: string;
}

export interface SystemPipelineStatus {
  molaElevation: "Available" | "Degraded" | "Offline";
  vikingImagery: "Available" | "Degraded" | "Offline";
  themisThermal: "Available" | "Degraded" | "Offline";
  scienceTargets: "Available" | "Degraded" | "Offline";
  mlService: "AI Model (Live)" | "Fallback Mode (Rule-based)";
  database: "PostgreSQL / PostGIS" | "Local In-Memory Repository";
  lastCheck: string;
}

export interface ScientificAssessment {
  geologicalContext?: string;
  mineralContext?: string;
  thermalContext?: string;
  scientificValue: ScientificValue;
  explanation: string;
  sources: string[];
  samplePriorities?: string[];
}

export interface DataSourceInfo {
  id: string;
  name: string;
  mission: string;
  type: "elevation" | "imagery" | "mineralogy" | "in-situ" | "atmospheric";
  url: string;
  status: "operational" | "degraded" | "cached_fallback" | "offline";
  lastSync: string;
  attribution: string;
  coverage: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    source?: string;
    timestamp?: string;
    cached?: boolean;
  };
}

// ============================================================================
// Phase 2: Mission Intelligence, Hazards, Objectives & Explainable Reasoning
// ============================================================================

export type SourceType =
  | "NASA"
  | "USGS"
  | "ROVER"
  | "LIVE_EXTERNAL_DATA"
  | "CACHED_DATA"
  | "BENCHMARK_DATA"
  | "BENCHMARK"
  | "AUDIT"
  | "DERIVED"
  | "HEURISTIC"
  | "DEMO"
  | "MODEL"
  | "MODEL_OUTPUT"
  | "PROJECT_RULE";

export interface DataProvenance {
  sourceType: SourceType;
  sourceName: string;
  datasetId?: string;
  observationId?: string;
  sourceUrl?: string;
  acquiredAt?: string;
  spatialResolutionM?: number;
  processingMethod?: string;
  confidence?: number;
  dataMode?: DataMode;
  uncertainty?: {
    value?: number;
    absolute?: number;
    relative?: number;
    unit?: string;
    methodology?: string;
  };
}

export type DataMode = "LIVE" | "CACHED" | "BENCHMARK" | "FALLBACK" | "SIMULATED" | "DEMO" | "DERIVED" | "HEURISTIC";

export type CoverageRating = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface DataCoverage {
  elevation: CoverageRating;
  highResImagery: CoverageRating;
  thermal: CoverageRating;
  roverEvidence: CoverageRating;
  scienceEvidence: CoverageRating;
  overallEvidence: CoverageRating;
  sourceResolutionM?: number;
  dataAgeYears?: number;
  summary: string;
  provenance: DataProvenance;
}

export interface DataEnvelope<T> {
  data: T;
  sourceType: SourceType;
  sourceName: string;
  dataMode?: DataMode;
  provenance?: DataProvenance;
}

export interface MarsObservation {
  id: string;
  source: string;
  mission?: string;
  instrument?: string;
  location: MarsCoordinate;
  observationType:
    | "elevation"
    | "thermal"
    | "imagery"
    | "mineralogy"
    | "geology"
    | "rover_observation";
  value?: number;
  unit?: string;
  confidence?: number;
  timestamp?: string;
  provenance: DataProvenance;
}

export type HazardSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type HazardType =
  | "STEEP_SLOPE"
  | "EXTREME_SLOPE"
  | "LARGE_ELEVATION_CHANGE"
  | "SCARP"
  | "ROUGH_TERRAIN"
  | "THERMAL_ANOMALY"
  | "ROUTE_BOTTLENECK"
  | "HIGH_RISK_DESCENT"
  | "LOW_DATA_CONFIDENCE"
  | "SCIENCE_TARGET_PROXIMITY_RISK";

export interface HazardEvidenceItem {
  id: string;
  description: string;
  dataset: string;
  observedMetric?: string;
  mode?: DataMode;
  feature?: string;
  provenance: DataProvenance;
}

export interface Hazard {
  id: string;
  name?: string;
  type: HazardType;
  severity: HazardSeverity;
  location: MarsCoordinate;
  radiusM?: number;
  affectedRouteSegment?: string;
  reason: string;
  recommendation?: string;
  confidence?: number;
  sourceType: SourceType;
  evidence?: HazardEvidenceItem[];
  uncertainty?: {
    absolute?: number;
    relative?: number;
    unit?: string;
    methodology?: string;
  };
  provenance?: DataProvenance;
}

export interface HazardAssessment {
  hazardScore: number; // 0 (safest) to 100 (extreme hazard)
  riskLevel: HazardSeverity;
  hazards: Hazard[];
  affectedSegments: string[];
  reasons: string[];
  mitigationSuggestions?: string[];
  coverageWarning?: string;
  provenance?: DataProvenance;
}

export type ScienceObjectiveId =
  | "ANCIENT_WATER_ACTIVITY"
  | "PAST_HABITABILITY"
  | "MINERALOGICAL_DIVERSITY"
  | "VOLCANIC_HISTORY"
  | "SEDIMENTARY_HISTORY"
  | "ASTROBIOLOGY_RELEVANCE";

export interface ScienceObjective {
  id: ScienceObjectiveId;
  name: string;
  description: string;
  preferredTargetTypes: string[];
  preferredCategories: string[];
  scoringFactors: {
    scientificValue: number;
    proximity: number;
    accessibility: number;
  };
}

export interface ScienceValueBreakdown {
  targetId?: string;
  targetName?: string;
  totalScore: number; // 0 - 100
  finalScore?: number;
  objectiveRelevance: number; // 0 - 30
  geologicalEvidence: number; // 0 - 25
  targetUniqueness: number; // 0 - 20
  dataQuality: number; // 0 - 15
  sampleDiversity: number; // 0 - 10
  components?: {
    astrobiologyPotential: number;
    stratigraphicValue: number;
    inSituVerificationBonus: number;
    sampleDiversityBonus: number;
  };
  scoringMethod: "PROJECT_RULE_FACTORIZED";
  scoringExplanation: string;
  observedEvidenceSummary: string;
  provenance: DataProvenance;
}

export interface TerrainAssessment {
  elevationM: number;
  averageSlopeDeg: number;
  maxSlopeDeg: number;
  elevationGainM: number;
  elevationLossM: number;
  traversalDifficulty: TerrainDifficulty;
  roughnessIndex?: number;
  confidence?: number;
  uncertainty?: {
    absoluteM?: number;
    slopeDegrees?: number;
    methodology: string;
  };
  sourceType: SourceType;
  provenance?: DataProvenance;
}

export interface MultiObjectiveRouteScore {
  safety: number;           // 0-100
  science: number;          // 0-100
  accessibility: number;    // 0-100
  efficiency: number;       // 0-100
  evidenceConfidence: number; // 0-100
  evaFeasibility: number;   // 0-100
  uncertaintyPenalty: number; // 0-100
  riskAdjustedScore: number;  // Expected Value - Uncertainty Penalty
  isParetoEfficient: boolean;
  paretoDominatedBy?: string[];
}

export interface RouteCandidate {
  id: string;
  name: string;
  profileType: "shortest" | "safest" | "highest_science" | "balanced";
  route: MarsRoute;
  distanceKm: number;
  estimatedDurationMin: number;
  terrainScore: number;       // 0-100
  scienceScore: number;       // 0-100
  safetyScore: number;        // 0-100
  accessibilityScore: number; // 0-100
  overallScore: number;       // 0-100
  hazards: Hazard[];
  scienceTargets: string[];
  recommendationReason: string;
  feasible: boolean;
  warnings: string[];
  riskAdjustedScore?: number;
  uncertaintyPenalty?: number;
  evidenceConfidence?: number;
  evaAssessment?: EVAOperationalAssessment;
  multiObjectiveScore?: MultiObjectiveRouteScore;
  scienceBreakdown?: ScienceValueBreakdown;
  coverage?: DataCoverage;
  provenance?: DataProvenance;
}

export interface MissionRecommendation {
  recommendedRouteId: string;
  decision: string;
  reasoning: string[];
  majorRisks: string[];
  scienceOpportunities: string[];
  operationalRecommendations: string[];
  confidence?: number;
  generatedBy: "RULE_ENGINE" | "AI_MODEL";
  candidates: RouteCandidate[];
  paretoCandidates?: RouteCandidate[];
  rejectedAlternatives?: Array<{ routeId: string; name: string; reason: string }>;
  auditHash?: string;
  evaluatedAt: string;
  provenance?: DataProvenance;
}

export type EVAMissionStatus = "GREEN" | "YELLOW" | "RED";

export interface EVAOperationalAssessment extends EVAAssessment {
  status: EVAMissionStatus;
  statusReason: string;
  returnFeasibility: boolean;
  emergencyReserveMinutes: number;
  terrainStressFactor: number;
  hazardExposureFactor: number;
  dataUncertaintyFactor: number;
}

export type UserRole =
  | "MISSION_COMMAND"
  | "SCIENCE_OFFICER"
  | "ASTRONAUT"
  | "ANALYST"
  | "VIEWER";

export type MissionPlanStatus = "DRAFT" | "ASSESSED" | "APPROVED" | "LOCKED";

export interface AuditChainBlock {
  eventId: string;
  blockHeight: number;
  timestamp: string;
  userId: string;
  role: UserRole;
  action:
    | "CREATE_ROUTE"
    | "ASSESS_MISSION"
    | "GENERATE_RECOMMENDATION"
    | "OPTIMIZE_ROUTE"
    | "APPROVE_PLAN"
    | "LOCK_PLAN"
    | "MODIFY_PRIORITIES"
    | "VERIFY_CHAIN";
  missionPlanId: string;
  planVersion: number;
  previousHash: string;
  integrityHash: string;
  details: Record<string, unknown>;
}

export interface AuditVerificationResult {
  isValid: boolean;
  valid?: boolean;
  chainLength: number;
  totalBlocks?: number;
  verifiedAt: string;
  tamperDetectedAtBlock?: number;
  message: string;
}

export interface MissionPlanVersion {
  version: number;
  planId: string;
  status: MissionPlanStatus;
  approvedBy?: string;
  approvedAt?: string;
  lockedAt?: string;
  routeId: string;
  recommendedProfile: string;
  riskAdjustedScore: number;
  auditHash: string;
  createdAt: string;
}

export interface StructuredCopilotResponse {
  missionObjective: {
    id: ScienceObjectiveId;
    name: string;
    parsedPrompt?: string;
    constraints: string[];
    preferredEvidence: string[];
  };
  recommendedRoute: RouteCandidate;
  alternatives: RouteCandidate[];
  paretoFrontier: RouteCandidate[];
  scientificRationale: string[];
  operationalRationale: string[];
  hazards: Hazard[];
  evidence: {
    coverage: DataCoverage;
    elevationSource: string;
    scienceEvidenceCount: number;
  };
  uncertainty: {
    terrainUncertaintyM: number;
    confidenceSummary: string;
    limitations: string[];
  };
  evaAssessment: EVAOperationalAssessment;
  decision: string;
  directives: string[];
  provenance: DataProvenance;
  auditBlock?: AuditChainBlock;
  planVersion: number;
  planStatus: MissionPlanStatus;
}

export interface CopilotMissionPlanRequest {
  prompt?: string;
  startCoordinate: MarsCoordinate;
  destinationCoordinate?: MarsCoordinate;
  maxDurationMinutes?: number;
  objectiveId?: ScienceObjectiveId;
  returnRequired?: boolean;
  traverseMode?: "standard" | "utv";
  userRole?: UserRole;
}

export interface AuditEvent {
  id: string;
  missionPlanId: string;
  action: "CREATE_ROUTE" | "ASSESS_MISSION" | "GENERATE_RECOMMENDATION" | "OPTIMIZE_ROUTE";
  createdBy: string;
  timestamp: string;
  integrityHash: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Phase 4: Multi-Agent Planetary Field Operations & Collaborative Teleoperations
// ============================================================================

export type AgentType = "ASTRONAUT" | "ROVER" | "ORBITER" | "MISSION_CONTROL";

export type AgentStatus =
  | "IDLE"
  | "PLANNING"
  | "EXECUTING"
  | "PAUSED"
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

export type TaskType =
  | "SURVEY_TERRAIN"
  | "INSPECT_HAZARD"
  | "COLLECT_SCIENCE"
  | "VERIFY_ROUTE"
  | "RELAY_SIGNAL"
  | "RETURN_TO_BASE"
  | "FOLLOW_ASTRONAUT"
  | "EMERGENCY_SUPPORT";

export interface AgentTask {
  id: string;
  agentId: string;
  taskType: TaskType;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  name: string;
  target: {
    coordinate: MarsCoordinate;
    targetId?: string;
    description?: string;
  };
  estimatedDurationMin: number;
  requiredBatteryPercent: number;
  requiredCommunication: boolean;
  scienceObjective?: ScienceObjectiveId;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
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
  mobilityRating: number;
  hazardTolerance: number;
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

export interface CommunicationLink {
  sourceAgentId: string;
  sourceCallsign: string;
  targetAgentId: string;
  targetCallsign: string;
  linkType: "DIRECT" | "ROVER_RELAY" | "ORBITER_RELAY" | "EARTH_DEEP_SPACE";
  distanceKm: number;
  lineOfSight: boolean;
  estimatedLatencyMs: number;
  bandwidthKbps: number;
  reliability: number;
  status: "CONNECTED" | "DEGRADED" | "LOST";
  notes?: string;
}

export interface NetworkTopology {
  timestamp: string;
  links: CommunicationLink[];
  missionControlReachable: boolean;
  activeRelayCount: number;
  unconnectedAgents: string[];
  orbitalVisibility?: OrbitalVisibilityWindow;
}

export interface TimelineEvent {
  id: string;
  missionTimeMin: number;
  timeLabel: string;
  title: string;
  agentCallsign: string;
  category: "EVA" | "ROVER" | "COMMS" | "HAZARD" | "SCIENCE" | "COMMAND";
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED";
  description: string;
}

export interface ScienceQueueItem {
  id: string;
  targetName: string;
  coordinate: MarsCoordinate;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  scienceObjective: ScienceObjectiveId;
  recommendedAgentCallsign: string;
  supportingAgentCallsign?: string;
  requiredInstrument: string;
  status: "QUEUED" | "ASSIGNED" | "EN_ROUTE" | "OBSERVING" | "COMPLETED";
  supportingEvidence: string[];
  assignedAt?: string;
  completedAt?: string;
  sampleReturnPayloadId?: string;
  provenance: DataProvenance;
}

export interface ReplanProposal {
  replanId: string;
  timestamp: string;
  trigger: {
    triggerType: string;
    initiatorAgentId: string;
    initiatorCallsign: string;
    hazardDescription?: string;
    reason: string;
  };
  status: "PROPOSED" | "APPROVED" | "REJECTED";
  currentRouteId: string;
  proposedRouteId: string;
  candidateAlternatives: RouteCandidate[];
  comparison: {
    distanceDiffKm: number;
    durationDiffMin: number;
    safetyScoreDiff: number;
    scienceScoreDiff: number;
    riskAdjustedDiff: number;
    safetyRationale: string;
    scienceTradeoff: string;
  };
  humanApprovalRequired: boolean;
  approvedBy?: string;
  auditBlockHash?: string;
}

export interface SimulationState {
  isRunning: boolean;
  simulationTimeMinutes: number;
  timeScale: number;
  scenarioSeed: number;
  activeEmergency?: {
    scenarioId: string;
    title: string;
    affectedAgentCallsigns: string[];
    severity: "WARNING" | "CRITICAL";
    recommendedMitigation: string;
  };
}

export interface OperationEvent {
  id: string;
  timestamp: string;
  agentId: string;
  eventType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  details?: Record<string, unknown>;
}

export interface OperationsCopilotResponse {
  query: string;
  assessment: string;
  evidence: string[];
  options: Array<{ title: string; score: number; risk: string; recommended: boolean }>;
  recommendation: string;
  tradeOffs: string[];
  agentDirectives: Array<{ agentCallsign: string; directive: string; priority: "CRITICAL" | "HIGH" | "MEDIUM" }>;
  uncertainty: {
    telemetryUncertainty: string;
    unmappedRisks: string[];
  };
  provenance: DataProvenance;
  // Phase 5 explicit classification
  observedFact?: string;
  derivedInsight?: string;
  simulatedContext?: string;
}

// -------------------------------------------------------------
// PHASE 5: SENSORS, OBSERVATIONS, ORBITAL & EVENT TYPES
// -------------------------------------------------------------

export type SensorType =
  | "LASER_ALTIMETER"
  | "HAZCAM"
  | "NAVCAM"
  | "RAMAN_SPECTROMETER"
  | "THERMAL_IR"
  | "COMMUNICATION_SENSOR";

export interface SensorObservation {
  observationId: string;
  agentId: string;
  sensorType: SensorType;
  timestamp: string;
  location: MarsCoordinate;
  measurement: {
    parameter: string;
    value: number;
    unit: string;
  };
  uncertainty: {
    absolute?: number;
    relative?: number;
    confidenceInterval?: [number, number];
  };
  provenance: DataProvenance;
  quality: "GOOD" | "DEGRADED" | "INVALID";
  processingMethod: "DIRECT" | "FILTERED" | "FUSED" | "SIMULATED";
}

export type OrbitalVisibilityQuality = "EXCELLENT" | "GOOD" | "DEGRADED" | "NO_CONTACT";
export type OrbitalPassState = "NO_CONTACT" | "PASS_APPROACHING" | "PASS_ACTIVE" | "PASS_ENDING";

export interface OrbitalVisibilityWindow {
  orbiterId: string;
  startTime: string;
  endTime: string;
  maxElevationDeg: number;
  slantRangeKm: number;
  visibilityQuality: OrbitalVisibilityQuality;
  state: OrbitalPassState;
  currentElevationDeg: number;
  remainingSeconds: number;
  nextPassInSeconds: number;
  bandwidthKbps: number;
}

export interface FusedHazardReport {
  hazardId: string;
  location: MarsCoordinate;
  classification: "TERRAIN_PREDICTED" | "SENSOR_DERIVED" | "CORROBORATED_CONFIRMED";
  evidenceType?: "MODEL_EVIDENCE" | "SENSOR_EVIDENCE" | "INDEPENDENT_SENSOR_EVIDENCE" | "CORROBORATED_CONFIRMED";
  estimatedSlopeDeg: number;
  uncertaintyDeg: number;
  confidenceInterval: [number, number];
  obstacleProbability: number;
  corroboratingSensors: string[];
  actionableWarning: string;
  requiresReplan: boolean;
  provenance: DataProvenance;
}

export interface CommunicationPacket {
  packetId: string;
  sourceAgentId: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "BULK";
  type: "TELEMETRY" | "HAZARD_ALERT" | "COMMAND" | "SCIENCE_DATA" | "SPECTRAL_CUBE";
  payloadSizeKb: number;
  createdAt: string;
  status: "TRANSMITTING" | "BUFFERED" | "DELIVERED" | "DROPPED";
  attempts: number;
}



