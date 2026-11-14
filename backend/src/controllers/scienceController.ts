import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { scienceEngineAdapter } from "../services/science/scienceEngineAdapter.js";
import { APIResponse, ScienceTarget, ScientificAssessment } from "../types/index.js";
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
