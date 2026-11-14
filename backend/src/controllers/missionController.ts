import { Request, Response } from "express";
import { missionRepository } from "../repositories/missionRepository.js";
import { missionEngine } from "../services/mission/missionEngine.js";
import { APIResponse, EVAAssessment, MissionParameters } from "../types/index.js";

export async function createMission(req: Request, res: Response): Promise<void> {
  const params = req.body as MissionParameters;

  if (!params.routeId) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "MISSING_ROUTE_ID",
        message: "A valid routeId is required to instantiate and assess an EVA mission.",
      },
    };
    res.status(400).json(response);
    return;
  }

  const route = await missionRepository.getRouteById(params.routeId);
  if (!route) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Referenced route '${params.routeId}' was not found.`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const evaAssessment: EVAAssessment = missionEngine.assessEVAFeasibility(route, params);
  const missionId = `mission-${Date.now()}`;
  const storedMission = await missionRepository.saveMission(missionId, route.id, params, evaAssessment);

  const response: APIResponse<typeof storedMission> = {
    success: true,
    data: storedMission,
    metadata: {
      source: "NASA Flight Operations EVA Calculator",
      timestamp: new Date().toISOString(),
    },
  };
  res.status(201).json(response);
}

export async function getMissionById(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const mission = await missionRepository.getMissionById(id);

  if (!mission) {
    const response: APIResponse<never> = {
      success: false,
      error: {
        code: "MISSION_NOT_FOUND",
        message: `Mission execution plan '${id}' not found.`,
      },
    };
    res.status(404).json(response);
    return;
  }

  const response: APIResponse<typeof mission> = {
    success: true,
    data: mission,
  };
  res.json(response);
}
