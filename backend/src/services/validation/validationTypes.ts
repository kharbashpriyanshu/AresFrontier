export type InvariantId = "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8";

export interface InvariantValidationReport {
  id: InvariantId;
  name: string;
  status: "PASS" | "FAIL";
  evaluatedMetric: string;
  threshold: string;
  violationReason?: string;
  scientificReference: string;
}

export interface MissionHealthBreakdown {
  safetyScore: number;                 // 0-100 (Max slope, scarp proximity)
  batteryMarginScore: number;          // 0-100 (Distance to 20% floor)
  communicationReliabilityScore: number;// 0-100 (LOS % and packet queue)
  sensorConfidenceScore: number;       // 0-100 (Variance & corroboration)
  routeFeasibilityScore: number;       // 0-100 (Difficulty vs rover specs)
  scienceReturnScore: number;          // 0-100 (Targets visited vs planned)
  missionProgressScore: number;        // 0-100 (Distance completed)
  overallScore: number;                // Weighted composite (0-100)
  verdict: "OPTIMAL" | "NOMINAL" | "ATTENTION_REQUIRED" | "CRITICAL_ACTION_REQUIRED";
}

export interface MissionValidationResult {
  missionId: string;
  validationTimestamp: string;
  overallStatus: "VALID" | "INVALID";
  invariants: InvariantValidationReport[];
  failedInvariantsCount: number;
  health: MissionHealthBreakdown;
  recommendations: string[];
}
