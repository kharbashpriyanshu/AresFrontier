import { ReplayState } from "./replayTypes.js";

export interface ReplayStateDiff {
  timestampA: string;
  timestampB: string;
  simTimeDeltaSeconds: number;
  batteryDeltaByAgent: Record<string, number>;
  statusChanges: { agentId: string; from: string; to: string }[];
  newHazardsCount: number;
  scienceScoreDelta: number;
}

export class ReplayComparator {
  /**
   * Compares two reconstructed replay states and returns structured delta metrics.
   */
  public static compareStates(stateA: ReplayState, stateB: ReplayState): ReplayStateDiff {
    const batteryDelta: Record<string, number> = {};
    const statusChanges: { agentId: string; from: string; to: string }[] = [];

    for (const agentA of stateA.agents) {
      const agentB = stateB.agents.find((a) => a.id === agentA.id);
      if (agentB) {
        batteryDelta[agentA.id] = (agentB.telemetry?.batteryPercent || 0) - (agentA.telemetry?.batteryPercent || 0);
        if (agentA.status !== agentB.status) {
          statusChanges.push({
            agentId: agentA.id,
            from: agentA.status,
            to: agentB.status,
          });
        }
      }
    }

    return {
      timestampA: stateA.lastUpdated,
      timestampB: stateB.lastUpdated,
      simTimeDeltaSeconds: stateB.currentSimTimeSeconds - stateA.currentSimTimeSeconds,
      batteryDeltaByAgent: batteryDelta,
      statusChanges,
      newHazardsCount: Math.max(0, stateB.activeHazards.length - stateA.activeHazards.length),
      scienceScoreDelta: stateB.metrics.scienceYieldScore - stateA.metrics.scienceYieldScore,
    };
  }
}
