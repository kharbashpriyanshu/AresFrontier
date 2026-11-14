import { describe, it, expect, beforeEach } from "vitest";
import { planetaryDataService } from "../../backend/src/services/planetary/planetaryDataService.js";
import { planetaryDataCache } from "../../backend/src/services/planetary/dataCache.js";
import { dataCoverageEngine } from "../../backend/src/services/planetary/dataCoverageEngine.js";

describe("Planetary Data Service Abstraction (Phase 3)", () => {
  beforeEach(() => {
    planetaryDataCache.clear();
  });

  it("returns BENCHMARK mode with calibrated uncertainty for Jezero landing site", async () => {
    const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };
    const res = await planetaryDataService.getElevation(jezeroCoord);

    expect(res.dataMode).toBe("BENCHMARK");
    expect(res.uncertaintyM).toBeLessThanOrEqual(5.0);
    expect(res.elevationM).toBeCloseTo(-2530, -2);
    expect(res.provenance.sourceType).toBe("BENCHMARK_DATA");
  });

  it("caches elevation requests and serves subsequent queries as CACHED", async () => {
    const coord = { latitude: -4.5895, longitude: 137.4417 }; // Gale crater
    const firstCall = await planetaryDataService.getElevation(coord);
    expect(firstCall.dataMode).toBe("BENCHMARK");

    const secondCall = await planetaryDataService.getElevation(coord);
    expect(secondCall.dataMode).toBe("CACHED");
    expect(secondCall.provenance.sourceType).toBe("CACHED_DATA");

    const stats = planetaryDataCache.getStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
  });

  it("evaluates regional observational data coverage across multi-mission instruments", async () => {
    const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };
    const coverage = await dataCoverageEngine.assessLocationCoverage(jezeroCoord);

    expect(["HIGH", "MEDIUM", "LOW"]).toContain(coverage.overallEvidence);
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(coverage.highResImagery);
    expect(["HIGH", "MEDIUM", "LOW", "NONE"]).toContain(coverage.roverEvidence);
    expect(coverage.provenance).toBeDefined();
    expect(coverage.summary).toContain("Region data coverage");
  });
});
