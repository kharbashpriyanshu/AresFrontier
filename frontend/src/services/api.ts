import {
  APIResponse,
  LocationData,
  TerrainData,
  ScienceTarget,
  ScientificAssessment,
  MarsRoute,
  RoutePoint,
  MissionParameters,
  EVAAssessment,
  MissionAssessment,
  DataSourceInfo,
  SystemPipelineStatus,
  ScienceObjectiveId,
} from "../types/index.js";

export interface StoredMissionRecord {
  id: string;
  name: string;
  description?: string;
  objectiveId?: ScienceObjectiveId;
  status: "DRAFT" | "APPROVED" | "LOCKED";
  routeId: string;
  parameters: MissionParameters;
  evaAssessment: EVAAssessment;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = "/api";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const payload = (await response.json()) as APIResponse<T>;

  if (!payload.success || !response.ok) {
    const errorMsg = payload.error?.message || `Request failed with HTTP status ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload.data as T;
}

export const api = {
  // Planetary Locations
  async getLocations(): Promise<LocationData[]> {
    return request<LocationData[]>("/locations");
  },

  async getLocationById(id: string): Promise<LocationData> {
    return request<LocationData>(`/locations/${encodeURIComponent(id)}`);
  },

  async getLocationAtCoord(lat: number, lon: number): Promise<LocationData> {
    return request<LocationData>(`/locations?lat=${lat}&lon=${lon}`);
  },

  // Terrain & MOLA Topography
  async getTerrain(lat: number, lon: number): Promise<TerrainData> {
    return request<TerrainData>(`/terrain?lat=${lat}&lon=${lon}`);
  },

  // Science Targets & Assessment
  async getScienceTargets(): Promise<ScienceTarget[]> {
    return request<ScienceTarget[]>("/science/targets");
  },

  async getScienceTargetById(id: string): Promise<ScienceTarget> {
    return request<ScienceTarget>(`/science/targets/${encodeURIComponent(id)}`);
  },

  async getScientificAssessment(lat: number, lon: number): Promise<ScientificAssessment> {
    return request<ScientificAssessment>(`/science/assessment?lat=${lat}&lon=${lon}`);
  },

  async evaluateScienceTarget(payload: {
    targetId: string;
    name: string;
    latitude: number;
    longitude: number;
    targetType: string;
    description?: string;
    primaryObjective?: string;
  }): Promise<import("../types/index.js").TargetEvaluationResult> {
    return request<import("../types/index.js").TargetEvaluationResult>("/science/evaluate-target", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async evaluateScienceObjectives(payload: {
    objectiveId: string;
    targetTypes: string[];
    waypointsCount: number;
    routeLengthKm: number;
  }): Promise<import("../types/index.js").ObjectivesEvaluationResult> {
    return request<import("../types/index.js").ObjectivesEvaluationResult>("/science/evaluate-objectives", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async classifyMineralogy(payload: {
    latitude: number;
    longitude: number;
    geologicalContext?: string;
    observedFeatures?: string[];
  }): Promise<import("../types/index.js").MineralClassificationResult> {
    return request<import("../types/index.js").MineralClassificationResult>("/science/classify-mineralogy", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async assessIceStability(payload: {
    latitude: number;
    longitude: number;
  }): Promise<import("../types/index.js").IceAssessmentResult> {
    return request<import("../types/index.js").IceAssessmentResult>("/science/assess-ice", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async assignScienceTargetToMission(
    targetId: string,
    payload: { missionId: string; rationale?: string; actor?: string; objectiveId?: ScienceObjectiveId }
  ): Promise<import("../types/index.js").ScienceDecisionRecord> {
    return request<import("../types/index.js").ScienceDecisionRecord>(
      `/science/targets/${encodeURIComponent(targetId)}/assign-mission`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async getScienceDecisions(missionId?: string): Promise<import("../types/index.js").ScienceDecisionRecord[]> {
    const query = missionId ? `?missionId=${encodeURIComponent(missionId)}` : "";
    return request<import("../types/index.js").ScienceDecisionRecord[]>(`/science/decisions${query}`);
  },

  // Routes
  async getAllRoutes(): Promise<MarsRoute[]> {
    return request<MarsRoute[]>("/routes");
  },

  async getRouteById(id: string): Promise<MarsRoute> {
    return request<MarsRoute>(`/routes/${encodeURIComponent(id)}`);
  },

  async createRoute(name: string, points: RoutePoint[]): Promise<MarsRoute> {
    return request<MarsRoute>("/routes", {
      method: "POST",
      body: JSON.stringify({ name, points }),
    });
  },

  // Missions & EVA
  async getAllMissions(): Promise<StoredMissionRecord[]> {
    return request<StoredMissionRecord[]>("/missions");
  },

  async createMission(
    parameters: MissionParameters & {
      name?: string;
      description?: string;
      objectiveId?: import("../types/index.js").ScienceObjectiveId;
      status?: "DRAFT" | "APPROVED" | "LOCKED";
    }
  ): Promise<StoredMissionRecord> {
    return request<StoredMissionRecord>("/missions", {
      method: "POST",
      body: JSON.stringify(parameters),
    });
  },

  async getMissionById(id: string): Promise<StoredMissionRecord> {
    return request<StoredMissionRecord>(`/missions/${encodeURIComponent(id)}`);
  },

  async updateMission(
    id: string,
    updates: {
      name?: string;
      description?: string;
      objectiveId?: import("../types/index.js").ScienceObjectiveId;
      status?: "DRAFT" | "APPROVED" | "LOCKED";
      routeId?: string;
      maxDurationMinutes?: number;
      returnRequired?: boolean;
      parameters?: Partial<MissionParameters>;
    }
  ): Promise<StoredMissionRecord> {
    return request<StoredMissionRecord>(`/missions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteMission(id: string): Promise<{ deleted: boolean; id: string }> {
    return request(`/missions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // AI/ML Mission Assessment (Person 3)
  async assessMission(routeId: string, maxDurationMinutes: number = 240): Promise<MissionAssessment> {
    return request<MissionAssessment>("/assessment", {
      method: "POST",
      body: JSON.stringify({
        routeId,
        missionParameters: { maxDurationMinutes },
      }),
    });
  },

  // Data Sources & System Status
  async getDataSources(): Promise<DataSourceInfo[]> {
    return request<DataSourceInfo[]>("/data/sources");
  },

  async getDataStatus(): Promise<DataSourceInfo & { pipelines: SystemPipelineStatus }> {
    return request<DataSourceInfo & { pipelines: SystemPipelineStatus }>("/data/status");
  },

  async getIngestedDatasets(): Promise<any[]> {
    return request<any[]>("/data/ingested");
  },

  async ingestMars2020Traverse(): Promise<any> {
    return request<any>("/data/ingest/m20-traverse", {
      method: "POST",
    });
  },

  // ============================================================================
  // Phase 2: Decision Intelligence, Hazards, Objectives & Copilot
  // ============================================================================
  async getHazards(): Promise<import("../types/index.js").Hazard[]> {
    return request<import("../types/index.js").Hazard[]>("/intelligence/hazards");
  },

  async getScienceObjectives(): Promise<import("../types/index.js").ScienceObjective[]> {
    return request<import("../types/index.js").ScienceObjective[]>("/intelligence/science-objectives");
  },

  async assessTerrain(params: {
    coordinate?: import("../types/index.js").MarsCoordinate;
    startCoordinate?: import("../types/index.js").MarsCoordinate;
    endCoordinate?: import("../types/index.js").MarsCoordinate;
  }): Promise<import("../types/index.js").TerrainAssessment> {
    return request<import("../types/index.js").TerrainAssessment>("/intelligence/assess-terrain", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async assessHazards(params: {
    route?: MarsRoute;
    coordinate?: import("../types/index.js").MarsCoordinate;
  }): Promise<import("../types/index.js").HazardAssessment> {
    return request<import("../types/index.js").HazardAssessment>("/intelligence/assess-hazards", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async optimizeRoute(
    params: import("../types/index.js").CopilotMissionPlanRequest
  ): Promise<import("../types/index.js").RouteCandidate[]> {
    return request<import("../types/index.js").RouteCandidate[]>("/intelligence/optimize-route", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async generateRecommendation(params: {
    candidates: import("../types/index.js").RouteCandidate[];
    objectiveId?: import("../types/index.js").ScienceObjectiveId;
    maxDurationMinutes?: number;
  }): Promise<import("../types/index.js").MissionRecommendation> {
    return request<import("../types/index.js").MissionRecommendation>(
      "/intelligence/mission-recommendation",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  },

  async runCopilotMissionPlan(
    params: import("../types/index.js").CopilotMissionPlanRequest
  ): Promise<{
    planId: string;
    objectiveId: import("../types/index.js").ScienceObjectiveId;
    candidates: import("../types/index.js").RouteCandidate[];
    recommendation: import("../types/index.js").MissionRecommendation;
    auditEvent: import("../types/index.js").AuditEvent;
  }> {
    return request<{
      planId: string;
      objectiveId: import("../types/index.js").ScienceObjectiveId;
      candidates: import("../types/index.js").RouteCandidate[];
      recommendation: import("../types/index.js").MissionRecommendation;
      auditEvent: import("../types/index.js").AuditEvent;
    }>("/copilot/mission-plan", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getAuditLog(): Promise<import("../types/index.js").AuditEvent[]> {
    return request<import("../types/index.js").AuditEvent[]>("/intelligence/audit-log");
  },

  // ============================================================================
  // Phase 3: Planetary Grounding, Audit Verification & Governance
  // ============================================================================
  async verifyAuditChain(): Promise<import("../types/index.js").AuditVerificationResult> {
    return request<import("../types/index.js").AuditVerificationResult>("/security/verify-audit-chain", {
      method: "POST",
    });
  },

  async getAuditChain(): Promise<{ totalBlocks: number; chain: import("../types/index.js").AuditChainBlock[] }> {
    return request<{ totalBlocks: number; chain: import("../types/index.js").AuditChainBlock[] }>("/security/audit-chain");
  },

  async lockMission(missionId: string, lockedBy: string = "Flight Director"): Promise<{
    message: string;
    version: import("../types/index.js").MissionPlanVersion;
  }> {
    return request(`/missions/${encodeURIComponent(missionId)}/lock`, {
      method: "POST",
      body: JSON.stringify({ lockedBy }),
    });
  },

  async approveMission(missionId: string, approvedBy: string = "Mission Commander"): Promise<{
    message: string;
    version: import("../types/index.js").MissionPlanVersion;
  }> {
    return request(`/missions/${encodeURIComponent(missionId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvedBy }),
    });
  },

  async getDataCoverage(lat: number, lon: number): Promise<import("../types/index.js").DataCoverage> {
    return request<import("../types/index.js").DataCoverage>(`/planetary/coverage?lat=${lat}&lon=${lon}`);
  },

  async getScienceTargetsBreakdown(): Promise<import("../types/index.js").ScienceValueBreakdown[]> {
    return request<import("../types/index.js").ScienceValueBreakdown[]>("/science/targets/breakdown");
  },

  // ============================================================================
  // Phase 4: Multi-Agent Field Operations & Collaborative Teleoperations
  // ============================================================================
  async getOperationsState(): Promise<{
    simState: import("../types/index.js").SimulationState;
    agents: import("../types/index.js").PlanetaryAgent[];
    network: import("../types/index.js").NetworkTopology;
    timeline: import("../types/index.js").TimelineEvent[];
    scienceQueue: import("../types/index.js").ScienceQueueItem[];
    events: import("../types/index.js").OperationEvent[];
    replanProposals: import("../types/index.js").ReplanProposal[];
    allocations: any[];
  }> {
    return request("/operations/state");
  },

  async getAgents(): Promise<import("../types/index.js").PlanetaryAgent[]> {
    return request<import("../types/index.js").PlanetaryAgent[]>("/operations/agents");
  },

  async getAgentById(id: string): Promise<import("../types/index.js").PlanetaryAgent> {
    return request<import("../types/index.js").PlanetaryAgent>(`/operations/agents/${encodeURIComponent(id)}`);
  },

  async assignAgentTask(agentId: string, task: Partial<import("../types/index.js").AgentTask>): Promise<{
    task: import("../types/index.js").AgentTask;
    feasibility: any;
  }> {
    return request(`/operations/agents/${encodeURIComponent(agentId)}/tasks`, {
      method: "POST",
      body: JSON.stringify(task),
    });
  },

  async executeAgentCommand(agentId: string, command: "PAUSE" | "RESUME" | "RETURN_TO_BASE"): Promise<any> {
    return request(`/operations/agents/${encodeURIComponent(agentId)}/commands`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  },

  async getCommunications(): Promise<import("../types/index.js").NetworkTopology> {
    return request<import("../types/index.js").NetworkTopology>("/operations/communications");
  },

  async getTimeline(): Promise<import("../types/index.js").TimelineEvent[]> {
    return request<import("../types/index.js").TimelineEvent[]>("/operations/timeline");
  },

  async startSimulation(timeScale: number = 1.0): Promise<import("../types/index.js").SimulationState> {
    return request("/operations/simulation/start", {
      method: "POST",
      body: JSON.stringify({ timeScale }),
    });
  },

  async pauseSimulation(): Promise<import("../types/index.js").SimulationState> {
    return request("/operations/simulation/pause", { method: "POST" });
  },

  async resetSimulation(): Promise<import("../types/index.js").SimulationState> {
    return request("/operations/simulation/reset", { method: "POST" });
  },

  async advanceSimulation(minutes: number = 15): Promise<any> {
    return request("/operations/simulation/advance", {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
  },

  async triggerDemoHazardRecon(): Promise<{
    scenario: string;
    replanProposal: import("../types/index.js").ReplanProposal;
    relayRoute: any;
    affectedAgent: import("../types/index.js").RoverAgent;
  }> {
    return request("/operations/demo-hazard-recon", { method: "POST" });
  },

  async approveReplan(replanId: string, approvedBy: string = "Mission Commander"): Promise<import("../types/index.js").ReplanProposal> {
    return request(`/operations/replan/${encodeURIComponent(replanId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvedBy }),
    });
  },

  async triggerEmergency(scenario: "BATTERY_CRITICAL" | "COMMS_LOST" | "HAZARD" | "IMMOBILIZED"): Promise<any> {
    return request("/operations/emergency", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    });
  },

  async getScienceQueue(): Promise<import("../types/index.js").ScienceQueueItem[]> {
    return request<import("../types/index.js").ScienceQueueItem[]>("/operations/science-queue");
  },

  async assignScienceQueue(id: string, status: string, agentCallsign?: string): Promise<import("../types/index.js").ScienceQueueItem> {
    return request(`/operations/science-queue/${encodeURIComponent(id)}/assign`, {
      method: "POST",
      body: JSON.stringify({ status, agentCallsign }),
    });
  },

  async copilotOperationsQuery(query: string): Promise<import("../types/index.js").OperationsCopilotResponse> {
    return request<import("../types/index.js").OperationsCopilotResponse>("/operations/copilot/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  },

  // ============================================================================
  // Phase 5: Verified Observations, Orbital Passes, Events & Security
  // ============================================================================
  async getObservations(limit: number = 20): Promise<import("../types/index.js").SensorObservation[]> {
    return request<import("../types/index.js").SensorObservation[]>(`/operations/observations?limit=${limit}`);
  },

  async getOrbitalCurrent(): Promise<import("../types/index.js").OrbitalVisibilityWindow> {
    return request<import("../types/index.js").OrbitalVisibilityWindow>("/operations/orbital/current");
  },

  async getCommsQueue(): Promise<import("../types/index.js").CommunicationPacket[]> {
    return request<import("../types/index.js").CommunicationPacket[]>("/operations/comms/queue");
  },

  async getMissionEvents(limit: number = 30): Promise<any[]> {
    return request<any[]>(`/operations/events?limit=${limit}`);
  },

  async getSecurityPermissions(): Promise<{ role: string; permissions: Record<string, string[]> }> {
    return request<{ role: string; permissions: Record<string, string[]> }>("/operations/security/permissions");
  },

  async submitSecureCommand(envelope: any): Promise<any> {
    return request("/operations/commands", {
      method: "POST",
      body: JSON.stringify(envelope),
    });
  },

  async executeScenarioBlackout(): Promise<any> {
    return request("/operations/scenarios/blackout", { method: "POST" });
  },

  async executeScenarioSensorHazard(): Promise<any> {
    return request("/operations/scenarios/sensor-hazard", { method: "POST" });
  },

  async executeScenarioEmergency(scenario: string = "BATTERY_CRITICAL"): Promise<any> {
    return request("/operations/scenarios/emergency", {
      method: "POST",
      body: JSON.stringify({ scenario }),
    });
  },

  async createCheckpoint(checkpointId: string): Promise<{ checkpointId: string; status: string }> {
    return request("/operations/checkpoint", {
      method: "POST",
      body: JSON.stringify({ checkpointId }),
    });
  },

  async restoreCheckpoint(checkpointId: string): Promise<{ checkpointId: string; status: string }> {
    return request("/operations/checkpoint/restore", {
      method: "POST",
      body: JSON.stringify({ checkpointId }),
    });
  },

  // --- Phase 6 Digital Twin & Mission Replay ---
  async getReplayMissions(): Promise<any[]> {
    return request<any[]>("/replay/missions");
  },

  async getReplayState(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}`);
  },

  async startReplay(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/start`, { method: "POST" });
  },

  async pauseReplay(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/pause`, { method: "POST" });
  },

  async resumeReplay(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/resume`, { method: "POST" });
  },

  async stepReplay(direction: "FORWARD" | "BACKWARD" = "FORWARD", missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/step`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  },

  async seekReplay(target: number, missionId: string = "MARSWALK-001", mode?: "INDEX" | "SIM_TIME"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/seek`, {
      method: "POST",
      body: JSON.stringify({ target, mode }),
    });
  },

  async resetReplay(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/reset`, { method: "POST" });
  },

  async reconstructHistoricalState(
    missionId: string = "MARSWALK-001",
    params?: { eventId?: string; sequenceNumber?: number; timestamp?: string; snapshotId?: string }
  ): Promise<any> {
    const q = new URLSearchParams();
    if (params?.eventId) q.set("eventId", params.eventId);
    if (params?.sequenceNumber !== undefined) q.set("sequenceNumber", String(params.sequenceNumber));
    if (params?.timestamp) q.set("timestamp", params.timestamp);
    if (params?.snapshotId) q.set("snapshotId", params.snapshotId);
    const qs = q.toString();
    return request<any>(`/replay/${encodeURIComponent(missionId)}/reconstruct${qs ? `?${qs}` : ""}`);
  },

  async inspectReplayEvent(missionId: string, eventId: string): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/events/${encodeURIComponent(eventId)}`);
  },

  async compareHistoricalStates(missionId: string, leftTarget: any, rightTarget: any): Promise<any> {
    return request<any>(`/replay/${encodeURIComponent(missionId)}/compare`, {
      method: "POST",
      body: JSON.stringify({ leftTarget, rightTarget }),
    });
  },

  async exportReplayData(
    missionId: string,
    format: "csv" | "json" | "markdown",
    kind: "events" | "snapshot" | "summary" | "event",
    params?: { eventId?: string; agentId?: string; eventType?: string }
  ): Promise<string> {
    const q = new URLSearchParams({ format, kind });
    if (params?.eventId) q.set("eventId", params.eventId);
    if (params?.agentId) q.set("agentId", params.agentId);
    if (params?.eventType) q.set("eventType", params.eventType);
    const response = await fetch(`/api/replay/${encodeURIComponent(missionId)}/export?${q.toString()}`);
    if (!response.ok) throw new Error(`Export failed: ${response.status}`);
    return await response.text();
  },

  async getReplaySnapshots(missionId: string = "MARSWALK-001"): Promise<any[]> {
    return request<any[]>(`/replay/${encodeURIComponent(missionId)}/snapshots`);
  },

  // --- Phase 6 What-If Simulation, Monte Carlo & Failures ---
  async cloneMission(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>("/simulation/clone", {
      method: "POST",
      body: JSON.stringify({ missionId }),
    });
  },

  async runWhatIf(params: {
    baselineMissionId?: string;
    decisionOverride: string;
    forkSimTimeMinutes?: number;
    rationale?: string;
  }): Promise<any> {
    return request<any>("/simulation/what-if", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async runMonteCarlo(runCount: number = 100, seed: number = 20261107): Promise<any> {
    return request<any>("/simulation/monte-carlo", {
      method: "POST",
      body: JSON.stringify({ runCount, seed }),
    });
  },

  async injectFailure(params: {
    failureType: string;
    targetAgentId?: string;
    severity?: string;
  }): Promise<any> {
    return request<any>("/simulation/failure-injection", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // --- Phase 6 Validation, Analytics, Provenance & Decision Lineage ---
  async validateMission(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/validation/${missionId}`);
  },

  async getMissionAnalytics(
    missionId: string = "MARSWALK-001",
    filters?: {
      from?: string;
      to?: string;
      limit?: number;
      agentId?: string;
      severity?: string;
      includeDemo?: boolean;
    }
  ): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.includeDemo === false) params.set("includeDemo", "false");
    const qs = params.toString();
    return request<any>(`/analytics/${encodeURIComponent(missionId)}${qs ? `?${qs}` : ""}`);
  },

  async compareMissions(missionIds: string[]): Promise<any> {
    return request<any>("/analytics/compare", {
      method: "POST",
      body: JSON.stringify({ missionIds }),
    });
  },

  getAnalyticsExportUrl(
    missionId: string,
    section: "overview" | "timeseries" | "agents" | "routes" | "hazards",
    format: "csv" | "json",
    filters?: { from?: string; to?: string; limit?: number; agentId?: string; severity?: string }
  ): string {
    const params = new URLSearchParams({ section, format });
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.severity) params.set("severity", filters.severity);
    return `/api/analytics/${encodeURIComponent(missionId)}/export?${params.toString()}`;
  },

  // --- Recovery Batch 7: Isolated Judging Demo ---
  async getJudgingDemoCatalog(): Promise<any> {
    return request<any>("/demo/judging/catalog");
  },

  async listJudgingDemoRuns(): Promise<any> {
    return request<any>("/demo/judging/runs");
  },

  async runJudgingDemo(scenarioId: "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE"): Promise<any> {
    return request<any>("/demo/judging/run", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    });
  },

  async stepJudgingDemo(params: {
    scenarioId: "NOMINAL_EXPLORATION" | "OPERATIONAL_FAILURE";
    runId?: string;
    stepIndex?: number;
  }): Promise<any> {
    return request<any>("/demo/judging/step", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async resetJudgingDemo(): Promise<any> {
    return request<any>("/demo/judging/reset", {
      method: "POST",
    });
  },

  async getProvenance(key: string, value: string): Promise<any> {
    return request<any>(`/provenance/details?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`);
  },

  async getProvenanceExplorer(filters?: {
    source?: string;
    classification?: string;
    mission?: string;
    product?: string;
    stage?: string;
    validationStatus?: string;
    search?: string;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v.trim()) params.set(k, v.trim());
      });
    }
    const qs = params.toString();
    return request<any>(`/provenance/explorer${qs ? `?${qs}` : ""}`);
  },

  async getDecisionLineage(eventId: string = "evt-flagship-detour"): Promise<any> {
    return request<any>(`/decision-lineage/${eventId}`);
  },

  async getMissionReport(missionId: string = "MARSWALK-001", format: "json" | "csv" | "markdown" = "json"): Promise<any> {
    if (format === "csv" || format === "markdown") {
      const response = await fetch(`/api/missions/${missionId}/report?format=${format}`);
      return await response.text();
    }
    return request<any>(`/missions/${missionId}/report?format=json`);
  },

  async reassignAgentTask(taskId: string, targetAgentId: string, reason?: string): Promise<any> {
    return request<any>("/operations/tasks/reassign", {
      method: "POST",
      body: JSON.stringify({ taskId, targetAgentId, reason }),
    });
  },

  async createDigitalTwinSnapshot(tag: string = "OPERATOR_CHECKPOINT"): Promise<any> {
    return request<any>("/operations/digital-twin/snapshot", {
      method: "POST",
      body: JSON.stringify({ tag }),
    });
  },

  async getDigitalTwinInconsistencies(): Promise<any> {
    return request<any>("/operations/digital-twin/inconsistencies");
  },

  async getUnifiedMissionState(missionId?: string): Promise<any> {
    return request<any>(missionId ? `/missions/state/${missionId}` : "/missions/state");
  },

  async updateUnifiedMissionDomain(domain: string, patch: any, missionId?: string): Promise<any> {
    const url = missionId ? `/missions/state/${missionId}/domain/${domain}` : `/missions/state/${domain}`;
    return request<any>(url, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  // --- Recovery Batch 3: Operations Task Lifecycle, Agent Status, Telemetry, Comms & EVA Sessions ---
  async getOperationsTasks(missionId?: string): Promise<any[]> {
    const q = missionId ? `?missionId=${encodeURIComponent(missionId)}` : "";
    return request<any[]>(`/operations/tasks${q}`);
  },

  async createOperationsTask(payload: {
    agentId: string;
    missionId?: string;
    name: string;
    taskType: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    targetCoordinate: { latitude: number; longitude: number };
    targetDescription?: string;
    requiredCapabilities?: string[];
    dependencies?: string[];
    autoStart?: boolean;
  }): Promise<any> {
    return request<any>("/operations/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async transitionOperationsTask(
    taskId: string,
    action: "START" | "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL" | "FAIL",
    reason?: string
  ): Promise<any> {
    return request<any>(`/operations/tasks/${encodeURIComponent(taskId)}/transition`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },

  async transitionAgentStatus(
    agentId: string,
    status: string,
    reason?: string
  ): Promise<any> {
    return request<any>(`/operations/agents/${encodeURIComponent(agentId)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    });
  },

  async updateAgentTelemetry(
    agentId: string,
    payload: {
      batteryPercent?: number;
      speedKph?: number;
      internalTempC?: number;
      signalStrengthPercent?: number;
      suitOxygenReserveMinutes?: number;
    }
  ): Promise<any> {
    return request<any>(`/operations/agents/${encodeURIComponent(agentId)}/telemetry`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async enqueueCommPacket(payload: {
    sourceAgentId: string;
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "BULK";
    type: "TELEMETRY" | "HAZARD_ALERT" | "SCIENCE_DATA" | "COMMAND" | "EMERGENCY";
    payloadSizeKb: number;
    storeAndForward?: boolean;
  }): Promise<any> {
    return request<any>("/operations/comms/packets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async flushCommQueue(orbiterAvailable?: boolean): Promise<any> {
    return request<any>("/operations/comms/flush", {
      method: "POST",
      body: JSON.stringify(orbiterAvailable === undefined ? {} : { orbiterAvailable }),
    });
  },

  async getEvaSessions(missionId?: string): Promise<any[]> {
    const q = missionId ? `?missionId=${encodeURIComponent(missionId)}` : "";
    return request<any[]>(`/eva/sessions${q}`);
  },

  async createEvaSession(payload: {
    missionId?: string;
    title: string;
    crewAgentId?: string;
    supportRoverId?: string;
    routeId?: string;
    plannedDurationMinutes?: number;
  }): Promise<any> {
    return request<any>("/eva/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async transitionEvaSession(
    id: string,
    action: "START" | "PAUSE" | "RESUME" | "EMERGENCY_RETURN" | "COMPLETE" | "ABORT",
    reason?: string
  ): Promise<any> {
    return request<any>(`/eva/sessions/${encodeURIComponent(id)}/transition`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    });
  },

  async advanceEvaSession(id: string, minutes: number = 15): Promise<any> {
    return request<any>(`/eva/sessions/${encodeURIComponent(id)}/advance`, {
      method: "POST",
      body: JSON.stringify({ minutes }),
    });
  },

  async simulateEvaEmergencyReturn(
    id: string,
    params?: { scenario?: string; speedFactor?: number; extraHazardDelayMinutes?: number }
  ): Promise<any> {
    return request<any>(`/eva/sessions/${encodeURIComponent(id)}/simulate-emergency-return`, {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  },

  // Batch 9: Dynamic Scenario Builder CRUD & Isolated Execution
  async listScenarios(): Promise<any[]> {
    return request<any[]>("/scenarios");
  },

  async createScenario(payload: any): Promise<any> {
    return request<any>("/scenarios", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateScenario(id: string, patch: any): Promise<any> {
    return request<any>(`/scenarios/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async duplicateScenario(id: string, name?: string): Promise<any> {
    return request<any>(`/scenarios/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
  },

  async deleteScenario(id: string): Promise<{ deleted: boolean; id: string }> {
    return request<{ deleted: boolean; id: string }>(`/scenarios/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async executeScenario(id: string): Promise<any> {
    return request<any>(`/scenarios/${encodeURIComponent(id)}/execute`, {
      method: "POST",
    });
  },

  // Batch 9: Structured Explainable Copilot + Confirmation Gate
  async queryStructuredCopilot(query: string, missionId?: string): Promise<any> {
    return request<any>("/copilot/query", {
      method: "POST",
      body: JSON.stringify({ query, missionId }),
    });
  },

  async confirmCopilotAction(params: {
    missionId: string;
    actionType: "SELECT_ROUTE" | "ASSIGN_AGENT_TASK" | "EXECUTE_SCENARIO";
    payload?: Record<string, any>;
    confirmed: boolean;
    userRole?: string;
  }): Promise<any> {
    return request<any>("/copilot/confirm-action", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Batch 9: Multi-Objective Plan Comparison
  async comparePlanningAlternatives(params?: {
    missionId?: string;
    maxDurationMinutes?: number;
    returnRequired?: boolean;
    maxAllowedSlopeDeg?: number;
    targetIds?: string[];
  }): Promise<any> {
    return request<any>("/missions/compare-plans", {
      method: "POST",
      body: JSON.stringify(params || {}),
    });
  },

  async assignTargetToMission(targetId: string, missionId: string): Promise<any> {
    return request<any>(`/science/targets/${encodeURIComponent(targetId)}/assign-mission`, {
      method: "POST",
      body: JSON.stringify({ missionId }),
    });
  },

  // Authentic NASA Multi-Mission Data Endpoints (Milestones 1 - 7)
  async getAuthenticDTM(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/dtm?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticOptical(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/optical?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticSurfacePhotos(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/surface-photos?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticThermal(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/thermal?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticMineralogy(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/mineralogy?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticGeology(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/geology?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticSubsurfaceIce(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/subsurface-ice?lat=${lat}&lon=${lon}`);
  },

  async getAuthenticAtmosphere(lat: number, lon: number, sol?: number, hour?: number): Promise<any> {
    const qSol = sol !== undefined ? `&sol=${sol}` : "";
    const qHour = hour !== undefined ? `&hour=${hour}` : "";
    return request<any>(`/data/authentic/atmosphere?lat=${lat}&lon=${lon}${qSol}${qHour}`);
  },

  async getAuthenticRadiation(lat: number, lon: number, sol?: number, hours?: number): Promise<any> {
    const qSol = sol !== undefined ? `&sol=${sol}` : "";
    const qHours = hours !== undefined ? `&hours=${hours}` : "";
    return request<any>(`/data/authentic/radiation?lat=${lat}&lon=${lon}${qSol}${qHours}`);
  },

  async getSpatiotemporalAlignment(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/spatiotemporal-alignment?lat=${lat}&lon=${lon}`);
  },

  async getUncertaintyReport(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/uncertainty-report?lat=${lat}&lon=${lon}`);
  },

  async getUnifiedScienceLayer(lat: number, lon: number, sol?: number, hour?: number): Promise<any> {
    const qSol = sol !== undefined ? `&sol=${sol}` : "";
    const qHour = hour !== undefined ? `&hour=${hour}` : "";
    return request<any>(`/data/authentic/unified-science-layer?lat=${lat}&lon=${lon}${qSol}${qHour}`);
  },

  async getMicroTerrainObstacles(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/micro-terrain?lat=${lat}&lon=${lon}`);
  },

  async getAstronautMobility(distanceKm?: number, slopeDeg?: number, walkMode?: string, fatigueIndex?: number): Promise<any> {
    const params = new URLSearchParams();
    if (distanceKm !== undefined) params.append("distanceKm", distanceKm.toString());
    if (slopeDeg !== undefined) params.append("slopeDeg", slopeDeg.toString());
    if (walkMode) params.append("walkMode", walkMode);
    if (fatigueIndex !== undefined) params.append("fatigueIndex", fatigueIndex.toString());
    return request<any>(`/data/authentic/astronaut-mobility?${params.toString()}`);
  },

  async getConstellationComms(lat: number, lon: number, sol?: number, durationMin?: number): Promise<any> {
    const qSol = sol !== undefined ? `&sol=${sol}` : "";
    const qDur = durationMin !== undefined ? `&durationMin=${durationMin}` : "";
    return request<any>(`/data/authentic/constellation-comms?lat=${lat}&lon=${lon}${qSol}${qDur}`);
  },

  async getRoboticSupportPlan(mode?: string, distanceKm?: number, payloadKg?: number): Promise<any> {
    const params = new URLSearchParams();
    if (mode) params.append("mode", mode);
    if (distanceKm !== undefined) params.append("distanceKm", distanceKm.toString());
    if (payloadKg !== undefined) params.append("payloadKg", payloadKg.toString());
    return request<any>(`/data/authentic/robotic-support?${params.toString()}`);
  },

  async getBuddyPairState(distanceMeters?: number, o2Left1?: number, o2Left2?: number): Promise<any> {
    const params = new URLSearchParams();
    if (distanceMeters !== undefined) params.append("distanceMeters", distanceMeters.toString());
    if (o2Left1 !== undefined) params.append("o2Left1", o2Left1.toString());
    if (o2Left2 !== undefined) params.append("o2Left2", o2Left2.toString());
    return request<any>(`/data/authentic/buddy-pair?${params.toString()}`);
  },

  async getMepagPrioritizedTargets(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/mepag-targets?lat=${lat}&lon=${lon}`);
  },

  async getParetoRoutePlans(lat: number, lon: number): Promise<any> {
    return request<any>(`/data/authentic/pareto-plans?lat=${lat}&lon=${lon}`);
  },

  async getObservationPlan(targetId?: string, targetType?: string, formation?: string): Promise<any> {
    const params = new URLSearchParams();
    if (targetId) params.append("targetId", targetId);
    if (targetType) params.append("targetType", targetType);
    if (formation) params.append("formation", formation);
    return request<any>(`/data/authentic/observation-plan?${params.toString()}`);
  },

  async getSafeHazardAvoidanceRoute(startLat: number, startLon: number, destLat: number, destLon: number, bufferM?: number, dustStorm?: boolean): Promise<any> {
    const qBuf = bufferM !== undefined ? `&bufferM=${bufferM}` : "";
    const qDust = dustStorm ? `&dustStorm=true` : "";
    return request<any>(`/data/authentic/safe-route?startLat=${startLat}&startLon=${startLon}&destLat=${destLat}&destLon=${destLon}${qBuf}${qDust}`);
  },

  async simulateDustStorm(latitude: number, longitude: number, sol = 100, tau?: number, stormType: string = "REGIONAL_STORM"): Promise<any> {
    return request<any>("/simulation/dust-storm", {
      method: "POST",
      body: JSON.stringify({ latitude, longitude, sol, tau, stormType }),
    });
  },
};
