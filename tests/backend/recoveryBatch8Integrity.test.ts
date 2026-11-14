import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { MonteCarloEngine } from "../../backend/src/services/simulation/monteCarloEngine.js";
import { MissionAnalyticsService } from "../../backend/src/services/intelligence/missionAnalyticsService.js";
import { JudgingDemoService } from "../../backend/src/services/demo/judgingDemoService.js";
import { missionRepository } from "../../backend/src/repositories/missionRepository.js";
import { MissionEventStore } from "../../backend/src/services/persistence/missionEventStore.js";
import { scienceDecisionService } from "../../backend/src/services/science/scienceDecisionService.js";
import { EvaSessionService } from "../../backend/src/services/eva/evaSessionService.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../../backend/src/services/nasa/adapters/benchmarkData.js";

describe("Recovery Batch 8: Analytics Accuracy, Simulation Integrity & Demo Isolation", () => {
  const suffix = Date.now();
  const missionA = `USER-B8-A-${suffix}`;
  const missionB = `USER-B8-B-${suffix}`;
  const routeA = "route-b8-short";
  const routeB = "route-b8-long";

  afterAll(async () => {
    await JudgingDemoService.resetDemoData();
    await missionRepository.deleteMission(missionA);
    await missionRepository.deleteMission(missionB);
    await missionRepository.deleteRoute(routeA);
    await missionRepository.deleteRoute(routeB);
    scienceDecisionService.deleteDecisionsForMissions([missionA, missionB]);
    EvaSessionService.deleteSessionsForMissions([missionA, missionB]);
  });

  it("Monte Carlo is reproducible with identical seeds and responds to failure injection", () => {
    const nominal = MonteCarloEngine.runAnalysis({
      missionId: "MARSWALK-001",
      runCount: 50,
      seed: 20261199,
      commOutageRate: 0.05,
      injectedBatteryDropPercent: 0,
    });

    const degraded1 = MonteCarloEngine.runAnalysis({
      missionId: "MARSWALK-001",
      runCount: 50,
      seed: 20261199,
      commOutageRate: 0.35,
      injectedBatteryDropPercent: 25,
      requireCommsForNominalCompletion: true,
    });

    const degraded2 = MonteCarloEngine.runAnalysis({
      missionId: "MARSWALK-001",
      runCount: 50,
      seed: 20261199,
      commOutageRate: 0.35,
      injectedBatteryDropPercent: 25,
      requireCommsForNominalCompletion: true,
    });

    // Reproducibility with identical seed
    expect(degraded1.missionCompletionCount).toBe(degraded2.missionCompletionCount);
    expect(degraded1.safeRecoveryCount).toBe(degraded2.safeRecoveryCount);
    expect(degraded1.failureCount).toBe(degraded2.failureCount);
    expect(degraded1.runOutputs).toEqual(degraded2.runOutputs);

    // Failure injection lowers nominal completion below 100% and tracks safe recovery
    expect(degraded1.missionCompletionRatePercent).toBeLessThan(100);
    expect(degraded1.missionCompletionRatePercent).toBeLessThan(nominal.missionCompletionRatePercent);
    expect(degraded1.safeRecoveryCount).toBeGreaterThan(0);
    expect(degraded1.overallSurvivalRatePercent).toBeGreaterThanOrEqual(
      degraded1.missionCompletionRatePercent
    );
    expect(degraded1.completionRateCI95Percent[0]).toBeLessThanOrEqual(
      degraded1.missionCompletionRatePercent
    );
    expect(degraded1.assumptions.length).toBeGreaterThan(0);
  });

  it("Operational Failure judging demo records emergency EVA return even after session completion", async () => {
    const res = await request(app)
      .post("/api/demo/judging/run")
      .send({ scenarioId: "OPERATIONAL_FAILURE" });

    expect(res.status).toBe(200);
    const run = res.body.data;
    expect(run.status).toBe("RECOVERED");
    expect(run.finalSummary.emergencyReturnTriggered).toBe(true);
    expect(run.finalSummary.historicalEmergencyCount).toBeGreaterThanOrEqual(1);
    expect(run.finalSummary.emergencyEventsCount).toBeGreaterThanOrEqual(1);
    expect(run.finalSummary.finalEvaSessionStatus).toBe("COMPLETED");
    expect(run.finalSummary.monteCarloCompletionRatePercent).toBeLessThan(100);
    expect(run.finalSummary.monteCarloSurvivalRatePercent).toBeGreaterThanOrEqual(
      run.finalSummary.monteCarloCompletionRatePercent
    );
    expect(run.finalSummary.disclosure).toContain("Not NASA-certified");
  });

  it("derives independent per-mission metrics, handles missing telemetry as null, and computes exact comms denominators", async () => {
    await missionRepository.saveRoute({
      id: routeA,
      name: "B8 Short Route",
      points: [
        { id: "a1", coordinate: { latitude: 18.4, longitude: 77.5 }, type: "start" },
        { id: "a2", coordinate: { latitude: 18.41, longitude: 77.51 }, type: "destination" },
      ],
      segments: [],
      totalDistanceKm: 1.5,
      estimatedDurationMinutes: 60,
      elevationProfile: [],
      elevationGainM: 20,
      elevationLossM: 5,
      maxSlopeDegrees: 6.0,
      overallDifficulty: "low",
      createdAt: new Date().toISOString(),
    });

    await missionRepository.saveRoute({
      id: routeB,
      name: "B8 Long Route",
      points: [
        { id: "b1", coordinate: { latitude: 18.4, longitude: 77.5 }, type: "start" },
        { id: "b2", coordinate: { latitude: 18.46, longitude: 77.58 }, type: "destination" },
      ],
      segments: [],
      totalDistanceKm: 4.8,
      estimatedDurationMinutes: 170,
      elevationProfile: [],
      elevationGainM: 120,
      elevationLossM: 30,
      maxSlopeDegrees: 14.0,
      overallDifficulty: "high",
      createdAt: new Date().toISOString(),
    });

    await missionRepository.saveMission(
      missionA,
      routeA,
      {
        routeId: routeA,
        maxDurationMinutes: 120,
        startCoordinate: { latitude: 18.4, longitude: 77.5 },
        returnRequired: true,
      },
      {
        estimatedDurationMinutes: 60,
        totalDistanceKm: 1.5,
        terrainDifficulty: "low",
        returnMarginMinutes: 50,
        feasible: true,
        warnings: [],
        oxygenReserveRemainingPercent: 75,
        recommendations: [],
      },
      { name: "Mission A (Telemetry + Science)", status: "DRAFT", isDemo: false }
    );

    await missionRepository.saveMission(
      missionB,
      routeB,
      {
        routeId: routeB,
        maxDurationMinutes: 200,
        startCoordinate: { latitude: 18.4, longitude: 77.5 },
        returnRequired: false,
      },
      {
        estimatedDurationMinutes: 170,
        totalDistanceKm: 4.8,
        terrainDifficulty: "high",
        returnMarginMinutes: 20,
        feasible: true,
        warnings: [],
        oxygenReserveRemainingPercent: 45,
        recommendations: [],
      },
      { name: "Mission B (No Telemetry)", status: "DRAFT", isDemo: false }
    );

    // Record science decision + battery + 2 delivered / 1 lost comms packet ONLY for Mission A
    scienceDecisionService.assignTargetToMission({
      missionId: missionA,
      targetId: VERIFIED_NASA_SCIENCE_TARGETS[0].id,
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      actor: "TEST_SCIENTIST",
      rationale: "Independent science decision for Mission A",
    });

    MissionEventStore.appendEvent({
      missionId: missionA,
      actor: "ROVER_A",
      entityId: missionA,
      eventType: "PACKET_DELIVERED",
      payload: { batteryPercent: 78, latencyMs: 120 },
    });
    MissionEventStore.appendEvent({
      missionId: missionA,
      actor: "ROVER_A",
      entityId: missionA,
      eventType: "PACKET_DELIVERED",
      payload: { latencyMs: 140 },
    });
    MissionEventStore.appendEvent({
      missionId: missionA,
      actor: "ROVER_A",
      entityId: missionA,
      eventType: "COMMUNICATION_LOST",
      payload: {},
    });

    const reportA = MissionAnalyticsService.getAnalytics(missionA);
    const reportB = MissionAnalyticsService.getAnalytics(missionB);

    // Mission A has measured battery (78%), 2/3 comms (66.7%), 130 ms avg latency, modeled science yield > 0
    expect(reportA.operations.totalDistanceTraversedKm).toBe(1.5);
    expect(reportA.operations.averageFleetBatteryPercent).toBe(78);
    expect(reportA.communication.packetsTransmittedCount).toBe(2);
    expect(reportA.communication.packetsDroppedCount).toBe(1);
    expect(reportA.communication.totalPacketsDenominator).toBe(3);
    expect(reportA.communication.packetDeliveryRatePercent).toBe(66.7);
    expect(reportA.communication.averageLatencyMs).toBe(130);
    expect(reportA.science.provenanceType).toBe("MODELED");
    expect(reportA.science.cumulativeScienceYield).toBeGreaterThan(15);

    // Mission B has NO telemetry -> null (N/A), NOT copied from Mission A or MARSWALK-001!
    expect(reportB.operations.totalDistanceTraversedKm).toBe(4.8);
    expect(reportB.operations.averageFleetBatteryPercent).toBeNull();
    expect(reportB.communication.totalPacketsDenominator).toBe(0);
    expect(reportB.communication.packetDeliveryRatePercent).toBeNull();
    expect(reportB.communication.averageLatencyMs).toBeNull();
    expect(reportB.science.cumulativeScienceYield).toBeLessThan(reportA.science.cumulativeScienceYield);

    // Comparison must preserve genuine differences
    const cmp = MissionAnalyticsService.compareMissions([missionA, missionB]);
    expect(cmp.missions[0].totalDistanceKm).toBe(1.5);
    expect(cmp.missions[1].totalDistanceKm).toBe(4.8);
    expect(cmp.missions[0].batteryConsumptionPercent).toBe(22);
    expect(cmp.missions[1].batteryConsumptionPercent).toBeNull();
    expect(cmp.missions[0].commsReliabilityPercent).toBe(66.7);
    expect(cmp.missions[1].commsReliabilityPercent).toBeNull();

    // UTC time-range filtering excludes out-of-window events consistently
    const futureFiltered = MissionAnalyticsService.getAnalytics(missionA, {
      fromIso: "2099-01-01T00:00:00.000Z",
    });
    expect(futureFiltered.timeSeries).toEqual([]);
    expect(futureFiltered.communication.totalPacketsDenominator).toBe(0);
    expect(futureFiltered.communication.packetDeliveryRatePercent).toBeNull();
  });

  it("demo reset deletes demo missions, routes, EVA sessions, and science decisions while preserving user data", async () => {
    const demoRun = await JudgingDemoService.runFullScenario("NOMINAL_EXPLORATION");
    const resetResult = await JudgingDemoService.resetDemoData();

    expect(resetResult.deletedDemoMissions).toContain(demoRun.missionId);
    expect(resetResult.deletedDemoRoutes).toContain(demoRun.routeId);
    expect(resetResult.deletedEvaSessionsCount).toBeGreaterThanOrEqual(1);
    expect(resetResult.deletedScienceDecisionsCount).toBeGreaterThanOrEqual(1);

    // User mission A and its route and science decisions must remain intact
    const preservedA = await missionRepository.getMissionById(missionA);
    const preservedRouteA = await missionRepository.getRouteById(routeA);
    const preservedDecisionsA = scienceDecisionService.getDecisions(missionA);
    expect(preservedA).not.toBeNull();
    expect(preservedRouteA).not.toBeNull();
    expect(preservedDecisionsA.length).toBeGreaterThanOrEqual(1);
  });
});
