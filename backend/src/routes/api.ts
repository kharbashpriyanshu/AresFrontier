import { Router } from "express";
import {
  getLocationById,
  getLocations,
} from "../controllers/locationController.js";
import { getTerrain } from "../controllers/terrainController.js";
import {
  getScienceTargets,
  getScienceTargetById,
  getScientificAssessment,
  evaluateTarget,
  evaluateObjectives,
  classifyMineralogy,
  assessIce,
  assignTargetToMission,
  getScienceDecisions,
} from "../controllers/scienceController.js";
import {
  createRoute,
  getRouteById,
  getAllRoutes,
} from "../controllers/routeController.js";
import {
  createMission,
  updateMission,
  deleteMission,
  getMissionById,
  getAllMissions,
  getUnifiedMissionState,
  updateUnifiedMissionDomain,
  getMissionReport,
} from "../controllers/missionController.js";
import { assessMission } from "../controllers/assessmentController.js";
import {
  getDataSources,
  getDataStatus,
  getProvenanceExplorer,
  getIngestedDatasets,
  ingestMars2020Traverse,
  getAuthenticDTM,
  getAuthenticOptical,
  getAuthenticSurfacePhotos,
  getAuthenticThermal,
  getAuthenticMineralogy,
  getAuthenticGeology,
  getAuthenticSubsurfaceIce,
  getAuthenticAtmosphere,
  getAuthenticRadiation,
  getSpatiotemporalAlignment,
  getUncertaintyReport,
  getUnifiedScienceLayer,
  getMLValidationMetrics,
  getMicroTerrainObstacles,
  getAstronautMobility,
  getConstellationComms,
  getRoboticSupportPlan,
  getBuddyPairState,
  getMepagPrioritizedTargets,
  getParetoRoutePlans,
  getObservationPlan,
  getSafeHazardAvoidanceRoute,
  getCommWindowSchedule,
  simulateDustStormImpact,
} from "../controllers/dataController.js";
import {
  getHazards,
  getScienceObjectives,
  getScienceTargetBreakdown,
  assessTerrain,
  assessHazards,
  optimizeRoute,
  generateRecommendation,
  copilotMissionPlan,
  getAuditEvents,
  verifyAuditChain,
  getAuditChain,
  issueMissionToken,
  approveMissionPlan,
  lockMissionPlan,
  getRegionalCoverage,
} from "../controllers/intelligenceController.js";
import {
  checkRateLimit,
  authenticateRequest,
  authorizeRequest,
  verifyDataIntegrity,
} from "../middleware/securityMiddleware.js";

export const apiRouter = Router();

// Apply security middleware pipeline
apiRouter.use(checkRateLimit);
apiRouter.use(authenticateRequest);
apiRouter.use(verifyDataIntegrity);

// 1. Planetary Locations
apiRouter.get("/locations", getLocations);
apiRouter.get("/locations/:id", getLocationById);

// 2. Terrain & Topography
apiRouter.get("/terrain", getTerrain);

// 3. Planetary Science
apiRouter.get("/science/targets", getScienceTargets);
apiRouter.get("/science/targets/breakdown", getScienceTargetBreakdown);
apiRouter.get("/science/targets/:id", getScienceTargetById);
apiRouter.post("/science/targets/:id/assign-mission", assignTargetToMission);
apiRouter.get("/science/assessment", getScientificAssessment);
apiRouter.post("/science/evaluate-target", evaluateTarget);
apiRouter.post("/science/evaluate-objectives", evaluateObjectives);
apiRouter.post("/science/classify-mineralogy", classifyMineralogy);
apiRouter.post("/science/assess-ice", assessIce);
apiRouter.get("/science/decisions", getScienceDecisions);

// 4. Routes
apiRouter.get("/routes", getAllRoutes);
apiRouter.post("/routes", createRoute);
apiRouter.get("/routes/:id", getRouteById);

// 5. Missions & EVA
apiRouter.get("/missions", getAllMissions);
apiRouter.post("/missions", createMission);
apiRouter.get("/missions/state", getUnifiedMissionState);
apiRouter.get("/missions/state/:id", getUnifiedMissionState);
apiRouter.patch("/missions/state/:domain", updateUnifiedMissionDomain);
apiRouter.patch("/missions/state/:id/domain/:domain", updateUnifiedMissionDomain);
apiRouter.get("/missions/:id/report", getMissionReport);
apiRouter.get("/missions/:id", getMissionById);
apiRouter.patch("/missions/:id", updateMission);
apiRouter.put("/missions/:id", updateMission);
apiRouter.delete("/missions/:id", deleteMission);
apiRouter.post("/missions/:id/approve", authorizeRequest(["MISSION_COMMAND"]), approveMissionPlan);
apiRouter.post("/missions/:id/lock", authorizeRequest(["MISSION_COMMAND"]), lockMissionPlan);

// 6. AI/ML Assessment (Person 3)
apiRouter.post("/assessment", assessMission);

// 7. Mission Intelligence, Hazards, Objectives & Copilot (Phase 2 & 3)
apiRouter.get("/intelligence/hazards", getHazards);
apiRouter.get("/intelligence/science-objectives", getScienceObjectives);
apiRouter.post("/intelligence/assess-terrain", assessTerrain);
apiRouter.post("/intelligence/assess-hazards", assessHazards);
apiRouter.post("/intelligence/optimize-route", optimizeRoute);
apiRouter.post("/intelligence/mission-recommendation", generateRecommendation);
apiRouter.post("/copilot/mission-plan", copilotMissionPlan);
apiRouter.get("/intelligence/audit-log", getAuditEvents);
apiRouter.get("/planetary/coverage", getRegionalCoverage);

// 8. Cybersecurity & Cryptographic Hash Chain (Phase 3)
apiRouter.post("/security/verify-audit-chain", verifyAuditChain);
apiRouter.get("/security/audit-chain", getAuditChain);
apiRouter.post("/security/token", issueMissionToken);

// 9. NASA Data Pipelines, Authentic Multi-Mission Data & System Health
apiRouter.get("/data/sources", getDataSources);
apiRouter.get("/data/status", getDataStatus);
apiRouter.get("/data/ingested", getIngestedDatasets);
apiRouter.post("/data/ingest/m20-traverse", ingestMars2020Traverse);
apiRouter.get("/data/authentic/dtm", getAuthenticDTM);
apiRouter.get("/data/authentic/optical", getAuthenticOptical);
apiRouter.get("/data/authentic/surface-photos", getAuthenticSurfacePhotos);
apiRouter.get("/data/authentic/thermal", getAuthenticThermal);
apiRouter.get("/data/authentic/mineralogy", getAuthenticMineralogy);
apiRouter.get("/data/authentic/geology", getAuthenticGeology);
apiRouter.get("/data/authentic/subsurface-ice", getAuthenticSubsurfaceIce);
apiRouter.get("/data/authentic/atmosphere", getAuthenticAtmosphere);
apiRouter.get("/data/authentic/radiation", getAuthenticRadiation);
apiRouter.get("/data/authentic/spatiotemporal-alignment", getSpatiotemporalAlignment);
apiRouter.get("/data/authentic/uncertainty-report", getUncertaintyReport);
apiRouter.get("/data/authentic/unified-science-layer", getUnifiedScienceLayer);
apiRouter.get("/data/authentic/ml-validation", getMLValidationMetrics);
apiRouter.get("/data/authentic/micro-terrain", getMicroTerrainObstacles);
apiRouter.get("/data/authentic/astronaut-mobility", getAstronautMobility);
apiRouter.get("/data/authentic/constellation-comms", getConstellationComms);
apiRouter.get("/data/authentic/robotic-support", getRoboticSupportPlan);
apiRouter.get("/data/authentic/buddy-pair", getBuddyPairState);
apiRouter.get("/data/authentic/mepag-targets", getMepagPrioritizedTargets);
apiRouter.get("/data/authentic/pareto-plans", getParetoRoutePlans);
apiRouter.get("/data/authentic/observation-plan", getObservationPlan);
apiRouter.get("/data/authentic/safe-route", getSafeHazardAvoidanceRoute);
apiRouter.post("/intelligence/safe-route", getSafeHazardAvoidanceRoute);
apiRouter.all("/data/authentic/comm-schedule", getCommWindowSchedule);
apiRouter.post("/simulation/dust-storm", simulateDustStormImpact);

// 10. Multi-Agent Planetary Field Operations (Phase 4)
import { operationsController } from "../controllers/operationsController.js";

apiRouter.get("/operations/agents", operationsController.getAgents);
apiRouter.get("/operations/agents/:id", operationsController.getAgentById);
apiRouter.post("/operations/agents/:id/status", operationsController.transitionAgentStatus);
apiRouter.post("/operations/agents/:id/telemetry", operationsController.updateAgentTelemetry);
apiRouter.post("/operations/agents/:id/tasks", operationsController.assignTask);
apiRouter.get("/operations/tasks", operationsController.getTasks);
apiRouter.post("/operations/tasks", operationsController.createAndAssignTask);
apiRouter.post("/operations/tasks/:taskId/transition", operationsController.transitionTask);
apiRouter.post("/operations/tasks/reassign", operationsController.reassignTask);
apiRouter.post("/operations/digital-twin/snapshot", operationsController.createDigitalTwinSnapshot);
apiRouter.get("/operations/digital-twin/inconsistencies", operationsController.getDigitalTwinInconsistencies);
apiRouter.post("/operations/agents/:id/commands", operationsController.executeCommand);

apiRouter.get("/operations/communications", operationsController.getCommunications);
apiRouter.get("/operations/communications/windows", operationsController.getCommunicationWindows);

apiRouter.get("/operations/timeline", operationsController.getTimeline);

apiRouter.post("/operations/simulation/start", operationsController.startSimulation);
apiRouter.post("/operations/simulation/pause", operationsController.pauseSimulation);
apiRouter.post("/operations/simulation/reset", operationsController.resetSimulation);
apiRouter.post("/operations/simulation/advance", operationsController.advanceSimulation);

apiRouter.post("/operations/replan", operationsController.triggerReplan);
apiRouter.post("/operations/replan/:id/approve", authorizeRequest(["MISSION_COMMAND"]), operationsController.approveReplan);

apiRouter.post("/operations/demo-hazard-recon", operationsController.triggerDemoHazardRecon);
apiRouter.post("/operations/emergency", operationsController.triggerEmergency);

apiRouter.get("/operations/science-queue", operationsController.getScienceQueue);
apiRouter.post("/operations/science-queue/:id/assign", operationsController.assignScienceQueue);

apiRouter.get("/operations/state", operationsController.getOperationsState);
apiRouter.post("/operations/copilot/query", operationsController.copilotQuery);

// Phase 5 Verified Simulation, Observations, Orbital & Security Endpoints
apiRouter.get("/operations/observations", operationsController.getObservations);
apiRouter.get("/operations/observations/:id", operationsController.getObservationById);

apiRouter.get("/operations/orbital/windows", operationsController.getOrbitalWindows);
apiRouter.get("/operations/orbital/current", operationsController.getOrbitalCurrent);

apiRouter.get("/operations/comms/queue", operationsController.getCommsQueue);
apiRouter.get("/operations/comms/status", operationsController.getCommsStatus);
apiRouter.post("/operations/comms/packets", operationsController.enqueueCommPacket);
apiRouter.post("/operations/comms/flush", operationsController.flushCommQueue);

// EVA Console Session Lifecycle & Safety
apiRouter.get("/eva/sessions", operationsController.listEvaSessions);
apiRouter.post("/eva/sessions", operationsController.createEvaSession);
apiRouter.get("/eva/sessions/:id", operationsController.getEvaSession);
apiRouter.post("/eva/sessions/:id/transition", operationsController.transitionEvaSession);
apiRouter.post("/eva/sessions/:id/advance", operationsController.advanceEvaSession);
apiRouter.post("/eva/sessions/:id/simulate-emergency-return", operationsController.simulateEvaEmergencyReturn);

apiRouter.get("/operations/events", operationsController.getMissionEvents);
apiRouter.get("/operations/events/:id", operationsController.getMissionEventById);

apiRouter.get("/operations/security/permissions", operationsController.getSecurityPermissions);

apiRouter.post("/operations/commands", operationsController.submitSecureCommand);
apiRouter.post("/operations/commands/:id/cancel", authorizeRequest(["MISSION_COMMAND"]), operationsController.cancelCommand);

apiRouter.post("/operations/checkpoint", authorizeRequest(["MISSION_COMMAND"]), operationsController.createCheckpoint);
apiRouter.post("/operations/checkpoint/restore", authorizeRequest(["MISSION_COMMAND"]), operationsController.restoreCheckpoint);

apiRouter.post("/operations/scenarios/blackout", operationsController.scenarioBlackout);
apiRouter.post("/operations/scenarios/sensor-hazard", operationsController.scenarioSensorHazard);
apiRouter.post("/operations/scenarios/emergency", operationsController.scenarioEmergency);

// Phase 6 Digital Twin & Mission Replay
apiRouter.get("/replay/missions", operationsController.getReplayMissions);
apiRouter.get("/replay/:missionId", operationsController.getReplayState);
apiRouter.post("/replay/:missionId/start", operationsController.startReplay);
apiRouter.post("/replay/:missionId/pause", operationsController.pauseReplay);
apiRouter.post("/replay/:missionId/resume", operationsController.resumeReplay);
apiRouter.post("/replay/:missionId/step", operationsController.stepReplay);
apiRouter.post("/replay/:missionId/seek", operationsController.seekReplay);
apiRouter.post("/replay/:missionId/reset", operationsController.resetReplay);
apiRouter.get("/replay/:missionId/reconstruct", operationsController.reconstructHistoricalState);
apiRouter.get("/replay/:missionId/events/:eventId", operationsController.inspectReplayEvent);
apiRouter.post("/replay/:missionId/compare", operationsController.compareHistoricalStates);
apiRouter.get("/replay/:missionId/export", operationsController.exportReplayData);
apiRouter.get("/replay/:missionId/snapshots", operationsController.getReplaySnapshots);

// Phase 6 What-If Simulation, Monte Carlo & Failure Injection
apiRouter.post("/simulation/clone", operationsController.cloneMission);
apiRouter.post("/simulation/what-if", operationsController.runWhatIf);
apiRouter.post("/simulation/monte-carlo", operationsController.runMonteCarlo);
apiRouter.post("/simulation/failure-injection", operationsController.injectFailure);

// Phase 6 Validation, Analytics, Provenance & Decision Lineage
apiRouter.get("/validation/:missionId", operationsController.validateMission);
apiRouter.post("/analytics/compare", operationsController.compareMissions);
apiRouter.get("/analytics/:missionId/export", operationsController.exportMissionAnalytics);
apiRouter.get("/analytics/:missionId", operationsController.getMissionAnalytics);
apiRouter.get("/provenance/explorer", getProvenanceExplorer);
apiRouter.get("/provenance/:eventId", operationsController.getProvenance);
apiRouter.get("/decision-lineage/:eventId", operationsController.getDecisionLineage);

// Recovery Batch 7: Isolated Judging Demo
apiRouter.get("/demo/judging/catalog", operationsController.getJudgingDemoCatalog);
apiRouter.get("/demo/judging/runs", operationsController.listJudgingDemoRuns);
apiRouter.post("/demo/judging/run", operationsController.runJudgingDemo);
apiRouter.post("/demo/judging/step", operationsController.stepJudgingDemo);
apiRouter.post("/demo/judging/reset", operationsController.resetJudgingDemo);

// Batch 9: Dynamic Scenario Builder CRUD & Isolated Execution
apiRouter.get("/scenarios", operationsController.listScenarios);
apiRouter.get("/scenarios/:id", operationsController.getScenario);
apiRouter.post("/scenarios", operationsController.createScenario);
apiRouter.patch("/scenarios/:id", operationsController.updateScenario);
apiRouter.post("/scenarios/:id/duplicate", operationsController.duplicateScenario);
apiRouter.post("/scenarios/:id/delete", operationsController.deleteScenario);
apiRouter.delete("/scenarios/:id", operationsController.deleteScenario);
apiRouter.post("/scenarios/:id/execute", operationsController.executeScenario);

// Batch 9: Structured Explainable Copilot & Multi-Objective Plan Comparison
apiRouter.post("/copilot/query", operationsController.structuredCopilotQuery);
apiRouter.post("/copilot/confirm-action", operationsController.confirmCopilotAction);
apiRouter.post("/missions/compare-plans", operationsController.comparePlanningAlternatives);



