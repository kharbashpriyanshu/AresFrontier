import { MissionEventRecord } from "../../types/index.js";
import { ReplayState, ReplaySummary } from "./replayTypes.js";

export class ReplaySerializer {
  public static exportReplayTrace(state: ReplayState, events: MissionEventRecord[]): string {
    return JSON.stringify(
      {
        version: "6.0.0",
        exportedAt: new Date().toISOString(),
        missionId: state.missionId,
        currentState: state,
        eventCount: events.length,
        events,
      },
      null,
      2
    );
  }

  public static parseReplayTrace(rawJson: string): {
    state: ReplayState;
    events: MissionEventRecord[];
  } {
    const data = JSON.parse(rawJson);
    if (!data.events || !Array.isArray(data.events)) {
      throw new Error("Invalid replay trace format: missing events array");
    }
    return {
      state: data.currentState,
      events: data.events,
    };
  }

  public static createSummary(state: ReplayState, events: MissionEventRecord[]): ReplaySummary {
    const startTime = events.length > 0 ? events[0].timestamp : new Date().toISOString();
    const endTime = events.length > 0 ? events[events.length - 1].timestamp : new Date().toISOString();
    const duration = events.length > 0 && events[events.length - 1].simulationTime !== undefined
      ? (events[events.length - 1].simulationTime || 0)
      : 3600;

    const participatingAgents = Array.from(new Set(events.map((e) => e.actor || e.agentId || "UNKNOWN")));

    return {
      missionId: state.missionId,
      startTime,
      endTime,
      durationSeconds: duration,
      totalEvents: events.length,
      participatingAgents,
      finalOutcome: state.metrics.safetyScore < 40 ? "DEGRADED" : "SUCCESS",
    };
  }
}
