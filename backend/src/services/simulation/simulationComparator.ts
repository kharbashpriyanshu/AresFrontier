export interface MissionComparison {
  baselineMissionId: string;
  alternativeMissionId: string;

  durationDeltaMin: number;
  distanceDeltaKm: number;
  batteryDeltaPercent: number;
  scienceDelta: number;
  communicationReliabilityDelta: number;
  safetyDelta: number;

  hazardsAvoided: number;
  hazardsEncountered: number;

  telemetryDeliveredKb: number;
  telemetryBufferedKb: number;

  missionOutcome: "SUCCESS" | "DEGRADED" | "ABORTED" | "FAILED";
  decisionDifference: string;
  rationale: string;
}

export interface MissionRunMetrics {
  missionId: string;
  label: string;
  distanceKm: number;
  durationMin: number;
  batteryPercent: number;
  scienceScore: number;
  safetyScore: number;
  commReliabilityPercent: number;
  hazardsDetected: number;
  hazardsEncountered: number;
  outcome: "SUCCESS" | "DEGRADED" | "ABORTED" | "FAILED";
}

export class SimulationComparator {
  /**
   * Evaluates and compares a baseline mission execution against a what-if alternative.
   */
  public static compareMissions(
    baseline: MissionRunMetrics,
    alternative: MissionRunMetrics,
    decisionDiff: string
  ): MissionComparison {
    return {
      baselineMissionId: baseline.missionId,
      alternativeMissionId: alternative.missionId,
      durationDeltaMin: Number((alternative.durationMin - baseline.durationMin).toFixed(1)),
      distanceDeltaKm: Number((alternative.distanceKm - baseline.distanceKm).toFixed(2)),
      batteryDeltaPercent: Number((alternative.batteryPercent - baseline.batteryPercent).toFixed(1)),
      scienceDelta: alternative.scienceScore - baseline.scienceScore,
      communicationReliabilityDelta: Number((alternative.commReliabilityPercent - baseline.commReliabilityPercent).toFixed(1)),
      safetyDelta: alternative.safetyScore - baseline.safetyScore,
      hazardsAvoided: Math.max(0, baseline.hazardsDetected - baseline.hazardsEncountered),
      hazardsEncountered: alternative.hazardsEncountered,
      telemetryDeliveredKb: alternative.outcome === "SUCCESS" ? 1420 : 850,
      telemetryBufferedKb: alternative.outcome === "SUCCESS" ? 64 : 450,
      missionOutcome: alternative.outcome,
      decisionDifference: decisionDiff,
      rationale:
        alternative.outcome === "DEGRADED"
          ? "Alternative choice bypassed safe-corridor constraints resulting in wheel slip, steep slope exposure, and battery penalty."
          : "Alternative route provided successful completion with altered distance/time trade-off.",
    };
  }
}
