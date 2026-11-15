/**
 * Ares Frontier - Core Type Definitions & Scientific Abstractions
 * Reference Ellipsoid: Mars equatorial radius = 3389.5 km
 */

export interface MarsCoordinate {
  latitude: number;   // Degrees [-90.0 to +90.0] (Planetographic/Planetocentric convention)
  longitude: number;  // Degrees [-180.0 to +180.0] or [0 to 360]
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
  region?: string;
  category: "stratigraphy" | "mineralogy" | "paleohydrology" | "volcanology" | "astrobiology" | "geomorphology";
  scientificValue: ScientificValue;
  description: string;
  dataSource: string;
  potentialSamples?: string[];
  associatedFormation?: string;
  provenanceClassification?: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "BENCHMARK" | "SYNTHETIC";
  evidenceStatus?: "verified_in_situ" | "orbital_only" | "partial_coverage" | "missing_in_situ";
  missingEvidence?: string[];
  references?: string[];
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
}

export interface MissionParameters {
  routeId?: string;
  maxDurationMinutes: number;
  startCoordinate: MarsCoordinate;
  destinationCoordinate?: MarsCoordinate;
  waypoints?: MarsCoordinate[];
  returnRequired: boolean;
  evaSuitType?: "exploration-mark-1" | "advanced-mobility";
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

// Person 3 (AI/ML Module Contract)
export interface MissionAssessment {
  safetyScore: number;         // 0 - 100
  scienceScore: number;        // 0 - 100
  accessibilityScore: number;  // 0 - 100
  overallScore: number;        // 0 - 100
  confidence: number;          // 0.0 - 1.0
  warnings: string[];
  recommendedRoute?: string;
  modelIdentifier?: string;
  scoringSource: "model-generated" | "rule-based" | "fallback";
  missionStatus: "MISSION FEASIBLE" | "MISSION RESTRICTED" | "MISSION CONSTRAINT EXCEEDED";
  scoringExplanation: string;
}

// System Status & Pipeline Transparency
export interface SystemPipelineStatus {
  molaElevation: "Available" | "Degraded" | "Offline";
  vikingImagery: "Available" | "Degraded" | "Offline";
  themisThermal: "Available" | "Degraded" | "Offline";
  scienceTargets: "Available" | "Degraded" | "Offline";
  mlService: "AI Model (Live)" | "Fallback Mode (Rule-based)";
  database: "PostgreSQL / PostGIS" | "Local In-Memory Repository";
  lastCheck: string;
}

// Person 4 (Science Engine Contract)
export interface ScientificAssessment {
  geologicalContext?: string;
  mineralContext?: string;
  thermalContext?: string;
  scientificValue: ScientificValue;
  explanation: string;
  sources: string[];
  samplePriorities?: string[];
  geologicalEpoch?: "Noachian" | "Hesperian" | "Amazonian" | "Noachian-Hesperian Transition";
  mepagRelevance?: string[];
  iceProbability?: number;
  confidence?: number;
  provenance?: Record<string, unknown>;
  fallbackUsed?: boolean;
  provenanceClassification?: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "BENCHMARK" | "SYNTHETIC";
  methodology?: string;
  limitations?: string[];
}

// Data Sources & System Status
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
  recordKind?:
    | "VERIFIED_EXTERNAL_REFERENCE"
    | "STATIC_BENCHMARK_CATALOG"
    | "ANALYTICAL_MODEL"
    | "INGESTED_DATASET"
    | "SYNTHETIC_DATASET";
  ingestionStatus?: "NOT_INGESTED_REFERENCE" | "INGESTED_LOCAL" | "INGESTION_FAILED";
  product?: string;
  processingStage?: string;
  validationStatus?:
    | "METADATA_VERIFIED"
    | "INGESTED_CHECKSUM_VERIFIED"
    | "PARTIAL_METADATA"
    | "PENDING_VERIFICATION"
    | "UNAVAILABLE";
  classification?: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED" | "BENCHMARK" | "SYNTHETIC";
  pipelineName?: string;
  modelVersion?: string;
  retrievalTimestamp?: string;
  limitations?: string;
  missingSamplesNote?: string;
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
  dataMode?: DataMode;
  confidence?: number;
  uncertainty?: {
    value?: number;
    absolute?: number;
    relative?: number;
    unit?: string;
    methodology?: string;
  };
}

export type DataMode = "LIVE" | "CACHED" | "BENCHMARK" | "FALLBACK" | "DEMO" | "SIMULATED" | "DERIVED" | "HEURISTIC";

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
    | "rover_observation"
    | "subsurface_ice"
    | "isru_resource";
  value?: number;
  unit?: string;
  confidence?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  provenance: DataProvenance;
}

export type ScientificDatasetCategory =
  | "ELEVATION"
  | "GEOLOGY"
  | "MINERALOGY"
  | "THERMAL"
  | "SUBSURFACE_ICE"
  | "ISRU_RESOURCE"
  | "IN_SITU_OBSERVATION";

export interface ScientificDatasetMetadata {
  datasetId: string;
  category: ScientificDatasetCategory;
  name: string;
  mission: string;
  instrument: string;
  spatialResolutionM: number;
  verticalAccuracyM?: number;
  coverage: string;
  sourceUrl?: string;
  dataMode: DataMode;
  provenance: DataProvenance;
  associatedDecisionIds?: string[];
}

export interface MineralogicalObservation {
  mineralName: string;
  category: "clay_phyllosilicate" | "carbonate" | "sulfate" | "oxide_hematite" | "olivine_pyroxene" | "hydrated_silica";
  spectralAbsorptionBandsMicrons: number[];
  estimatedAbundancePercent: number;
  confidence: number;
  provenance: DataProvenance;
}

export interface IceResourceProfile {
  iceDepthMinM: number;
  iceDepthMaxM: number;
  iceConsistencyIndex: number; // 0.0 - 1.0 (SWIM index)
  estimatedPurityPercent: number;
  isruAccessibilityRating: "EXCELLENT" | "MODERATE" | "DIFFICULT" | "INACCESSIBLE";
  provenance: DataProvenance;
}

export interface ThermalInertiaProfile {
  thermalInertiaSI: number; // J m^-2 K^-1 s^-1/2 (THEMIS)
  inferredSurfaceType: "dust_mantle" | "unconsolidated_sand" | "duricrust" | "rock_outcrop" | "bedrock";
  rockFractionPercent: number;
  provenance: DataProvenance;
}

export type HazardSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type HazardCategory =
  | "TERRAIN"
  | "GEOLOGICAL"
  | "COMMUNICATION"
  | "RESOURCE"
  | "MISSION_CONSTRAINT"
  | "ENVIRONMENTAL";

export type HazardType =
  // Terrain & Geological
  | "STEEP_SLOPE"
  | "EXTREME_SLOPE"
  | "LARGE_ELEVATION_CHANGE"
  | "SCARP"
  | "ROUGH_TERRAIN"
  | "THERMAL_ANOMALY"
  | "ROUTE_BOTTLENECK"
  | "HIGH_RISK_DESCENT"
  | "LOW_DATA_CONFIDENCE"
  | "SCIENCE_TARGET_PROXIMITY_RISK"
  | "UNSTABLE_REGOLITH"
  | "ROCK_ABUNDANCE"
  | "TRAVERSABILITY_LIMIT"
  | "GEOLOGICAL_INSTABILITY"
  // Communication
  | "LINE_OF_SIGHT_LOSS"
  | "ORBITER_RELAY_UNAVAILABLE"
  | "COMMUNICATION_BLACKOUT"
  | "TASK_COMM_INTERRUPT"
  // Resource
  | "LOW_BATTERY_RESERVE"
  | "EXCESSIVE_ENERGY_EXPENDITURE"
  | "INSUFFICIENT_OXYGEN"
  | "SAMPLE_STORAGE_EXCEEDED"
  | "RESOURCE_DEPLETION_RISK"
  // Mission Constraint
  | "MISSION_DEADLINE_BREACH"
  | "EMERGENCY_RETURN_INFEASIBLE"
  | "AGENT_CAPABILITY_MISMATCH"
  | "OPERATIONAL_MARGIN_DEFICIT";

export interface HazardEvidenceItem {
  id: string;
  description: string;
  dataset: string;
  observedMetric?: string;
  provenance: DataProvenance;
}

export interface Hazard {
  id: string;
  name?: string;
  type: HazardType;
  category?: HazardCategory;
  severity: HazardSeverity;
  location: MarsCoordinate;
  radiusM?: number;
  affectedRouteSegment?: string;
  reason: string;
  recommendation?: string;
  confidence?: number;
  probability?: number; // 0.0 - 1.0
  impactDescription?: string;
  detectionSource?: string;
  provenanceClassification?: "MEASURED" | "DERIVED" | "PREDICTED" | "SIMULATED";
  recommendedMitigation?: string;
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
  totalScore: number; // 0 - 100
  objectiveRelevance: number; // 0 - 30
  geologicalEvidence: number; // 0 - 25
  targetUniqueness: number; // 0 - 20
  dataQuality: number; // 0 - 15
  sampleDiversity: number; // 0 - 10
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
  communication?: number;   // 0-100 (Modeled communication availability)
  energyEfficiency?: number; // 0-100 (Energy budget compliance)
  resourceFeasibility?: number; // 0-100 (Combined battery, O2, sample capacity)
  evidenceConfidence: number; // 0-100
  evaFeasibility: number;   // 0-100
  uncertaintyPenalty: number; // 0-100
  riskAdjustedScore: number;  // Expected Value - Uncertainty Penalty
  isParetoEfficient: boolean;
  paretoDominatedBy?: string[];
  hardConstraintsSatisfied?: boolean;
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
  communicationScore?: number; // 0-100
  energyWhConsumed?: number;   // Total estimated Wh
  projectedBatteryPercent?: number; // Projected remaining SoC %
  projectedOxygenMinutes?: number;  // Projected remaining O2 minutes
  hardConstraintViolations?: string[]; // Empty if feasible, lists violations if infeasible
  tradeoffExplanation?: string; // Detailed human-readable trade-off reasoning
  mlRiskScore?: number;         // Predicted risk from ML service
  communicationMetrics?: {
    losCoveragePercent: number;
    maxBlackoutDurationMin: number;
    orbiterPassAvailable: boolean;
    commContinuitySatisfied: boolean;
  };
  resourceMetrics?: {
    initialBatteryPercent: number;
    projectedRemainingPercent: number;
    energyExpenditureWh: number;
    energyBudgetWh: number;
    batteryMarginPercent: number;
    sampleTubesNeeded: number;
    sampleTubesAvailable: number;
    estimatedDataMb: number;
    oxygenRemainingMin?: number;
    emergencyReturnFeasible: boolean;
  };
  hazards: Hazard[];
  scienceTargets: string[];
  recommendationReason: string;
  feasible: boolean;
  warnings: string[];
  // Phase 3 additions:
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
  agentId?: string;
  agentType?: "ASTRONAUT" | "ROVER";
  initialBatteryPercent?: number;
  initialOxygenMinutes?: number;
  requireContinuousCommunication?: boolean;
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

export interface MissionCommandEnvelope {
  commandId: string;
  agentId: string;
  command: "PAUSE" | "RESUME" | "RETURN_TO_BASE" | "EMERGENCY_STOP" | "ASSIGN_TASK";
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  issuer: string;
  role: UserRole;
  signature?: string;
  payload?: Record<string, unknown>;
}

export type MissionEventType =
  | "MISSION_STARTED"
  | "MISSION_CREATED"
  | "MISSION_UPDATED"
  | "MISSION_APPROVED"
  | "MISSION_LOCKED"
  | "ROUTE_CREATED"
  | "ROUTE_SELECTED"
  | "AGENT_ASSIGNED"
  | "AGENT_STATUS_CHANGED"
  | "TASK_CREATED"
  | "TASK_TRANSITION"
  | "TASK_REASSIGNED"
  | "TELEMETRY_UPDATED"
  | "RESOURCE_UPDATED"
  | "PACKET_QUEUED"
  | "PACKET_BUFFERED"
  | "PACKET_DELIVERED"
  | "EVA_TRANSITION"
  | "EVA_EMERGENCY_RETURN"
  | "SENSOR_OBSERVATION"
  | "HAZARD_DETECTED"
  | "COMMUNICATION_LOST"
  | "COMMUNICATION_RESTORED"
  | "REPLAN_PROPOSED"
  | "REPLAN_APPROVED"
  | "COMMAND_ISSUED"
  | "COMMAND_EXECUTED"
  | "COMMAND_REJECTED"
  | "SCIENCE_TARGET_COMPLETED"
  | "WHAT_IF_EXECUTED"
  | "MONTE_CARLO_EXECUTED"
  | "SNAPSHOT_CREATED"
  | "CONSISTENCY_AUDITED"
  | "SAFETY_EVALUATED"
  | "CHECKPOINT_SAVED"
  | "CHECKPOINT_RESTORED";

export interface MissionEventRecord {
  eventId: string;
  sequenceNumber?: number;
  missionId: string;
  timestamp: string; // Wall-clock UTC timestamp
  simulationTime?: number; // Mission Elapsed Time (MET) in seconds
  actor: string;
  agentId?: string;
  entityId?: string;
  correlationId?: string;
  auditRef?: string;
  idempotencyKey?: string;
  eventType: MissionEventType;
  previousState?: Record<string, unknown>;
  resultingState?: Record<string, unknown>;
  payload: Record<string, unknown>;
  provenance: DataProvenance;
  previousEventHash: string;
  eventHash: string;
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

export type MessagePriorityClass =
  | "EMERGENCY_SAFETY"
  | "MISSION_CRITICAL_OPS"
  | "NAVIGATION_TELEMETRY"
  | "SCIENTIFIC_OBSERVATIONS"
  | "ROUTINE_STATUS"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "BULK";

export interface CommunicationPacket {
  packetId: string;
  sourceAgentId: string;
  destinationAgentId?: string;
  priority: MessagePriorityClass;
  priorityClass?: 1 | 2 | 3 | 4 | 5; // 5: Emergency/Safety, 4: Mission Critical, 3: Nav/Telemetry, 2: Science, 1: Routine
  type: "TELEMETRY" | "HAZARD_ALERT" | "COMMAND" | "SCIENCE_DATA" | "SPECTRAL_CUBE" | "EMERGENCY_SOS" | "STATUS_UPDATE";
  payloadSizeKb: number;
  createdAt: string;
  status: "QUEUED" | "TRANSMITTING" | "BUFFERED" | "DELIVERED" | "DROPPED" | "EXPIRED" | "FAILED_BLACKOUT" | "FAILED";
  attempts: number;
  ttlMinutes?: number;
  transmissionDelaySeconds?: number;
  storeAndForward?: boolean;
  deliveredAt?: string;
  payloadSummary?: string;
}


