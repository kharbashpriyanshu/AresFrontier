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
} from "../types/index.js";

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
  async createMission(parameters: MissionParameters): Promise<{
    id: string;
    routeId: string;
    parameters: MissionParameters;
    evaAssessment: EVAAssessment;
  }> {
    return request("/missions", {
      method: "POST",
      body: JSON.stringify(parameters),
    });
  },

  async getMissionById(id: string): Promise<{
    id: string;
    routeId: string;
    parameters: MissionParameters;
    evaAssessment: EVAAssessment;
  }> {
    return request(`/missions/${encodeURIComponent(id)}`);
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
    return request<any>(`/replay/${missionId}`);
  },

  async startReplay(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/replay/${missionId}/start`, { method: "POST" });
  },

  async stepReplay(direction: "FORWARD" | "BACKWARD" = "FORWARD"): Promise<any> {
    return request<any>("/replay/MARSWALK-001/step", {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  },

  async seekReplay(target: number): Promise<any> {
    return request<any>("/replay/MARSWALK-001/seek", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  },

  async resetReplay(): Promise<any> {
    return request<any>("/replay/MARSWALK-001/reset", { method: "POST" });
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

  async getMissionAnalytics(missionId: string = "MARSWALK-001"): Promise<any> {
    return request<any>(`/analytics/${missionId}`);
  },

  async getProvenance(key: string, value: string): Promise<any> {
    return request<any>(`/provenance/details?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`);
  },

  async getDecisionLineage(eventId: string = "evt-flagship-detour"): Promise<any> {
    return request<any>(`/decision-lineage/${eventId}`);
  },
};
