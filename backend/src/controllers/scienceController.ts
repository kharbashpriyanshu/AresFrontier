import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { scienceEngineAdapter } from "../services/science/scienceEngineAdapter.js";
import { scienceDecisionService } from "../services/science/scienceDecisionService.js";
import { APIResponse, ScienceObjectiveId, ScienceTarget, ScientificAssessment } from "../types/index.js";
import { validateMarsCoordinate } from "../utils/marsCoordinates.js";

export async function getScienceTargets(req: Request, res: Response): Promise<void> {
  const { north, south, east, west } = req.query;

  let targets: ScienceTarget[];
  if (north && south && east && west) {
    targets = await marsDataService.getScienceTargets({
      north: parseFloat(north as string),
      south: parseFloat(south as string),
      east: parseFloat(east as string),
      west: parseFloat(west as string),
    });
  } else {
    targets = await marsDataService.getScienceTargets();
  }

  const response: APIResponse<ScienceTarget[]> = {
    success: true,
    data: targets,
    metadata: {
      source: "NASA Planetary Science Archive / Mars 2020 & MSL Ground Targets",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export async function getScienceTargetById(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const target = await marsDataService.getScienceTargetById(id);

  if (!target) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "TARGET_NOT_FOUND",
        message: `Science target '${id}' was not found in catalog.`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse<ScienceTarget> = {
    success: true,
    data: target,
    metadata: {
      source: target.dataSource,
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export async function getScientificAssessment(req: Request, res: Response): Promise<void> {
  const latStr = req.query.lat as string | undefined;
  const lonStr = req.query.lon as string | undefined;

  if (latStr === undefined || lonStr === undefined) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "MISSING_COORDINATES",
        message: "Query parameters 'lat' and 'lon' are required.",
      },
    };
    res.status(400).json(response);
    return;
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  const validation = validateMarsCoordinate({ latitude: lat, longitude: lon });
  if (!validation.valid) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "INVALID_COORDINATE",
        message: validation.error || "Coordinate out of Martian planetary boundaries.",
      },
    };
    res.status(400).json(response);
    return;
  }

  const assessment: ScientificAssessment = await scienceEngineAdapter.getScientificAssessment({
    latitude: lat,
    longitude: lon,
  });

  const response: APIResponse<ScientificAssessment> = {
    success: true,
    data: assessment,
    metadata: {
      source: "Planetary Science Engine (Person 4 Domain Rules Adapter)",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export async function evaluateTarget(req: Request, res: Response): Promise<void> {
  const { targetId, name, latitude, longitude, targetType, description, primaryObjective } = req.body || {};

  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: "Numeric 'latitude' and 'longitude' are required." },
    });
    return;
  }

  const validation = validateMarsCoordinate({ latitude, longitude });
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: validation.error || "Coordinate out of Martian planetary boundaries." },
    });
    return;
  }

  const result = await scienceEngineAdapter.evaluateTarget({
    targetId: String(targetId || "custom-target"),
    name: String(name || "Unnamed Target"),
    coordinate: { latitude, longitude },
    targetType: String(targetType || "stratigraphy"),
    description: typeof description === "string" ? description : undefined,
    primaryObjective: typeof primaryObjective === "string" ? primaryObjective : undefined,
  });

  res.json({
    success: true,
    data: result,
    metadata: {
      source: result.methodology,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function evaluateObjectives(req: Request, res: Response): Promise<void> {
  const { objectiveId, targetTypes, waypointsCount, routeLengthKm } = req.body || {};
  const result = await scienceEngineAdapter.evaluateObjectives({
    objectiveId: String(objectiveId || "ANCIENT_WATER_ACTIVITY"),
    targetTypes: Array.isArray(targetTypes) ? targetTypes.map(String) : [],
    waypointsCount: typeof waypointsCount === "number" ? waypointsCount : 1,
    routeLengthKm: typeof routeLengthKm === "number" ? routeLengthKm : 2.5,
  });

  res.json({
    success: true,
    data: result,
    metadata: {
      source: result.methodology,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function classifyMineralogy(req: Request, res: Response): Promise<void> {
  const { latitude, longitude, geologicalContext, observedFeatures } = req.body || {};

  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: "Numeric 'latitude' and 'longitude' are required." },
    });
    return;
  }

  const validation = validateMarsCoordinate({ latitude, longitude });
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: validation.error || "Coordinate out of Martian planetary boundaries." },
    });
    return;
  }

  const result = await scienceEngineAdapter.classifyMineralogy({
    coordinate: { latitude, longitude },
    geologicalContext: typeof geologicalContext === "string" ? geologicalContext : undefined,
    observedFeatures: Array.isArray(observedFeatures) ? observedFeatures.map(String) : undefined,
  });

  res.json({
    success: true,
    data: result,
    metadata: {
      source: result.methodology,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function assessIce(req: Request, res: Response): Promise<void> {
  const { latitude, longitude } = req.body || {};

  if (typeof latitude !== "number" || typeof longitude !== "number" || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: "Numeric 'latitude' and 'longitude' are required." },
    });
    return;
  }

  const validation = validateMarsCoordinate({ latitude, longitude });
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_COORDINATE", message: validation.error || "Coordinate out of Martian planetary boundaries." },
    });
    return;
  }

  const result = await scienceEngineAdapter.assessIceStability({ latitude, longitude });
  res.json({
    success: true,
    data: result,
    metadata: {
      source: result.methodology,
      timestamp: new Date().toISOString(),
    },
  });
}

export function assignTargetToMission(req: Request, res: Response): void {
  const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { missionId, rationale, actor, objectiveId } = req.body || {};

  if (!missionId || typeof missionId !== "string") {
    res.status(400).json({
      success: false,
      error: { code: "MISSING_MISSION_ID", message: "Field 'missionId' is required." },
    });
    return;
  }

  const outcome = scienceDecisionService.assignTargetToMission({
    targetId,
    missionId,
    rationale: typeof rationale === "string" ? rationale : undefined,
    actor: typeof actor === "string" ? actor : undefined,
    objectiveId: typeof objectiveId === "string" ? (objectiveId as ScienceObjectiveId) : undefined,
  });

  if (!outcome.ok) {
    res.status(outcome.status).json({
      success: false,
      error: { code: outcome.code, message: outcome.message },
    });
    return;
  }

  res.status(201).json({
    success: true,
    data: outcome.decision,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

export function getScienceDecisions(req: Request, res: Response): void {
  const missionId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
  const decisions = scienceDecisionService.getDecisions(missionId);
  res.json({
    success: true,
    data: decisions,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}
