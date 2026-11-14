import { MarsRoute, MissionAssessment } from "../../types/index.js";

/**
 * AI/ML Service Adapter (Person 3 Contract)
 * Connects to external machine learning microservice (e.g. Python FastAPI)
 * or executes deterministic fallback scoring.
 */
export class MLEngineAdapter {
  private mlServiceUrl: string;
  private isExternalServiceEnabled: boolean;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";
    this.isExternalServiceEnabled = process.env.ENABLE_ML_SERVICE === "true";
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
        const response = await fetch(`${this.mlServiceUrl}/api/v1/assess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, parameters }),
        });

        if (response.ok) {
          const result = await response.json() as MissionAssessment;
          return {
            ...result,
            scoringSource: "model-generated",
            scoringExplanation: result.scoringExplanation || "Evaluated by external Person 3 ML inference microservice.",
          };
        }
      } catch {
        // Fall back gracefully to local baseline heuristic model
        console.warn("[MLEngineAdapter] External ML microservice unreachable. Falling back to baseline heuristic adapter.");
      }
    }

    // Baseline Model (Person 3 pluggable heuristic)
    return this.calculateBaselineAssessment(route, parameters);
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
    let scienceScore = Math.min(100, scienceStops * 30 + 15);
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
      safetyScore * 0.45 + scienceScore * 0.35 + accessibilityScore * 0.20
    );

    let missionStatus: "MISSION FEASIBLE" | "MISSION RESTRICTED" | "MISSION CONSTRAINT EXCEEDED" = "MISSION FEASIBLE";
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
      scoringExplanation: "Deterministic evaluation combining MOLA slope risk (45%), science stops count (35%), and metabolic traversal distance (20%).",
    };
  }
}

export const mlEngineAdapter = new MLEngineAdapter();
