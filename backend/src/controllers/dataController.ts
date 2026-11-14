import { Request, Response } from "express";
import { marsDataService } from "../services/nasa/marsDataService.js";
import { nasaDatasetIngestionService } from "../services/nasa/nasaDatasetIngestionService.js";
import { scienceDecisionService } from "../services/science/scienceDecisionService.js";
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
