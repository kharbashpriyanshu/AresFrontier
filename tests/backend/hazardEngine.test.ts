import { describe, it, expect } from "vitest";
import { hazardEngine } from "../../backend/src/services/hazard/hazardEngine.js";
import { MarsRoute } from "../../backend/src/types/index.js";

describe("Mars Hazard Engine", () => {
  it("retrieves cataloged planetary hazards with NASA/USGS provenance", () => {
    const hazards = hazardEngine.getAllHazards();
    expect(hazards.length).toBeGreaterThan(4);

    const deltaScarp = hazards.find((h) => h.id === "hzd-jezero-delta-scarp");
    expect(deltaScarp).toBeDefined();
    expect(deltaScarp?.severity).toBe("HIGH");
    expect(deltaScarp?.sourceType).toBe("NASA");
    expect(deltaScarp?.recommendation).toBeDefined();
  });

  it("detects proximity hazards when a route passes near Jezero Delta Scarp", () => {
    const routePassingNearScarp: MarsRoute = {
      id: "test-route-scarp",
      name: "Delta Scarp Test Traverse",
      points: [
        { id: "p1", coordinate: { latitude: 18.447, longitude: 77.401 }, type: "start" },
        { id: "p2", coordinate: { latitude: 18.449, longitude: 77.403 }, type: "destination" },
      ],
      segments: [
        {
          id: "seg-1",
          start: { latitude: 18.447, longitude: 77.401 },
          end: { latitude: 18.449, longitude: 77.403 },
          distanceKm: 0.25,
          elevationGainM: 10,
          elevationLossM: 5,
          averageSlopeDegrees: 3.5,
          difficulty: "low",
          estimatedMinutes: 5,
          hazards: [],
        },
      ],
      totalDistanceKm: 0.25,
      estimatedDurationMinutes: 5,
      elevationProfile: [],
      elevationGainM: 10,
      elevationLossM: 5,
      maxSlopeDegrees: 3.5,
      overallDifficulty: "low",
      createdAt: new Date().toISOString(),
    };

    const assessment = hazardEngine.assessRouteHazards(routePassingNearScarp);
    expect(assessment.hazards.length).toBeGreaterThan(0);
    expect(assessment.reasons.length).toBeGreaterThan(0);
    expect(assessment.hazardScore).toBeGreaterThan(0);
  });

  it("triggers dynamic critical slope hazards when incline exceeds 18 degrees", () => {
    const steepRoute: MarsRoute = {
      id: "test-route-steep",
      name: "Steep Wall Traverse",
      points: [
        { id: "p1", coordinate: { latitude: 10.0, longitude: 10.0 }, type: "start" },
        { id: "p2", coordinate: { latitude: 10.01, longitude: 10.01 }, type: "destination" },
      ],
      segments: [
        {
          id: "seg-steep",
          start: { latitude: 10.0, longitude: 10.0 },
          end: { latitude: 10.01, longitude: 10.01 },
          distanceKm: 0.8,
          elevationGainM: 220,
          elevationLossM: 0,
          averageSlopeDegrees: 19.5,
          difficulty: "high",
          estimatedMinutes: 25,
          hazards: [],
        },
      ],
      totalDistanceKm: 0.8,
      estimatedDurationMinutes: 25,
      elevationProfile: [],
      elevationGainM: 220,
      elevationLossM: 0,
      maxSlopeDegrees: 19.5,
      overallDifficulty: "high",
      createdAt: new Date().toISOString(),
    };

    const assessment = hazardEngine.assessRouteHazards(steepRoute);
    expect(assessment.riskLevel).toBe("CRITICAL");
    expect(assessment.hazardScore).toBeGreaterThanOrEqual(70);
    expect(assessment.reasons.some((r) => r.includes("approaches safe EVA walking limits"))).toBe(true);
  });
});
