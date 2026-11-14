import { describe, it, expect } from "vitest";
import { terrainEngine } from "../../backend/src/services/terrain/terrainEngine.js";

describe("Terrain Intelligence Engine", () => {
  it("computes accurate point terrain metrics with derived provenance", () => {
    const jezeroCenter = { latitude: 18.4447, longitude: 77.4508 };
    const assessment = terrainEngine.assessPoint(jezeroCenter);

    expect(assessment.elevationM).toBeDefined();
    expect(assessment.averageSlopeDeg).toBeGreaterThanOrEqual(0);
    expect(assessment.maxSlopeDeg).toBeGreaterThanOrEqual(0);
    expect(assessment.traversalDifficulty).toMatch(/low|moderate|high/);
    expect(["DERIVED", "BENCHMARK_DATA"]).toContain(assessment.sourceType);
    expect(assessment.confidence).toBeGreaterThan(0.85);
  });

  it("computes segment terrain profile and elevation differentials", () => {
    const start = { latitude: 18.4447, longitude: 77.4508 };
    const end = { latitude: 18.46, longitude: 77.47 };
    const assessment = terrainEngine.assessSegment(start, end, 10);

    expect(assessment.maxSlopeDeg).toBeGreaterThanOrEqual(assessment.averageSlopeDeg);
    expect(assessment.elevationGainM + assessment.elevationLossM).toBeGreaterThanOrEqual(0);
    expect(["low", "moderate", "high"]).toContain(assessment.traversalDifficulty);
  });

  it("calculates roughness index from elevation standard deviation", () => {
    const flatElevations = [100, 100, 100, 100];
    const roughElevations = [100, 180, 50, 220, 90];

    const flatRoughness = terrainEngine.calculateRoughness(flatElevations);
    const highRoughness = terrainEngine.calculateRoughness(roughElevations);

    expect(flatRoughness).toBe(0);
    expect(highRoughness).toBeGreaterThan(0.4);
    expect(terrainEngine.classifyDifficulty(25, 0.7)).toBe("high");
    expect(terrainEngine.classifyDifficulty(5, 0.1)).toBe("low");
  });
});
