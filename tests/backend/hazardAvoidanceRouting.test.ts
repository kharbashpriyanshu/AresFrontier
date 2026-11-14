import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { hazardAvoidanceRouter } from "../../backend/src/services/intelligence/hazardAvoidanceRouter.js";
import { DOCUMENTED_MARS_HAZARDS } from "../../backend/src/services/hazard/hazardEngine.js";

describe("Upgrade U4: A* Cost-Gradient Hazard-Avoidance Routing", () => {
  it("detects when direct path intersects an empirical hazard buffer", () => {
    // Start east of Jezero delta scarp, end west of scarp (direct path crosses 18.448, 77.402)
    const start = { latitude: 18.448, longitude: 77.420 };
    const destination = { latitude: 18.448, longitude: 77.385 };

    const check = hazardAvoidanceRouter.checkPathIntersection(start, destination, DOCUMENTED_MARS_HAZARDS, 150);
    expect(check.safe).toBe(false);
    expect(check.intersectingHazards.length).toBeGreaterThan(0);
    expect(check.intersectingHazards.some((h) => h.id === "hzd-jezero-delta-scarp")).toBe(true);
  });

  it("computes safe detour path with A* algorithm bypassing scarp obstacle", () => {
    const start = { latitude: 18.448, longitude: 77.420 };
    const destination = { latitude: 18.448, longitude: 77.385 };

    const result = hazardAvoidanceRouter.planSafeRoute(start, destination, {
      safetyBufferM: 150,
      maxAllowableSlopeDegrees: 16,
    });

    expect(result.algorithm).toBe("A_STAR_GRADIENT_AVOIDANCE");
    expect(result.isDirectPathSafe).toBe(false);
    expect(result.routePoints.length).toBeGreaterThan(2); // Has detour waypoints
    expect(result.totalDistanceKm).toBeGreaterThan(0);
    expect(result.hazardsBypassed.length).toBeGreaterThan(0);

    // Standoff margin should be preserved
    const scarpBypassed = result.hazardsBypassed.find((h) => h.hazardId === "hzd-jezero-delta-scarp");
    if (scarpBypassed) {
      expect(scarpBypassed.standoffDistanceM).toBeGreaterThanOrEqual(100);
    }
  });

  it("returns direct path when no hazards intersect", () => {
    // Two close points on flat Jezero crater floor away from scarps
    const start = { latitude: 18.4447, longitude: 77.4508 };
    const destination = { latitude: 18.4455, longitude: 77.4520 };

    const result = hazardAvoidanceRouter.planSafeRoute(start, destination);
    expect(result.isDirectPathSafe).toBe(true);
    expect(result.routePoints.length).toBe(2);
    expect(result.hazardsBypassed.length).toBe(0);
  });

  it("serves safe hazard avoidance route via authentic API endpoint", async () => {
    const response = await request(app)
      .get("/api/data/authentic/safe-route")
      .query({
        startLat: 18.448,
        startLon: 77.420,
        destLat: 18.448,
        destLon: 77.385,
        bufferM: 150,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.algorithm).toBe("A_STAR_GRADIENT_AVOIDANCE");
    expect(response.body.data.routePoints.length).toBeGreaterThan(2);
    expect(response.body.data.provenance.dataset).toContain("MOLA");
  });
});
