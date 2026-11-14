import { Request, Response } from "express";
import { missionRepository } from "../repositories/missionRepository.js";
import { missionEngine } from "../services/mission/missionEngine.js";
import { APIResponse, MarsRoute, RoutePoint } from "../types/index.js";
import { validateMarsCoordinate } from "../utils/marsCoordinates.js";

export async function createRoute(req: Request, res: Response): Promise<void> {
  const { name, points } = req.body as { name?: string; points: RoutePoint[] };

  if (!Array.isArray(points) || points.length < 2) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "INVALID_ROUTE_PAYLOAD",
        message: "Route creation requires an array of at least 2 points (start and destination).",
      },
    };
    res.status(400).json(response);
    return;
  }

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const validation = validateMarsCoordinate(pt.coordinate);
    if (!validation.valid) {
      const response: APIResponse<never> = {
        success: false,
        error: {
          code: "INVALID_COORDINATE",
          message: `Point at index ${i} has invalid coordinates: ${validation.error}`,
        },
      };
      res.status(400).json(response);
      return;
    }
  }

  try {
    const generatedRoute = await missionEngine.generateRoute(
      name || `Marswalk Traverse ${new Date().toLocaleTimeString()}`,
      points
    );
    await missionRepository.saveRoute(generatedRoute);

    const response: APIResponse<MarsRoute> = {
      success: true,
      data: generatedRoute,
      metadata: {
        source: "EVA Mission Engine / MOLA Topographic Profiler",
        timestamp: new Date().toISOString(),
      },
    };
    res.status(201).json(response);
  } catch (err: unknown) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "ROUTE_GENERATION_FAILED",
        message: err instanceof Error ? err.message : "Internal route generation error.",
      },
    };
    res.status(500).json(response);
  }
}

export async function getRouteById(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const route = await missionRepository.getRouteById(id);

  if (!route) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Mars route '${id}' does not exist.`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse<MarsRoute> = {
    success: true,
    data: route,
  };
  res.json(response);
}

export async function getAllRoutes(_req: Request, res: Response): Promise<void> {
  const routes = await missionRepository.getAllRoutes();
  const response: APIResponse<MarsRoute[]> = {
    success: true,
    data: routes,
  };
  res.json(response);
}
