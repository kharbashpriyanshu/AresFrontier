import { describe, it, expect } from "vitest";
import { routeOptimizationEngine } from "../../backend/src/services/intelligence/routeOptimizationEngine.js";

describe("Science-Aware Route Optimization Engine", () => {
  it("generates 4 differentiated route candidate profiles", async () => {
    const candidates = await routeOptimizationEngine.generateCandidates({
      startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
      destinationCoordinate: { latitude: 18.46, longitude: 77.47 },
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      maxDurationMinutes: 180,
    });

    expect(candidates.length).toBe(4);
    const profiles = candidates.map((c) => c.profileType);
    expect(profiles).toContain("shortest");
    expect(profiles).toContain("safest");
    expect(profiles).toContain("highest_science");
    expect(profiles).toContain("balanced");
  });

  it("calculates bounded scores for terrain, science, safety, and overall", async () => {
    const candidates = await routeOptimizationEngine.generateCandidates({
      startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
      objectiveId: "PAST_HABITABILITY",
      maxDurationMinutes: 180,
    });

    for (const cand of candidates) {
      expect(cand.overallScore).toBeGreaterThanOrEqual(0);
      expect(cand.overallScore).toBeLessThanOrEqual(100);
      expect(cand.safetyScore).toBeGreaterThanOrEqual(0);
      expect(cand.safetyScore).toBeLessThanOrEqual(100);
      expect(cand.scienceScore).toBeGreaterThanOrEqual(0);
      expect(cand.scienceScore).toBeLessThanOrEqual(100);
      expect(cand.terrainScore).toBeGreaterThanOrEqual(0);
      expect(cand.terrainScore).toBeLessThanOrEqual(100);
      expect(typeof cand.feasible).toBe("boolean");
      expect(cand.recommendationReason).toBeDefined();
    }
  });
});
