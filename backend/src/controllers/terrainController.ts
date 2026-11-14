import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { APIResponse, TerrainData } from "../types/index.js";
import { validateMarsCoordinate } from "../utils/marsCoordinates.js";

export async function getTerrain(req: Request, res: Response): Promise<void> {
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

  try {
    const terrain = await marsDataService.getTerrainData({ latitude: lat, longitude: lon });
    const response: APIResponse<TerrainData> = {
      success: true,
      data: terrain,
      metadata: {
        source: "NASA MGS MOLA Topographic MEGDR",
        timestamp: new Date().toISOString(),
      },
    };
    res.json(response);
  } catch {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "NASA_DATA_UNAVAILABLE",
        message: "Failed to evaluate Martian terrain elevation data at the requested coordinates.",
      },
    };
    res.status(503).json(response);
  }
}
