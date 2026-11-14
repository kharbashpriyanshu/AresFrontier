import { Request, Response } from "express";
import { missionRepository, MissionPlanStatus } from "../repositories/missionRepository.js";
import { missionEngine } from "../services/mission/missionEngine.js";
import { APIResponse, EVAAssessment, MissionParameters, ScienceObjectiveId } from "../types/index.js";
import { MissionReportService } from "../services/reporting/missionReportService.js";
import { DomainKey } from "../types/unifiedMissionState.js";
import { MissionStateCoordinator } from "../services/state/missionStateCoordinator.js";

interface CreateMissionBody extends MissionParameters {
  name?: string;
  description?: string;
  objectiveId?: ScienceObjectiveId;
  status?: MissionPlanStatus;
}

export async function createMission(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateMissionBody;
  const params: MissionParameters = {
    routeId: body.routeId,
    maxDurationMinutes: Number(body.maxDurationMinutes) || 240,
    startCoordinate: body.startCoordinate || { latitude: 18.4447, longitude: 77.4508 },
    destinationCoordinate: body.destinationCoordinate,
    waypoints: body.waypoints,
    returnRequired: body.returnRequired !== undefined ? Boolean(body.returnRequired) : true,
    evaSuitType: body.evaSuitType,
    astronautSkillLevel: body.astronautSkillLevel,
  };

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

  if (params.maxDurationMinutes <= 0 || Number.isNaN(params.maxDurationMinutes)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DURATION",
        message: "maxDurationMinutes must be a positive number.",
      },
    });
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

  if (!body.startCoordinate && route.points?.[0]?.coordinate) {
    params.startCoordinate = route.points[0].coordinate;
  }

  const evaAssessment: EVAAssessment = missionEngine.assessEVAFeasibility(route, params);
  const missionId = `mission-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const storedMission = await missionRepository.saveMission(missionId, route.id, params, evaAssessment, {
    name: body.name || `${route.name} Plan`,
    description: body.description,
    objectiveId: body.objectiveId,
    status: body.status || "DRAFT",
  });
  MissionStateCoordinator.invalidateMissionState(missionId);

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

export async function updateMission(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const existing = await missionRepository.getMissionById(id);

  if (!existing) {
    res.status(404).json({
      success: false,
      error: {
        code: "MISSION_NOT_FOUND",
        message: `Mission execution plan '${id}' not found.`,
      },
    });
    return;
  }

  const body = req.body as Partial<{
    name: string;
    description: string;
    objectiveId: ScienceObjectiveId;
    status: MissionPlanStatus;
    routeId: string;
    parameters: Partial<MissionParameters>;
    maxDurationMinutes: number;
    returnRequired: boolean;
  }>;

  if (body.name !== undefined && body.name.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_MISSION_NAME",
        message: "Mission name cannot be empty.",
      },
    });
    return;
  }

  const targetRouteId = body.routeId || body.parameters?.routeId || existing.routeId;
  const route = await missionRepository.getRouteById(targetRouteId);
  if (!route) {
    res.status(404).json({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Referenced route '${targetRouteId}' was not found.`,
      },
    });
    return;
  }

  const mergedParams: MissionParameters = {
    ...existing.parameters,
    ...(body.parameters || {}),
    routeId: targetRouteId,
    maxDurationMinutes:
      body.maxDurationMinutes !== undefined
        ? Number(body.maxDurationMinutes)
        : body.parameters?.maxDurationMinutes !== undefined
        ? Number(body.parameters.maxDurationMinutes)
        : existing.parameters.maxDurationMinutes,
    returnRequired:
      body.returnRequired !== undefined
        ? Boolean(body.returnRequired)
        : body.parameters?.returnRequired !== undefined
        ? Boolean(body.parameters.returnRequired)
        : existing.parameters.returnRequired,
  };

  if (mergedParams.maxDurationMinutes <= 0 || Number.isNaN(mergedParams.maxDurationMinutes)) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_DURATION",
        message: "maxDurationMinutes must be a positive number.",
      },
    });
    return;
  }

  const evaAssessment: EVAAssessment = missionEngine.assessEVAFeasibility(route, mergedParams);

  const updated = await missionRepository.updateMission(id, {
    name: body.name,
    description: body.description,
    objectiveId: body.objectiveId,
    status: body.status,
    routeId: targetRouteId,
    parameters: mergedParams,
    evaAssessment,
  });

  MissionStateCoordinator.invalidateMissionState(id);

  res.json({
    success: true,
    data: updated,
    metadata: {
      source: "NASA Flight Operations EVA Calculator",
      timestamp: new Date().toISOString(),
    },
  });
}

export async function deleteMission(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = await missionRepository.deleteMission(id);

  if (!deleted) {
    res.status(404).json({
      success: false,
      error: {
        code: "MISSION_NOT_FOUND",
        message: `Mission execution plan '${id}' not found.`,
      },
    });
    return;
  }

  MissionStateCoordinator.invalidateMissionState(id);
  res.json({ success: true, data: { deleted: true, id } });
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

export async function getAllMissions(_req: Request, res: Response): Promise<void> {
  const missions = await missionRepository.getAllMissions();
  const response: APIResponse<typeof missions> = {
    success: true,
    data: missions,
  };
  res.json(response);
}

export async function getUnifiedMissionState(req: Request, res: Response): Promise<void> {
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const queryId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
  const missionId = paramId || queryId || "MARSWALK-001";
  const state = MissionStateCoordinator.getCanonicalState(missionId);

  const response: APIResponse<typeof state> = {
    success: true,
    data: state,
    metadata: {
      source: "Canonical Unified Mission State Architecture",
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
}

export async function updateUnifiedMissionDomain(req: Request, res: Response): Promise<void> {
  const domain = req.params.domain as DomainKey;
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const queryId = typeof req.query.missionId === "string" ? req.query.missionId : undefined;
  const missionId = paramId || queryId;
  const actorId = req.user?.userId || "MISSION_COMMAND";

  if (!domain) {
    res.status(400).json({
      success: false,
      error: { code: "MISSING_DOMAIN", message: "Target state domain parameter is required." },
    });
    return;
  }

  try {
    const updatedState = MissionStateCoordinator.updateDomain(domain, req.body, actorId, missionId);
    res.json({
      success: true,
      data: updatedState,
      metadata: {
        domainUpdated: domain,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    res.status(400).json({
      success: false,
      error: {
        code: "DOMAIN_UPDATE_FAILED",
        message: err instanceof Error ? err.message : "Failed to update mission domain.",
      },
    });
  }
}

export async function getMissionReport(req: Request, res: Response): Promise<void> {
  const rawId = req.params.id;
  const missionId = typeof rawId === "string" ? rawId : "MARSWALK-001";
  const format = String(req.query.format || "json").toLowerCase();

  try {
    if (format === "csv") {
      const csv = MissionReportService.generateCsvReport(missionId);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${missionId}-report.csv"`);
      res.send(csv);
      return;
    }

    if (format === "markdown" || format === "md") {
      const md = MissionReportService.generateMarkdownReport(missionId);
      res.setHeader("Content-Type", "text/markdown");
      res.send(md);
      return;
    }

    const report = MissionReportService.generateReport(missionId);
    res.json({
      success: true,
      data: report,
      metadata: {
        timestamp: new Date().toISOString(),
        format: "json",
      },
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: {
        code: "REPORT_GENERATION_FAILED",
        message: err instanceof Error ? err.message : "Failed to generate mission report.",
      },
    });
  }
}

