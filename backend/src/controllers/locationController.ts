import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { APIResponse, LocationData } from "../types/index.js";
import { validateMarsCoordinate } from "../utils/marsCoordinates.js";

export async function getLocationById(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const location = await marsDataService.getLocationById(id);

  if (!location) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "LOCATION_NOT_FOUND",
        message: `No planetary location found matching identifier: ${id}`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse<LocationData> = {
    success: true,
    data: location,
    metadata: {
      source: "NASA Mars Exploration Unified Catalog",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export async function getLocations(req: Request, res: Response): Promise<void> {
  const latStr = req.query.lat as string | undefined;
  const lonStr = req.query.lon as string | undefined;

  if (latStr !== undefined && lonStr !== undefined) {
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    const validation = validateMarsCoordinate({ latitude: lat, longitude: lon });
    if (!validation.valid) {
      const response: APIResponse<never> = {
        success: false,
        error: {
          code: "INVALID_COORDINATE",
          message: validation.error || "Invalid coordinate query parameters.",
        },
      };
      res.status(400).json(response);
      return;
    }

    // Single coordinate inspection mode
    const location = await marsDataService.getLocationData({ latitude: lat, longitude: lon });
    const response: APIResponse<LocationData> = {
      success: true,
      data: location,
      metadata: {
        source: location.isMockData ? "MOLA-Interpolated Heuristic" : "NASA Ground Truth",
        timestamp: new Date().toISOString(),
      },
    };
    res.json(response);
    return;
  }

  // List all benchmark locations
  const locations = await marsDataService.getLocations();
  const response: APIResponse<LocationData[]> = {
    success: true,
    data: locations,
    metadata: {
      source: "NASA Ground Truth Planetary Landing Sites",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}
