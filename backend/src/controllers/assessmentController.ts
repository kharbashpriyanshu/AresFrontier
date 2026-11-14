import { Request, Response } from "express";
import { missionRepository } from "../repositories/missionRepository.js";
import { mlEngineAdapter } from "../services/ml/mlEngineAdapter.js";
import { APIResponse, MissionAssessment } from "../types/index.js";

export async function assessMission(req: Request, res: Response): Promise<void> {
  const { routeId, missionParameters } = req.body as {
    routeId: string;
    missionParameters?: { maxDurationMinutes?: number; astronautSkillLevel?: "standard" | "expert" };
  };

  if (!routeId) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "MISSING_ROUTE_ID",
        message: "Request must include 'routeId'.",
      },
    };
    res.status(400).json(response);
    return;
  }

  const route = await missionRepository.getRouteById(routeId);
  if (!route) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route '${routeId}' not found for assessment.`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const maxDuration = missionParameters?.maxDurationMinutes ?? 240;
  const assessment: MissionAssessment = await mlEngineAdapter.assessMission(route, {
    maxDurationMinutes: maxDuration,
    astronautSkillLevel: missionParameters?.astronautSkillLevel ?? "standard",
  });

  const response: APIResponse<MissionAssessment> = {
    success: true,
    data: assessment,
    metadata: {
      source: "AI/ML Mission Safety & Yield Assessment (Person 3 Adapter)",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}
