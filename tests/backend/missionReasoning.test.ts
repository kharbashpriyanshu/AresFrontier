import { describe, it, expect } from "vitest";
import { routeOptimizationEngine } from "../../backend/src/services/intelligence/routeOptimizationEngine.js";
import { missionReasoningService } from "../../backend/src/services/intelligence/missionReasoningService.js";

describe("Mission Reasoning Service", () => {
  it("produces structured, explainable mission recommendations with cryptographic audit hash", async () => {
    const candidates = await routeOptimizationEngine.generateCandidates({
      startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
      destinationCoordinate: { latitude: 18.455, longitude: 77.465 },
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      maxDurationMinutes: 180,
    });

    const recommendation = missionReasoningService.generateRecommendation(
      candidates,
      "ANCIENT_WATER_ACTIVITY",
      180
    );

    expect(recommendation.recommendedRouteId).toBeDefined();
    expect(recommendation.decision).toContain("Recommend");
    expect(recommendation.reasoning.length).toBeGreaterThanOrEqual(2);
    expect(recommendation.majorRisks.length).toBeGreaterThanOrEqual(1);
    expect(recommendation.scienceOpportunities.length).toBeGreaterThanOrEqual(1);
    expect(recommendation.operationalRecommendations.length).toBeGreaterThanOrEqual(2);
    expect(recommendation.generatedBy).toBe("RULE_ENGINE");
    expect(recommendation.confidence).toBeGreaterThan(0.8);
    expect(recommendation.auditHash).toBeDefined();
    expect(recommendation.auditHash?.length).toBe(64); // SHA-256 length
  });
});
