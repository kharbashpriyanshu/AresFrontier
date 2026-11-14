import { MarsRoute, MissionAssessment } from "../../types/index.js";

export interface TerrainHazardPrediction {
  hazard_class: "LOW" | "MODERATE" | "CRITICAL";
  hazard_score: number;
  slip_risk_probability: number;
  confidence: number;
  factors: Record<string, number>;
  source: string;
}

export interface RouteRiskPrediction {
  risk_score: number;
  feasibility_status: "MISSION FEASIBLE" | "MISSION RESTRICTED" | "MISSION CONSTRAINT EXCEEDED";
  feasibility_confidence: number;
  risk_factors: Record<string, number>;
  source: string;
}

export interface TargetPriorityPrediction {
  ranked_targets: Array<{
    target_id: string;
    target_name: string;
    predicted_priority_score: number;
    rank: number;
  }>;
  evaluation_criteria: string[];
  source: string;
}

/**
 * AI/ML Service Adapter (Person 3 Contract)
 * Connects to external machine learning microservice (Python FastAPI)
 * with timeout handling, typed fallbacks, and deterministic baseline heuristic scoring.
 */
export class MLEngineAdapter {
  private mlServiceUrl: string;
  private isExternalServiceEnabled: boolean;
  private timeoutMs: number;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";
    this.isExternalServiceEnabled = process.env.ENABLE_ML_SERVICE === "true";
    this.timeoutMs = parseInt(process.env.ML_SERVICE_TIMEOUT_MS || "3000", 10);
  }

  public setServiceUrl(url: string): void {
    this.mlServiceUrl = url;
  }

  public setEnabled(enabled: boolean): void {
    this.isExternalServiceEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.isExternalServiceEnabled;
  }

  public getServiceUrl(): string {
    return this.mlServiceUrl;
  }

  /**
   * Health check for external ML microservice.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(`${this.mlServiceUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok) {
        const body = (await response.json()) as { status?: string };
        return body.status === "healthy";
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Assesses mission route using AI hazard modeling, science yield, and accessibility.
   */
  public async assessMission(
    route: MarsRoute,
    parameters: { maxDurationMinutes: number; astronautSkillLevel?: "standard" | "expert" }
  ): Promise<MissionAssessment> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.mlServiceUrl}/api/v1/assess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, parameters }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          const result = (await response.json()) as MissionAssessment;
          return {
            ...result,
            scoringSource: "model-generated",
            scoringExplanation:
              result.scoringExplanation || "Evaluated by external Person 3 ML inference microservice.",
          };
        }
      } catch (err: unknown) {
        console.warn(
          `[MLEngineAdapter] External ML microservice (${this.mlServiceUrl}) unreachable: ${
            err instanceof Error ? err.message : String(err)
          }. Falling back to baseline heuristic adapter.`
        );
      }
    }

    // Baseline Model (Person 3 pluggable heuristic)
    return this.calculateBaselineAssessment(route, parameters);
  }

  /**
   * Predicts terrain hazard using ML microservice or local heuristic fallback.
   */
  public async predictTerrainHazard(params: {
    slopeDegrees: number;
    elevationDeltaM?: number;
    roughnessIndex?: number;
    rockAbundancePct?: number;
    dustCoverIndex?: number;
    thermalInertiaSi?: number;
  }): Promise<TerrainHazardPrediction> {
    if (this.isExternalServiceEnabled) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(`${this.mlServiceUrl}/api/v1/infer/hazard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slope_degrees: params.slopeDegrees,
            elevation_delta_m: params.elevationDeltaM ?? 0.0,
            roughness_index: params.roughnessIndex ?? 0.2,
            rock_abundance_pct: params.rockAbundancePct ?? 5.0,
            dust_cover_index: params.dustCoverIndex ?? 0.3,
            thermal_inertia_si: params.thermalInertiaSi ?? 280.0,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.ok) {
          return (await response.json()) as TerrainHazardPrediction;
        }
      } catch {
        // Fall back to heuristic
      }
    }

    const slope = params.slopeDegrees;
    const isCritical = slope > 22 || (params.rockAbundancePct ?? 5) > 30;
    const isModerate = slope > 12;
    return {
      hazard_class: isCritical ? "CRITICAL" : isModerate ? "MODERATE" : "LOW",
      hazard_score: Math.min(100, Math.round(slope * 2.5 + (params.roughnessIndex ?? 0.2) * 20)),
      slip_risk_probability: Math.min(1.0, Number((slope / 30.0).toFixed(2))),
      confidence: 0.85,
      factors: { slope, roughness: params.roughnessIndex ?? 0.2 },
      source: "rule-based",
    };
  }

  /**
   * Pluggable Baseline Scoring Model
   */
  private calculateBaselineAssessment(
    route: MarsRoute,
    parameters: { maxDurationMinutes: number; astronautSkillLevel?: "standard" | "expert" }
  ): MissionAssessment {
    const warnings: string[] = [];

    // 1. Safety Score (100 - penalties for slope, distance, duration)
    let safetyScore = 95;
    if (route.maxSlopeDegrees > 20) {
      safetyScore -= 35;
      warnings.push("High slope angle incurs severe slip risk.");
    } else if (route.maxSlopeDegrees > 12) {
      safetyScore -= 15;
    }

    if (route.estimatedDurationMinutes > parameters.maxDurationMinutes) {
      safetyScore -= 30;
      warnings.push("Traverse duration exceeds planned EVA life-support limits.");
    }

    safetyScore = Math.max(10, Math.min(100, safetyScore));

    // 2. Science Score
    const scienceStops = route.points.filter((p) => p.type === "science").length;
    const scienceScore = Math.min(100, scienceStops * 30 + 15);
    if (scienceStops === 0) {
      warnings.push("Route contains zero scientific collection stops.");
    }

    // 3. Accessibility Score
    let accessibilityScore = 90;
    if (route.overallDifficulty === "high") accessibilityScore -= 35;
    else if (route.overallDifficulty === "moderate") accessibilityScore -= 15;
    if (route.totalDistanceKm > 8) accessibilityScore -= 20;

    accessibilityScore = Math.max(15, Math.min(100, accessibilityScore));

    // 4. Overall Score
    const overallScore = Math.round(
      safetyScore * 0.45 + scienceScore * 0.35 + accessibilityScore * 0.2
    );

    let missionStatus: "MISSION FEASIBLE" | "MISSION RESTRICTED" | "MISSION CONSTRAINT EXCEEDED" =
      "MISSION FEASIBLE";
    if (route.estimatedDurationMinutes > parameters.maxDurationMinutes || route.maxSlopeDegrees > 22) {
      missionStatus = "MISSION CONSTRAINT EXCEEDED";
    } else if (overallScore < 70 || route.maxSlopeDegrees > 14) {
      missionStatus = "MISSION RESTRICTED";
    }

    return {
      safetyScore: Math.round(safetyScore),
      scienceScore: Math.round(scienceScore),
      accessibilityScore: Math.round(accessibilityScore),
      overallScore,
      confidence: 0.88,
      warnings,
      recommendedRoute: overallScore < 50 ? "Recommend rerouting to bypass high-gradient segments." : undefined,
      modelIdentifier: "Baseline-Planetary-EVA-v1.0 (Pluggable for Person 3 ML Model)",
      scoringSource: "rule-based",
      missionStatus,
      scoringExplanation:
        "Deterministic evaluation combining MOLA slope risk (45%), science stops count (35%), and metabolic traversal distance (20%).",
    };
  }
}

export const mlEngineAdapter = new MLEngineAdapter();
