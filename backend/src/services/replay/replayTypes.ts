import { PlanetaryAgent } from "../agents/agentTypes.js";
import { MissionEventRecord, FusedHazardReport, MarsCoordinate } from "../../types/index.js";

export type ReplayStatus = "IDLE" | "PLAYING" | "PAUSED" | "COMPLETED";

export interface ReplayMetrics {
  batteryDepletedPercent: number;
  scienceYieldScore: number;
  hazardsEncountered: number;
  hazardsAvoided: number;
  safetyScore: number;
  packetsDeliveredCount: number;
  packetsBufferedCount: number;
}

export interface ReplayState {
  missionId: string;
  status: ReplayStatus;
  currentEventIndex: number;
  currentSimTimeSeconds: number;
  totalEvents: number;
  currentEvent?: MissionEventRecord;
  agents: PlanetaryAgent[];
  activeHazards: FusedHazardReport[];
  activeRouteWaypoints: MarsCoordinate[];
  metrics: ReplayMetrics;
  lastUpdated: string;
}

export interface ReplayEventFilter {
  agentId?: string;
  eventType?: string;
  severity?: "INFO" | "WARNING" | "CRITICAL";
  minSimTime?: number;
  maxSimTime?: number;
}

export interface ReplaySummary {
  missionId: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  totalEvents: number;
  participatingAgents: string[];
  finalOutcome: "SUCCESS" | "DEGRADED" | "ABORTED" | "FAILED";
}
