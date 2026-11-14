import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { nasaDatasetIngestionService } from "../services/nasa/nasaDatasetIngestionService.js";
import { scienceDecisionService } from "../services/science/scienceDecisionService.js";
import { planetaryDataService } from "../services/planetary/planetaryDataService.js";
import { atmosphereService } from "../services/planetary/atmosphereService.js";
import { radiationService } from "../services/planetary/radiationService.js";
import { spatiotemporalAlignmentService } from "../services/planetary/spatiotemporalAlignmentService.js";
import { dataUncertaintyService } from "../services/planetary/dataUncertaintyService.js";
import { unifiedScienceLayerService } from "../services/planetary/unifiedScienceLayerService.js";
import { microTerrainService } from "../services/terrain/microTerrainService.js";
import { astronautMobilityEngine } from "../services/astronaut/astronautMobilityEngine.js";
import { mlEngineAdapter } from "../services/ml/mlEngineAdapter.js";
import { multiOrbiterVisibilityEngine } from "../services/comms/multiOrbiterVisibilityEngine.js";
import { roboticSupportPlanner } from "../services/agents/roboticSupportPlanner.js";
import { buddyProtocolService } from "../services/astronaut/buddyProtocolService.js";
import { mepagTargetPrioritizer } from "../services/science/mepagTargetPrioritizer.js";
import { comprehensiveParetoPlanner } from "../services/intelligence/comprehensiveParetoPlanner.js";
import { observationPlanningService } from "../services/science/observationPlanningService.js";
import { hazardAvoidanceRouter } from "../services/intelligence/hazardAvoidanceRouter.js";
import { commWindowScheduler } from "../services/comms/commWindowScheduler.js";
import { dustStormSimulationService } from "../services/planetary/dustStormSimulationService.js";
import { APIResponse, DataSourceInfo, SystemPipelineStatus } from "../types/index.js";

export function getDataSources(_req: Request, res: Response): void {
  const sources = marsDataService.getAllDataSources();
  const response: APIResponse<DataSourceInfo[]> = {
    success: true,
    data: sources,
    metadata: {
      source: "NASA Space Science Data Coordinated Archive",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export function getDataStatus(_req: Request, res: Response): void {
  const status = marsDataService.getDataSourceInfo();
  const pipelines = marsDataService.getSystemPipelineStatus();
  const response: APIResponse<DataSourceInfo & { pipelines: SystemPipelineStatus }> = {
    success: true,
    data: {
      ...status,
      pipelines,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export function getProvenanceExplorer(req: Request, res: Response): void {
  const q = (key: string) => (typeof req.query[key] === "string" ? (req.query[key] as string) : undefined);
  const explorer = scienceDecisionService.getProvenanceExplorer({
    source: q("source"),
    classification: q("classification"),
    mission: q("mission"),
    product: q("product"),
    stage: q("stage"),
    validationStatus: q("validationStatus"),
    search: q("search"),
  });

  res.json({
    success: true,
    data: explorer,
    metadata: {
      source: "Martian Map Provenance & Audit Registry",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getIngestedDatasets(_req: Request, res: Response): void {
  const datasets = nasaDatasetIngestionService.getIngestedDatasets();
  res.json({
    success: true,
    data: datasets,
    metadata: {
      source: "Local Persisted NASA Ingestion Store",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function ingestMars2020Traverse(_req: Request, res: Response): Promise<void> {
  const outcome = await nasaDatasetIngestionService.ingestMars2020Traverse();
  if (!outcome.ok) {
    res.status(502).json({
      success: false,
      error: {
        code: "NASA_INGESTION_FAILED",
        message: outcome.message,
      },
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: outcome.dataset,
    metadata: {
      source: outcome.dataset.url,
      timestamp: outcome.dataset.retrievedAt,
    },
  });
}

// ============================================================================
// Authentic Multi-Mission Scientific Endpoints (Items 1 - 7)
// ============================================================================

export function getAuthenticDTM(req: Request, res: Response): void {
  const region = typeof req.query.region === "string" ? req.query.region : undefined;
  const dtm = planetaryDataService.getHighResDTM(region);
  res.json({
    success: true,
    data: dtm,
    metadata: {
      source: dtm.sourceDatasetId,
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticOptical(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const radiusKm = req.query.radius ? Number(req.query.radius) : 50.0;
  const products = planetaryDataService.getOpticalImagery({ latitude: lat, longitude: lon }, radiusKm);
  res.json({
    success: true,
    data: products,
    metadata: {
      count: products.length,
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticSurfacePhotos(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const radiusKm = req.query.radius ? Number(req.query.radius) : 25.0;
  const photos = planetaryDataService.getSurfacePhotos({ latitude: lat, longitude: lon }, radiusKm);
  res.json({
    success: true,
    data: photos,
    metadata: {
      count: photos.length,
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticThermal(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const thermal = planetaryDataService.getThermalContext({ latitude: lat, longitude: lon });
  res.json({
    success: true,
    data: thermal,
    metadata: {
      source: "2001 Mars Odyssey THEMIS Global Mosaic & Thermal Inertia",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticMineralogy(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const minerals = planetaryDataService.getMineralogy({ latitude: lat, longitude: lon });
  res.json({
    success: true,
    data: minerals,
    metadata: {
      source: "MRO CRISM Targeted Hyperspectral Observations",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticGeology(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const geology = planetaryDataService.getGeology({ latitude: lat, longitude: lon });
  res.json({
    success: true,
    data: geology,
    metadata: {
      source: "USGS Scientific Investigations Maps (SIM 3464 & SIM 3292)",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticSubsurfaceIce(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const ice = planetaryDataService.getSubsurfaceIce({ latitude: lat, longitude: lon });
  res.json({
    success: true,
    data: ice,
    metadata: {
      source: "MRO SHARAD Radar Sounder & PSI SWIM Project",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Authentic Multi-Mission Scientific Endpoints (Items 8 - 13)
// ============================================================================

export function getAuthenticAtmosphere(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const sol = req.query.sol ? Number(req.query.sol) : 100;
  const localTime = req.query.time ? Number(req.query.time) : 13.5;
  const atmo = atmosphereService.getAtmosphericConditions({ latitude: lat, longitude: lon }, sol, localTime);
  res.json({
    success: true,
    data: atmo,
    metadata: {
      source: atmo.sourceMission,
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAuthenticRadiation(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const elev = req.query.elevation ? Number(req.query.elevation) : -2500;
  const activity = (req.query.solarActivity as "quiet" | "moderate" | "storm") || "quiet";
  const rad = radiationService.getRadiationEnvironment({ latitude: lat, longitude: lon }, elev, activity);
  res.json({
    success: true,
    data: rad,
    metadata: {
      source: rad.sourceDataset,
      timestamp: new Date().toISOString(),
    },
  });
}

export function getSpatiotemporalAlignment(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const sol = req.query.sol ? Number(req.query.sol) : 100;
  const align = spatiotemporalAlignmentService.alignMultiMissionObservations({ latitude: lat, longitude: lon }, sol);
  res.json({
    success: true,
    data: align,
    metadata: {
      coordinateSystem: "IAU 2000 Mars Planetocentric / Planetographic Harmonized",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getUncertaintyReport(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const elev = req.query.elevation ? Number(req.query.elevation) : -2500;
  const ti = req.query.ti ? Number(req.query.ti) : 340;
  const press = req.query.pressure ? Number(req.query.pressure) : 760;
  const radRate = req.query.radRate ? Number(req.query.radRate) : 28.5;
  const report = dataUncertaintyService.generateUncertaintyReport(
    { latitude: lat, longitude: lon },
    elev,
    ti,
    press,
    radRate
  );
  res.json({
    success: true,
    data: report,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getUnifiedScienceLayer(req: Request, res: Response): Promise<void> {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const sol = req.query.sol ? Number(req.query.sol) : 100;
  const time = req.query.time ? Number(req.query.time) : 13.5;
  const point = await unifiedScienceLayerService.queryPoint({ latitude: lat, longitude: lon }, sol, time);
  res.json({
    success: true,
    data: point,
    metadata: {
      modalitiesCount: 8,
      source: "Martian Map Unified Multi-Mission Scientific Data Layer",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Authentic ML & Astronaut Mobility Endpoints (Items 14 - 19)
// ============================================================================

export function getMLValidationMetrics(_req: Request, res: Response): void {
  const metrics = mlEngineAdapter.getEmpiricalValidationMetrics();
  res.json({
    success: true,
    data: metrics,
    metadata: {
      source: "Empirical Mars Rover Cross-Validation Benchmarks",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getMicroTerrainObstacles(req: Request, res: Response): Promise<void> {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const slope = req.query.slope ? Number(req.query.slope) : 6.5;
  const profile = await microTerrainService.evaluateMicroTerrain({ latitude: lat, longitude: lon }, slope);
  res.json({
    success: true,
    data: profile,
    metadata: {
      model: "Golombek Rock Size-Frequency & Mars Repose Stability",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getAstronautMobility(req: Request, res: Response): void {
  const slope = req.query.slope ? Number(req.query.slope) : 4.0;
  const duration = req.query.duration ? Number(req.query.duration) : 180;
  const skill = (req.query.skill as "standard" | "expert") || "standard";
  const biomechanics = astronautMobilityEngine.evaluateBiomechanics(slope, skill, duration);
  const consumables = astronautMobilityEngine.calculateConsumables(duration, slope);
  const workload = astronautMobilityEngine.evaluateEVAWorkload(duration * 0.5, duration * 0.5, 3, 360);

  res.json({
    success: true,
    data: {
      biomechanics,
      consumables,
      workload,
    },
    metadata: {
      suit: "NASA xEMU 0.38g Calibrated Mobility",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Comms Constellation, Robotics & Crew Buddy Endpoints (Items 20 - 23)
// ============================================================================

export function getConstellationComms(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const minutes = req.query.timeMinutes ? Number(req.query.timeMinutes) : 45;
  const maskDeg = req.query.mask ? Number(req.query.mask) : 15.0;
  const comms = multiOrbiterVisibilityEngine.evaluateConstellation(
    { latitude: lat, longitude: lon },
    minutes,
    maskDeg
  );
  res.json({
    success: true,
    data: comms,
    metadata: {
      constellation: "MRO, TGO & MAVEN Relay Constellation",
      timestamp: new Date().toISOString(),
    },
  });
}

export function getRoboticSupportPlan(req: Request, res: Response): void {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const status = (req.query.status as "NOMINAL" | "HIGH_SAMPLE_LOAD" | "ASTRONAUT_EXHAUSTION" | "EMERGENCY_RETURN") || "NOMINAL";

  const plans = roboticSupportPlanner.generateSupportPlan(
    { latitude: lat, longitude: lon },
    {
      scoutRover: { latitude: lat + 0.001, longitude: lon + 0.001 },
      muleRover: { latitude: lat - 0.0005, longitude: lon - 0.0005 },
      relayRover: { latitude: lat - 0.004, longitude: lon + 0.004 },
    },
    status
  );

  res.json({
    success: true,
    data: plans,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

export function getBuddyPairState(req: Request, res: Response): void {
  const lat1 = req.query.lat1 ? Number(req.query.lat1) : 18.4447;
  const lon1 = req.query.lon1 ? Number(req.query.lon1) : 77.4508;
  const lat2 = req.query.lat2 ? Number(req.query.lat2) : 18.4452;
  const lon2 = req.query.lon2 ? Number(req.query.lon2) : 77.4512;

  const state = buddyProtocolService.evaluateBuddyState(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );

  res.json({
    success: true,
    data: state,
    metadata: {
      protocol: "NASA Dual-Crew EVA Buddy Safety Invariant",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Multi-Objective Pareto & MEPAG Science Endpoints (Items 24 - 27)
// ============================================================================

export async function getMepagPrioritizedTargets(req: Request, res: Response): Promise<void> {
  const lat = req.query.lat ? Number(req.query.lat) : 18.4447;
  const lon = req.query.lon ? Number(req.query.lon) : 77.4508;
  const focus = (req.query.focus as "GOAL_I_LIFE" | "GOAL_II_CLIMATE" | "GOAL_III_GEOLOGY" | "GOAL_IV_HUMAN") || "GOAL_I_LIFE";

  const targets = await mepagTargetPrioritizer.prioritizeTargets({ latitude: lat, longitude: lon }, focus);
  res.json({
    success: true,
    data: targets,
    metadata: {
      focus,
      source: "NASA MEPAG Goals I-IV Prioritization Framework",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getParetoRoutePlans(req: Request, res: Response): Promise<void> {
  const lat1 = req.query.startLat ? Number(req.query.startLat) : 18.4447;
  const lon1 = req.query.startLon ? Number(req.query.startLon) : 77.4508;
  const lat2 = req.query.destLat ? Number(req.query.destLat) : 18.438;
  const lon2 = req.query.destLon ? Number(req.query.destLon) : 77.418;
  const duration = req.query.maxDuration ? Number(req.query.maxDuration) : 360;

  const tradeoff = await comprehensiveParetoPlanner.evaluatePlans(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
    duration
  );

  res.json({
    success: true,
    data: tradeoff,
    metadata: {
      framework: "Non-Dominated Multi-Objective Pareto Frontier",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Scientific Observation Planning (Item 34)
// ============================================================================

export function getObservationPlan(req: Request, res: Response): void {
  const id = typeof req.query.targetId === "string" ? req.query.targetId : "tgt-delta-clay";
  const name = typeof req.query.targetName === "string" ? req.query.targetName : "Jezero Delta Scarp Mudstone";
  const lat = req.query.lat ? Number(req.query.lat) : 18.438;
  const lon = req.query.lon ? Number(req.query.lon) : 77.418;
  const tubeIdx = req.query.tubeIndex ? Number(req.query.tubeIndex) : 1;

  const plan = observationPlanningService.generateObservationPlan(id, name, { latitude: lat, longitude: lon }, tubeIdx);
  res.json({
    success: true,
    data: plan,
    metadata: {
      protocol: "NASA Planetary Sampling & Hermetic Caching Specification",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Hazard Avoidance Routing (Upgrade U4: A* Cost Map)
// ============================================================================

export function getSafeHazardAvoidanceRoute(req: Request, res: Response): void {
  const startLat = req.query.startLat ? Number(req.query.startLat) : 18.4447;
  const startLon = req.query.startLon ? Number(req.query.startLon) : 77.4508;
  const destLat = req.query.destLat ? Number(req.query.destLat) : 18.4230;
  const destLon = req.query.destLon ? Number(req.query.destLon) : 77.4110;
  const bufferM = req.query.bufferM ? Number(req.query.bufferM) : 150;
  const maxSlope = req.query.maxSlope ? Number(req.query.maxSlope) : 15;

  const result = hazardAvoidanceRouter.planSafeRoute(
    { latitude: startLat, longitude: startLon },
    { latitude: destLat, longitude: destLon },
    { safetyBufferM: bufferM, maxAllowableSlopeDegrees: maxSlope }
  );

  res.json({
    success: true,
    data: result,
    metadata: {
      algorithm: "A* Tangent Corridor Cost-Gradient",
      timestamp: new Date().toISOString(),
    },
  });
}

// ============================================================================
// Communication Window Scheduling & Dust Storm Simulation (Upgrades U6 & U7)
// ============================================================================

export function getCommWindowSchedule(req: Request, res: Response): void {
  const startOffset = req.query.startMinute ? Number(req.query.startMinute) : 0;
  const dwell = req.query.dwellMinutes ? Number(req.query.dwellMinutes) : 25;

  const points = (req.body?.points && Array.isArray(req.body.points) && req.body.points.length > 0)
    ? req.body.points
    : [
        { id: "p1", coordinate: { latitude: 18.4447, longitude: 77.4508 }, type: "start", label: "Octavia E. Butler Base" },
        { id: "p2", coordinate: { latitude: 18.4230, longitude: 77.4110 }, type: "science", label: "Kodiak Delta Outcrop" },
        { id: "p3", coordinate: { latitude: 18.4400, longitude: 77.3950 }, type: "destination", label: "Delta Scarp Camp" },
      ];

  const schedule = commWindowScheduler.scheduleTraverse(points, startOffset, dwell);

  res.json({
    success: true,
    data: schedule,
    metadata: {
      framework: "NASA Multi-Orbiter Relay Visibility (MRO / TGO / MAVEN)",
      timestamp: new Date().toISOString(),
    },
  });
}

export function simulateDustStormImpact(req: Request, res: Response): void {
  const lat = req.body?.latitude ?? 18.4447;
  const lon = req.body?.longitude ?? 77.4508;
  const sol = req.body?.sol ?? 100;
  const tau = req.body?.tau ? Number(req.body.tau) : undefined;
  const stormType = req.body?.stormType || "REGIONAL_STORM";

  const impact = dustStormSimulationService.evaluateDustStormImpact({
    coordinate: { latitude: lat, longitude: lon },
    sol,
    simulatedTau: tau,
    stormType,
  });

  res.json({
    success: true,
    data: impact,
    metadata: {
      calibration: "NASA Perseverance MEDA & Mars Climate Database",
      timestamp: new Date().toISOString(),
    },
  });
}
