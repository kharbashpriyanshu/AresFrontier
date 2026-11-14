import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
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
