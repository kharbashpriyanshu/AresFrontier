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
} from "../controllers/scienceController.js";
import {
  createRoute,
  getRouteById,
  getAllRoutes,
} from "../controllers/routeController.js";
import {
  createMission,
  getMissionById,
} from "../controllers/missionController.js";
import { assessMission } from "../controllers/assessmentController.js";
import {
  getDataSources,
  getDataStatus,
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
apiRouter.get("/science/assessment", getScientificAssessment);

// 4. Routes
apiRouter.get("/routes", getAllRoutes);
apiRouter.post("/routes", createRoute);
apiRouter.get("/routes/:id", getRouteById);

// 5. Missions & EVA
apiRouter.post("/missions", createMission);
apiRouter.get("/missions/:id", getMissionById);
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

// 9. NASA Data Pipelines & System Health
apiRouter.get("/data/sources", getDataSources);
apiRouter.get("/data/status", getDataStatus);

// 10. Multi-Agent Planetary Field Operations (Phase 4)
import { operationsController } from "../controllers/operationsController.js";

apiRouter.get("/operations/agents", operationsController.getAgents);
apiRouter.get("/operations/agents/:id", operationsController.getAgentById);
apiRouter.post("/operations/agents/:id/tasks", operationsController.assignTask);
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
apiRouter.post("/replay/:missionId/step", operationsController.stepReplay);
apiRouter.post("/replay/:missionId/seek", operationsController.seekReplay);
apiRouter.post("/replay/:missionId/reset", operationsController.resetReplay);

// Phase 6 What-If Simulation, Monte Carlo & Failure Injection
apiRouter.post("/simulation/clone", operationsController.cloneMission);
apiRouter.post("/simulation/what-if", operationsController.runWhatIf);
apiRouter.post("/simulation/monte-carlo", operationsController.runMonteCarlo);
apiRouter.post("/simulation/failure-injection", operationsController.injectFailure);

// Phase 6 Validation, Analytics, Provenance & Decision Lineage
apiRouter.get("/validation/:missionId", operationsController.validateMission);
apiRouter.get("/analytics/:missionId", operationsController.getMissionAnalytics);
apiRouter.get("/provenance/:eventId", operationsController.getProvenance);
apiRouter.get("/decision-lineage/:eventId", operationsController.getDecisionLineage);



