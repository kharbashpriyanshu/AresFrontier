import { Request, Response } from "express";
import {
  APIResponse,
  AuditChainBlock,
  AuditVerificationResult,
  CopilotMissionPlanRequest,
  DataCoverage,
  Hazard,
  HazardAssessment,
  MissionPlanVersion,
  MissionRecommendation,
  RouteCandidate,
  ScienceObjective,
  ScienceObjectiveId,
  ScienceValueBreakdown,
  StructuredCopilotResponse,
  TerrainAssessment,
  UserRole,
} from "../types/index.js";
import { hazardEngine } from "../services/hazard/hazardEngine.js";
import { scienceObjectiveEngine } from "../services/science/scienceObjectiveEngine.js";
import { terrainEngine } from "../services/terrain/terrainEngine.js";
import { routeOptimizationEngine } from "../services/intelligence/routeOptimizationEngine.js";
import { missionReasoningService } from "../services/intelligence/missionReasoningService.js";
import { missionEngine } from "../services/mission/missionEngine.js";
import { dataCoverageEngine } from "../services/planetary/dataCoverageEngine.js";
import { auditChainService } from "../services/security/auditChainService.js";
import { getAuditLog, recordAuditEvent, signMissionToken } from "../middleware/securityMiddleware.js";
import { ProvenanceService } from "../services/planetary/provenanceService.js";

/**
 * Returns all cataloged Martian topographic, slope, and scarp hazards.
 */
export async function getHazards(_req: Request, res: Response): Promise<void> {
  const hazards = hazardEngine.getAllHazards();
  const response: APIResponse<Hazard[]> = {
    success: true,
    data: hazards,
    metadata: {
      source: "NASA MOLA & USGS Astrogeology Planetary Surface Hazards Catalog",
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(response);
}

/**
 * Returns all predefined Mars exploration science objectives.
 */
export async function getScienceObjectives(_req: Request, res: Response): Promise<void> {
  const objectives = scienceObjectiveEngine.getObjectives();
  const response: APIResponse<ScienceObjective[]> = {
    success: true,
    data: objectives,
    metadata: {
      source: "NASA MEPAG (Mars Exploration Program Analysis Group) Science Goals",
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(response);
}

/**
 * Factorized science target evaluation separating evidence from project scoring.
 */
export async function getScienceTargetBreakdown(req: Request, res: Response): Promise<void> {
  const { targetId, objectiveId } = req.query as { targetId?: string; objectiveId?: ScienceObjectiveId };
  if (!targetId) {
    res.status(400).json({ success: false, error: { code: "MISSING_TARGET_ID", message: "targetId is required" } });
    return;
  }

  const targets = (await import("../services/nasa/adapters/benchmarkData.js")).VERIFIED_NASA_SCIENCE_TARGETS;
  const target = targets.find((t) => t.id === targetId);
  if (!target) {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: `Target ${targetId} not found` } });
    return;
  }

  const breakdown = scienceObjectiveEngine.evaluateTargetFactorized(target, objectiveId);
  res.status(200).json({
    success: true,
    data: breakdown,
    metadata: {
      source: "Factorized Planetary Science Scoring Engine v3.0",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Evaluates local slope, roughness, and traversal difficulty for a coordinate or segment.
 */
export async function assessTerrain(req: Request, res: Response): Promise<void> {
  const { coordinate, startCoordinate, endCoordinate } = req.body;

  if (startCoordinate && endCoordinate) {
    const assessment = terrainEngine.assessSegment(startCoordinate, endCoordinate);
    const response: APIResponse<TerrainAssessment> = {
      success: true,
      data: assessment,
      metadata: {
        source: "NASA MOLA 128ppd Elevation Surface Gradients (DERIVED)",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(200).json(response);
    return;
  }

  if (coordinate) {
    const assessment = terrainEngine.assessPoint(coordinate);
    const response: APIResponse<TerrainAssessment> = {
      success: true,
      data: assessment,
      metadata: {
        source: "NASA MOLA Topographic DEM Model (DERIVED)",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(200).json(response);
    return;
  }

  res.status(400).json({
    success: false,
    error: {
      code: "INVALID_PARAMETERS",
      message: "Provide either 'coordinate' or both 'startCoordinate' and 'endCoordinate'.",
    },
  });
}

/**
 * Assesses hazards for a route or coordinate.
 */
export async function assessHazards(req: Request, res: Response): Promise<void> {
  const { route, coordinate } = req.body;

  if (route) {
    const assessment = hazardEngine.assessRouteHazards(route);
    const response: APIResponse<HazardAssessment> = {
      success: true,
      data: assessment,
      metadata: {
        source: "Mars Hazard Engine (Spatial Proximity + MOLA Slopes)",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(200).json(response);
    return;
  }

  if (coordinate) {
    const assessment = hazardEngine.assessPointHazards(coordinate);
    const response: APIResponse<HazardAssessment> = {
      success: true,
      data: assessment,
      metadata: {
        source: "Mars Hazard Engine (Spatial Proximity + Point Slope)",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(200).json(response);
    return;
  }

  res.status(400).json({
    success: false,
    error: {
      code: "INVALID_PARAMETERS",
      message: "Provide either 'route' or 'coordinate' to evaluate hazards.",
    },
  });
}

/**
 * Generates 4 differentiated route candidates and identifies Pareto-efficient options.
 */
export async function optimizeRoute(req: Request, res: Response): Promise<void> {
  const body = req.body as CopilotMissionPlanRequest;

  if (!body.startCoordinate) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_START_COORDINATE",
        message: "A startCoordinate is required to optimize mission route candidates.",
      },
    });
    return;
  }

  const candidates = await routeOptimizationEngine.generateCandidates(body);

  const block = auditChainService.appendEvent({
    userId: req.user?.userId || "Mission Operator",
    role: req.user?.role || "MISSION_COMMAND",
    action: "OPTIMIZE_ROUTE",
    missionPlanId: `plan-${Date.now()}`,
    details: {
      start: body.startCoordinate,
      dest: body.destinationCoordinate,
      objective: body.objectiveId,
      candidateCount: candidates.length,
      paretoCount: candidates.filter((c) => c.multiObjectiveScore?.isParetoEfficient).length,
    },
  });

  const response: APIResponse<RouteCandidate[]> = {
    success: true,
    data: candidates,
    metadata: {
      source: "Multi-Objective Planetary Route Optimization Engine (Pareto Frontier v3.0)",
      timestamp: new Date().toISOString(),
      cached: false,
    },
  };
  res.status(200).json(response);
}

/**
 * Generates structured, explainable mission recommendation across candidates.
 */
export async function generateRecommendation(req: Request, res: Response): Promise<void> {
  const { candidates, objectiveId, maxDurationMinutes } = req.body as {
    candidates: RouteCandidate[];
    objectiveId?: ScienceObjectiveId;
    maxDurationMinutes?: number;
  };

  if (!candidates || candidates.length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_CANDIDATES",
        message: "An array of RouteCandidates is required to generate a mission recommendation.",
      },
    });
    return;
  }

  const recommendation = missionReasoningService.generateRecommendation(
    candidates,
    objectiveId,
    maxDurationMinutes
  );

  const block = auditChainService.appendEvent({
    userId: req.user?.userId || "Mission Operator",
    role: req.user?.role || "MISSION_COMMAND",
    action: "GENERATE_RECOMMENDATION",
    missionPlanId: recommendation.recommendedRouteId,
    details: {
      recommendedRouteId: recommendation.recommendedRouteId,
      decision: recommendation.decision,
      auditHash: recommendation.auditHash,
    },
  });

  const response: APIResponse<MissionRecommendation> = {
    success: true,
    data: recommendation,
    metadata: {
      source: "Explainable Mission Reasoning Service (Pareto & Uncertainty Aware)",
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(response);
}

/**
 * High-level Copilot Mission Plan pipeline:
 * NLP objective parsing -> Candidate generation -> Pareto analysis -> Reasoning -> Audit block.
 */
export async function copilotMissionPlan(req: Request, res: Response): Promise<void> {
  const body = req.body as CopilotMissionPlanRequest;

  if (!body.startCoordinate) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_START_COORDINATE",
        message: "startCoordinate is required for Copilot mission planning.",
      },
    });
    return;
  }

  // Parse NLP prompt if supplied
  const parsed = missionReasoningService.parseNaturalLanguagePrompt(body.prompt);
  const effectiveObjective: ScienceObjectiveId = body.objectiveId || parsed.objectiveId;
  const effectiveDuration = body.maxDurationMinutes || parsed.maxDurationMinutes || 180;

  const planRequest: CopilotMissionPlanRequest = {
    ...body,
    objectiveId: effectiveObjective,
    maxDurationMinutes: effectiveDuration,
  };

  const candidates = await routeOptimizationEngine.generateCandidates(planRequest);
  const recommendation = missionReasoningService.generateRecommendation(
    candidates,
    effectiveObjective,
    effectiveDuration
  );

  const chosenCandidate = candidates.find((c) => c.id === recommendation.recommendedRouteId) || candidates[0];
  const coverage = await dataCoverageEngine.assessRouteCoverage(chosenCandidate.route);
  const evaAssessment = missionEngine.assessEVAFeasibility(chosenCandidate.route, {
    maxDurationMinutes: effectiveDuration,
    startCoordinate: body.startCoordinate,
    returnRequired: body.returnRequired ?? true,
  });

  const planId = `copilot-plan-${Date.now()}`;
  const block = auditChainService.appendEvent({
    userId: req.user?.userId || "Mission Copilot Assistant",
    role: req.user?.role || "MISSION_COMMAND",
    action: "ASSESS_MISSION",
    missionPlanId: planId,
    details: {
      prompt: body.prompt,
      objective: effectiveObjective,
      recommended: recommendation.recommendedRouteId,
      score: chosenCandidate.overallScore,
      paretoEfficient: chosenCandidate.multiObjectiveScore?.isParetoEfficient,
    },
  });

  const planVersion = auditChainService.registerPlanVersion({
    planId,
    routeId: chosenCandidate.route.id,
    status: "ASSESSED",
    recommendedProfile: chosenCandidate.profileType,
    riskAdjustedScore: chosenCandidate.overallScore,
    userId: req.user?.userId || "Mission Operator",
    role: req.user?.role || "MISSION_COMMAND",
  });

  const structuredResponse: StructuredCopilotResponse = {
    missionObjective: {
      id: effectiveObjective,
      name: scienceObjectiveEngine.getObjective(effectiveObjective).name,
      parsedPrompt: body.prompt,
      constraints: parsed.constraints,
      preferredEvidence: parsed.preferredEvidence,
    },
    recommendedRoute: chosenCandidate,
    alternatives: candidates.filter((c) => c.id !== chosenCandidate.id),
    paretoFrontier: candidates.filter((c) => c.multiObjectiveScore?.isParetoEfficient),
    scientificRationale: recommendation.reasoning,
    operationalRationale: recommendation.operationalRecommendations,
    hazards: chosenCandidate.hazards,
    evidence: {
      coverage,
      elevationSource: chosenCandidate.route.elevationProfile.length > 0 ? "NASA MGS MOLA 128ppd Gridded Topography" : "MOLA Areoid Datum",
      scienceEvidenceCount: chosenCandidate.scienceTargets.length,
    },
    uncertainty: {
      terrainUncertaintyM: chosenCandidate.coverage?.elevation === "HIGH" ? 2.5 : 20.0,
      confidenceSummary: `Model evidence confidence: ${coverage.overallEvidence}. Altimetry resolution: ${coverage.sourceResolutionM || 463}m.`,
      limitations: [
        "Orbital altimetry spatial resolution ~463m; sub-pixel micro-boulders (<1m) not resolved.",
        "Metabolic consumption estimated using adapted Martian 0.38g Tobler pacing equations.",
      ],
    },
    evaAssessment,
    decision: recommendation.decision,
    directives: recommendation.operationalRecommendations,
    provenance: ProvenanceService.createProjectRuleProvenance(
      "Mission Copilot Decision Intelligence Pipeline v3.0",
      "Deterministic NLP objective mapping, Pareto multi-objective optimization, and hash-chained audit verification"
    ),
    auditBlock: block,
    planVersion: planVersion.version,
    planStatus: planVersion.status,
  };

  // Backward compatible envelope + structured copilot data
  const responseData = {
    ...structuredResponse,
    planId,
    objectiveId: effectiveObjective,
    candidates,
    recommendation,
    auditEvent: {
      id: block.eventId,
      missionPlanId: planId,
      action: block.action,
      createdBy: block.userId,
      timestamp: block.timestamp,
      integrityHash: block.integrityHash,
      details: block.details,
    },
  };

  res.status(200).json({
    success: true,
    data: responseData,
    metadata: {
      source: "Mission Copilot Decision Intelligence Suite v3.0",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Data coverage endpoint for regional evidence quantification.
 */
export async function getRegionalCoverage(req: Request, res: Response): Promise<void> {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ success: false, error: { code: "INVALID_COORDINATES", message: "lat and lon are required" } });
    return;
  }

  const coverage = await dataCoverageEngine.assessLocationCoverage({ latitude: lat, longitude: lon });
  res.status(200).json({
    success: true,
    data: coverage,
    metadata: {
      source: "Data Coverage Intelligence Engine v3.0",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Returns security audit logs and integrity signatures.
 */
export async function getAuditEvents(_req: Request, res: Response): Promise<void> {
  const logs = getAuditLog();
  res.status(200).json({
    success: true,
    data: logs,
    metadata: {
      source: "Cybersecurity Audit Trail (SHA-256 Signatures)",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Cryptographic audit chain verification endpoint.
 */
export async function verifyAuditChain(_req: Request, res: Response): Promise<void> {
  const result = auditChainService.verifyChain();
  res.status(200).json({
    success: true,
    data: result,
    metadata: {
      source: "Hash-Chained Tamper-Evident Audit Verifier (SHA-256)",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Returns complete cryptographic hash chain blocks.
 */
export async function getAuditChain(_req: Request, res: Response): Promise<void> {
  const chain = auditChainService.getChain();
  res.status(200).json({
    success: true,
    data: chain,
    metadata: {
      source: "Cryptographic Audit Chain Store",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Issues development/testing JWT token for a given role.
 */
export async function issueMissionToken(req: Request, res: Response): Promise<void> {
  const { role, userId, callsign } = req.body as { role?: UserRole; userId?: string; callsign?: string };
  const effectiveRole: UserRole = role || "ASTRONAUT";
  const effectiveUserId = userId || `astro-${Date.now().toString(36)}`;
  const effectiveCallsign = callsign || "Ares-Explorer";

  const token = signMissionToken({
    userId: effectiveUserId,
    role: effectiveRole,
    callsign: effectiveCallsign,
  });

  res.status(200).json({
    success: true,
    data: {
      token,
      role: effectiveRole,
      userId: effectiveUserId,
      callsign: effectiveCallsign,
      expiresIn: "24h",
    },
    metadata: {
      source: "Mission Flight Operations Token Authority",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Approves a mission plan (Requires MISSION_COMMAND role).
 */
export async function approveMissionPlan(req: Request, res: Response): Promise<void> {
  const { planId, routeId, score, profile } = req.body;
  if (!planId) {
    res.status(400).json({ success: false, error: { code: "MISSING_PLAN_ID", message: "planId is required" } });
    return;
  }

  const planVer = auditChainService.registerPlanVersion({
    planId,
    routeId: routeId || "route-default",
    status: "APPROVED",
    recommendedProfile: profile || "balanced",
    riskAdjustedScore: score || 85,
    userId: req.user?.userId || "Flight Commander",
    role: req.user?.role || "MISSION_COMMAND",
  });

  res.status(200).json({
    success: true,
    data: planVer,
    metadata: {
      source: "Mission Command Approval Console",
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Locks a mission plan, making it immutable (Requires MISSION_COMMAND role).
 */
export async function lockMissionPlan(req: Request, res: Response): Promise<void> {
  const { planId, routeId, score, profile } = req.body;
  if (!planId) {
    res.status(400).json({ success: false, error: { code: "MISSING_PLAN_ID", message: "planId is required" } });
    return;
  }

  const planVer = auditChainService.registerPlanVersion({
    planId,
    routeId: routeId || "route-default",
    status: "LOCKED",
    recommendedProfile: profile || "balanced",
    riskAdjustedScore: score || 85,
    userId: req.user?.userId || "Flight Commander",
    role: req.user?.role || "MISSION_COMMAND",
  });

  res.status(200).json({
    success: true,
    data: planVer,
    metadata: {
      source: "Mission Command Immutability Lock",
      timestamp: new Date().toISOString(),
    },
  });
}
