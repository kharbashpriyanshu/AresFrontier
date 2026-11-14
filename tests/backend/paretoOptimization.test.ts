import { describe, it, expect } from "vitest";
import { routeOptimizationEngine } from "../../backend/src/services/intelligence/routeOptimizationEngine.js";

describe("Pareto Frontier & Uncertainty-Adjusted Route Ranking (Phase 3)", () => {
  it("identifies Pareto-efficient non-dominated candidates and computes risk-adjusted score", async () => {
    const candidates = await routeOptimizationEngine.generateCandidates({
      startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
      destinationCoordinate: { latitude: 18.440, longitude: 77.395 },
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      maxDurationMinutes: 240,
    });

    expect(candidates.length).toBe(4);

    const paretoCandidates = candidates.filter((c) => c.multiObjectiveScore?.isParetoEfficient);
    expect(paretoCandidates.length).toBeGreaterThanOrEqual(1);

    for (const cand of candidates) {
      expect(cand.multiObjectiveScore).toBeDefined();
      expect(cand.multiObjectiveScore!.riskAdjustedScore).toBeLessThanOrEqual(100);
      expect(cand.multiObjectiveScore!.riskAdjustedScore).toBeGreaterThanOrEqual(5);
      expect(cand.multiObjectiveScore!.uncertaintyPenalty).toBeGreaterThanOrEqual(0);
      expect(cand.coverage).toBeDefined();
    }
  });
});
