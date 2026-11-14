import { describe, it, expect } from "vitest";
import { missionEngine } from "../../backend/src/services/mission/missionEngine.js";
import { RoutePoint } from "../../backend/src/types/index.js";

describe("Mission & EVA Engine Calculations", () => {
  const mockPoints: RoutePoint[] = [
    {
      id: "pt-1",
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      type: "start",
      label: "Jezero Base",
    },
    {
      id: "pt-2",
      coordinate: { latitude: 18.435, longitude: 77.438 },
      type: "science",
      label: "Delta Outcrop",
    },
    {
      id: "pt-3",
      coordinate: { latitude: 18.423, longitude: 77.411 },
      type: "destination",
      label: "Sample Cache",
    },
  ];

  it("generates deterministic Mars route with profile and segments", async () => {
    const route = await missionEngine.generateRoute("Test Jezero Traverse", mockPoints);
    expect(route.id).toBeDefined();
    expect(route.totalDistanceKm).toBeGreaterThan(0);
    expect(route.segments.length).toBe(2);
    expect(route.elevationProfile.length).toBeGreaterThan(5);
    expect(route.estimatedDurationMinutes).toBeGreaterThan(30); // includes science stop
  });

  it("handles routes with multiple science stops and adds dwell times", async () => {
    const multiSciencePoints: RoutePoint[] = [
      { id: "p1", coordinate: { latitude: 18.44, longitude: 77.45 }, type: "start" },
      { id: "p2", coordinate: { latitude: 18.43, longitude: 77.44 }, type: "science" },
      { id: "p3", coordinate: { latitude: 18.42, longitude: 77.43 }, type: "science" },
      { id: "p4", coordinate: { latitude: 18.41, longitude: 77.42 }, type: "destination" },
    ];
    const route = await missionEngine.generateRoute("Multi-Science Traverse", multiSciencePoints);
    expect(route.segments.length).toBe(3);
    // Two science stops should add at least 50 minutes of dwell time
    expect(route.estimatedDurationMinutes).toBeGreaterThan(50);
  });

  it("evaluates EVA feasibility and enforces reserve margins", async () => {
    const route = await missionEngine.generateRoute("Test Jezero Traverse", mockPoints);
    const assessment = missionEngine.assessEVAFeasibility(route, {
      maxDurationMinutes: 240,
      startCoordinate: mockPoints[0].coordinate,
      returnRequired: true,
    });

    expect(assessment.feasible).toBe(true);
    expect(assessment.totalDistanceKm).toBe(route.totalDistanceKm);
    expect(assessment.returnMarginMinutes).toBeGreaterThan(0);
    expect(assessment.oxygenReserveRemainingPercent).toBeGreaterThan(0);
  });

  it("flags infeasible traverse when duration exceeds limits", async () => {
    const route = await missionEngine.generateRoute("Test Jezero Traverse", mockPoints);
    const assessment = missionEngine.assessEVAFeasibility(route, {
      maxDurationMinutes: 60, // unrealistically short limit
      startCoordinate: mockPoints[0].coordinate,
      returnRequired: true,
    });

    expect(assessment.feasible).toBe(false);
    expect(assessment.warnings.length).toBeGreaterThan(0);
    expect(assessment.warnings.some((w) => w.includes("exceeds"))).toBe(true);
  });

  it("flags low return margin warning when reserve is under 30 minutes", async () => {
    const route = await missionEngine.generateRoute("Test Jezero Traverse", mockPoints);
    // Set duration limit just slightly above traverse time so margin is < 30 min
    const tightDuration = route.estimatedDurationMinutes + 15;
    const assessment = missionEngine.assessEVAFeasibility(route, {
      maxDurationMinutes: tightDuration,
      startCoordinate: mockPoints[0].coordinate,
      returnRequired: false,
    });

    expect(assessment.feasible).toBe(false);
    expect(assessment.warnings.some((w) => w.includes("reserve margin"))).toBe(true);
  });

  it("throws clear error when route has fewer than 2 points", async () => {
    await expect(
      missionEngine.generateRoute("Invalid Route", [
        { id: "single", coordinate: { latitude: 0, longitude: 0 }, type: "start" },
      ])
    ).rejects.toThrow("A route requires at least a start and destination coordinate.");
  });
});
