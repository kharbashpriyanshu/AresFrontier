import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { MissionAnalyticsService } from "../../backend/src/services/intelligence/missionAnalyticsService.js";
import { JudgingDemoService } from "../../backend/src/services/demo/judgingDemoService.js";
import { missionRepository } from "../../backend/src/repositories/missionRepository.js";
import { MissionEventStore } from "../../backend/src/services/persistence/missionEventStore.js";

describe("Recovery Batch 7: Mission Analytics & Isolated Judging Demo", () => {
  const userMissionId = "USER-TEST-B7-001";

  afterAll(async () => {
    await JudgingDemoService.resetDemoData();
    await missionRepository.deleteMission(userMissionId);
  });

  it("aggregates multiple persisted missions and supports time-range + bounded event filtering without inventing intervals", async () => {
    const routes = await missionRepository.getAllRoutes();
    const route = routes[0];
    expect(route).toBeDefined();

    await missionRepository.saveMission(
      userMissionId,
      route.id,
      {
        routeId: route.id,
        maxDurationMinutes: 160,
        startCoordinate: { latitude: 18.38, longitude: 77.58 },
        returnRequired: true,
      },
      {
        estimatedDurationMinutes: 90,
        totalDistanceKm: route.totalDistanceKm,
        terrainDifficulty: route.overallDifficulty,
        returnMarginMinutes: 55,
        feasible: true,
        warnings: [],
        oxygenReserveRemainingPercent: 72,
        recommendations: [],
      },
      { name: "User Research Mission B7", status: "APPROVED", isDemo: false }
    );

    MissionEventStore.appendEvent({
      missionId: userMissionId,
      actor: "TEST_HARNESS",
      entityId: userMissionId,
      eventType: "TELEMETRY_UPDATED",
      payload: { batteryPercent: 89, distanceKm: 0.9 },
    });

    const report = MissionAnalyticsService.getAnalytics(userMissionId, { limit: 50 });
    expect(report.missionId).toBe(userMissionId);
    expect(report.isDemo).toBe(false);
    expect(report.missionsSummary.totalPlanned).toBeGreaterThanOrEqual(2);
    expect(report.availableMissions.some((m) => m.id === userMissionId)).toBe(true);
    expect(report.timeSeries.length).toBeGreaterThanOrEqual(1);
    expect(report.filterMeta.limit).toBe(50);

    // Future time window must return empty timeSeries honestly rather than fabricated points
    const futureReport = MissionAnalyticsService.getAnalytics(userMissionId, {
      fromIso: "2099-01-01T00:00:00.000Z",
    });
    expect(futureReport.timeSeries).toEqual([]);
    expect(futureReport.filterMeta.emptyReason).toBeDefined();
  });

  it("compares missions side-by-side with explicit trade-off analysis and exports CSV/JSON", async () => {
    const cmpRes = await request(app)
      .post("/api/analytics/compare")
      .send({ missionIds: ["MARSWALK-001", userMissionId] });

    expect(cmpRes.status).toBe(200);
    expect(cmpRes.body.success).toBe(true);
    expect(cmpRes.body.data.missions.length).toBe(2);
    expect(cmpRes.body.data.provenance.noSingleWinnerClaim).toBe(true);
    expect(cmpRes.body.data.tradeOffAnalysis.length).toBeGreaterThan(0);

    const csvRes = await request(app).get(
      `/api/analytics/${userMissionId}/export?section=overview&format=csv`
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text).toContain(userMissionId);
    expect(csvRes.text).toContain("totalDistanceTraversedKm");

    const jsonRes = await request(app).get(
      `/api/analytics/${userMissionId}/export?section=agents&format=json`
    );
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.missionId).toBe(userMissionId);
    expect(Array.isArray(jsonRes.body.data)).toBe(true);
  });

  it("executes Guided Nominal & Manual Failure Judging Demos in isolation and resets safely without touching user missions", async () => {
    // Guided Scenario A: Nominal Exploration
    const nominalRes = await request(app)
      .post("/api/demo/judging/run")
      .send({ scenarioId: "NOMINAL_EXPLORATION" });
    expect(nominalRes.status).toBe(200);
    expect(nominalRes.body.success).toBe(true);
    const nominalRun = nominalRes.body.data;
    expect(nominalRun.missionId.startsWith("DEMO-NOMINAL-")).toBe(true);
    expect(nominalRun.status).toBe("COMPLETED");
    expect(nominalRun.provenanceClassification).toBe("SIMULATED");
    expect(nominalRun.steps.length).toBe(6);
    expect(nominalRun.finalSummary.isolatedFromUserMissions).toBe(true);

    // Manual step-by-step Scenario B: Operational Failure (first 2 steps)
    const step1 = await request(app)
      .post("/api/demo/judging/step")
      .send({ scenarioId: "OPERATIONAL_FAILURE" });
    expect(step1.status).toBe(200);
    expect(step1.body.data.mode).toBe("MANUAL");
    expect(step1.body.data.steps.length).toBe(1);
    expect(step1.body.data.missionId.startsWith("DEMO-FAILURE-")).toBe(true);

    const step2 = await request(app)
      .post("/api/demo/judging/step")
      .send({ scenarioId: "OPERATIONAL_FAILURE", runId: step1.body.data.runId });
    expect(step2.status).toBe(200);
    expect(step2.body.data.steps.length).toBe(2);

    // Persistent run history check
    const runsRes = await request(app).get("/api/demo/judging/runs");
    expect(runsRes.status).toBe(200);
    expect(runsRes.body.data.length).toBeGreaterThanOrEqual(2);

    // Safe Demo Reset must delete DEMO-* missions & runs while preserving userMissionId!
    const resetRes = await request(app).post("/api/demo/judging/reset");
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.deletedDemoMissions).toContain(nominalRun.missionId);
    expect(resetRes.body.data.deletedDemoMissions).not.toContain(userMissionId);

    const preservedUserMission = await missionRepository.getMissionById(userMissionId);
    expect(preservedUserMission).not.toBeNull();
    expect(preservedUserMission?.name).toBe("User Research Mission B7");
  });
});

