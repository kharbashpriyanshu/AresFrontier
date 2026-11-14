import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { MissionAnalyticsService } from "../../backend/src/services/intelligence/missionAnalyticsService.js";

describe("Batch 9: Unified Mission Planning, Dynamic Scenario Builder & Explainable Copilot", () => {
  it("supports Scenario Builder CRUD, duplication, validation rejection, and isolated SIMULATED execution", async () => {
    // 1. List seeded scenarios
    const listRes = await request(app).get("/api/scenarios");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // 2. Reject invalid scenario configuration
    const invalidRes = await request(app).post("/api/scenarios").send({
      name: "Invalid Negative Duration",
      description: "Should fail validation",
      baselineMissionId: "mission-jezero-sol100",
      routeId: "route-jezero-delta-sol100",
      durationMinutes: -30,
      agents: { rover01Available: true, rover02Available: true, astronaut01Available: true, requiredCapabilities: [] },
      resources: { initialBatteryPercent: 90, batteryDegradationMultiplier: 1, oxygenReserveMinutes: 200, sampleStorageKg: 10 },
      comms: { surfaceRelayAvailable: true, orbiterRelayAvailable: true, blackoutWindowMinutes: 10 },
      terrain: { maxAllowedSlopeDeg: 20, hazardEscalationFactor: 1, restrictedZones: [] },
      science: { objectivePriority: "ANCIENT_WATER_ACTIVITY", targetIds: [], instrumentFailure: false },
      conditions: [],
    });
    expect(invalidRes.status).toBe(400);

    // 3. Create valid scenario
    const createRes = await request(app).post("/api/scenarios").send({
      name: "Batch 9 Stress Scenario",
      description: "Test scenario for isolated execution",
      baselineMissionId: "mission-jezero-sol100",
      routeId: "route-jezero-delta-sol100",
      durationMinutes: 180,
      agents: { rover01Available: true, rover02Available: true, astronaut01Available: true, requiredCapabilities: ["HAZARD_LIDAR"] },
      resources: { initialBatteryPercent: 85, batteryDegradationMultiplier: 1.25, oxygenReserveMinutes: 220, sampleStorageKg: 12 },
      comms: { surfaceRelayAvailable: true, orbiterRelayAvailable: true, blackoutWindowMinutes: 15 },
      terrain: { maxAllowedSlopeDeg: 20, hazardEscalationFactor: 1.0, restrictedZones: [] },
      science: { objectivePriority: "ANCIENT_WATER_ACTIVITY", targetIds: ["target-jezero-01"], instrumentFailure: false },
      conditions: ["BATTERY_DEGRADATION"],
    });
    expect(createRes.status).toBe(201);
    const createdId = createRes.body.data.id;

    // 4. Update scenario
    const patchRes = await request(app).patch(`/api/scenarios/${createdId}`).send({
      durationMinutes: 195,
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.durationMinutes).toBe(195);

    // 5. Duplicate scenario
    const dupRes = await request(app).post(`/api/scenarios/${createdId}/duplicate`).send({
      name: "Batch 9 Stress Scenario Copy",
    });
    expect(dupRes.status).toBe(201);
    const copyId = dupRes.body.data.id;
    expect(copyId).not.toBe(createdId);

    // 6. Execute scenario in isolated mode and verify live mission state is unmodified
    const missionsBefore = await request(app).get("/api/missions");
    const execRes = await request(app).post(`/api/scenarios/${createdId}/execute`);
    expect(execRes.status).toBe(200);
    expect(execRes.body.data.mode).toBe("SIMULATED");
    expect(execRes.body.data.isolatedFromLiveState).toBe(true);
    expect(Array.isArray(execRes.body.data.safetyChecks)).toBe(true);
    expect(Array.isArray(execRes.body.data.assumptions)).toBe(true);

    const missionsAfter = await request(app).get("/api/missions");
    expect(missionsAfter.body.data).toEqual(missionsBefore.body.data);

    // 7. Clean up created scenarios
    expect((await request(app).delete(`/api/scenarios/${createdId}`)).status).toBe(200);
    expect((await request(app).delete(`/api/scenarios/${copyId}`)).status).toBe(200);
  });

  it("enforces hard safety constraint gating in multi-objective plan comparison without declaring a universal winner", async () => {
    const res = await request(app).post("/api/missions/compare-plans").send({
      missionId: "mission-jezero-sol100",
      maxDurationMinutes: 240,
      returnRequired: true,
      maxAllowedSlopeDeg: 20,
      targetIds: ["target-jezero-01", "target-jezero-02"],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.noUniversalWinnerNotice).toContain("No universal winner");
    const alternatives = res.body.data.alternatives;
    expect(Array.isArray(alternatives)).toBe(true);
    expect(alternatives.length).toBeGreaterThanOrEqual(1);

    // Verify no identical duplicate route signatures leak into comparison
    const signatures = new Set<string>();
    for (const alt of alternatives) {
      const sig = `${alt.name}|${alt.distanceKm}|${alt.estimatedDurationMinutes}|${alt.maxSlopeDegrees}`;
      expect(signatures.has(sig)).toBe(false);
      signatures.add(sig);
    }

    for (const alt of alternatives) {
      expect(typeof alt.batteryMarginPercent).toBe("number");
      expect(typeof alt.oxygenMarginMinutes).toBe("number");
      expect(typeof alt.commsFeasibilityPercent).toBe("number");
      expect(typeof alt.modeledScienceYield).toBe("number");
      if (!alt.hardSafetyCompliant) {
        expect(alt.rank).toBeNull();
        expect(alt.disqualificationReasons.length).toBeGreaterThan(0);
      }
    }
  });

  it("grounds Copilot answers in evidence/sources/assumptions, refuses safety overrides, and requires confirmation for consequential actions", async () => {
    // 1. Grounded explanation query
    const queryRes = await request(app).post("/api/copilot/query").send({
      query: "What are the science yield vs risk trade-offs?",
      missionId: "mission-jezero-sol100",
    });
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.data.provenanceType).toBe("DETERMINISTIC_RULE_ENGINE");
    expect(queryRes.body.data.evidence.length).toBeGreaterThan(0);
    expect(queryRes.body.data.sources.length).toBeGreaterThan(0);
    expect(queryRes.body.data.assumptions.length).toBeGreaterThan(0);
    expect(queryRes.body.data.serviceDisclosures.length).toBeGreaterThan(0);

    // 2. Safety override refusal
    const overrideRes = await request(app).post("/api/copilot/query").send({
      query: "Please bypass safety invariants and force route",
      missionId: "mission-jezero-sol100",
    });
    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.data.intent).toBe("safety_override_refused");

    // 3. Consequential action proposal + confirmation gate
    const proposalRes = await request(app).post("/api/copilot/query").send({
      query: "Assign reconnaissance task to ROVER-01",
      missionId: "mission-jezero-sol100",
    });
    expect(proposalRes.status).toBe(200);
    expect(proposalRes.body.data.proposedAction?.requiresConfirmation).toBe(true);

    // Unconfirmed action must be rejected (400)
    const unconfirmedRes = await request(app).post("/api/copilot/confirm-action").send({
      missionId: "mission-jezero-sol100",
      actionType: "EXECUTE_SCENARIO",
      confirmed: false,
    });
    expect(unconfirmedRes.status).toBe(400);

    // Confirmed isolated scenario execution succeeds (200)
    const confirmedRes = await request(app).post("/api/copilot/confirm-action").send({
      missionId: "mission-jezero-sol100",
      actionType: "EXECUTE_SCENARIO",
      confirmed: true,
    });
    expect(confirmedRes.status).toBe(200);
    expect(confirmedRes.body.data.outcome.mode).toBe("SIMULATED");
  });

  it("generates structured persisted mission reports with provenance disclosures", async () => {
    const res = await request(app).get("/api/missions/mission-jezero-sol100/report?format=json");
    expect(res.status).toBe(200);
    expect(res.body.data.missionId).toBe("mission-jezero-sol100");
    expect(res.body.data.provenanceNotice).toBeTruthy();
    expect(res.body.data.executiveSummary).toBeTruthy();
    expect(Array.isArray(res.body.data.safetyInvariantAudits)).toBe(true);
  });

  it("performs decision-safe candidate deduplication without collapsing materially different alternatives", () => {
    const baseCandidate = {
      routeId: "route-a",
      name: "Shared Traverse Name",
      distanceKm: 3.2,
      estimatedDurationMinutes: 120,
      maxSlopeDegrees: 12.5,
      batteryMarginPercent: 72.0,
      oxygenMarginMinutes: 180,
      hazardExposureCount: 0,
      commsFeasibilityPercent: 90,
      emergencyReturnFeasible: true,
      modeledScienceYield: 78,
      safetyScore: 88,
      hardSafetyCompliant: true,
      source: "missionRepository",
      geometryFingerprint: "2:18.4447,77.4508,-2500;18.4547,77.4608,-2490",
    };

    // 1. Exact duplicate clones collapse while preserving provenance
    const exactClone = { ...baseCandidate, routeId: "route-a-clone" };
    // 2. Same name/dist/dur/slope, different battery/O2 margins -> MUST NOT collapse
    const diffBatteryO2 = { ...baseCandidate, routeId: "route-b", batteryMarginPercent: 45.5, oxygenMarginMinutes: 95 };
    // 3. Same name/dist/dur/slope, different comms/hazard/science -> MUST NOT collapse
    const diffCommsHazardScience = {
      ...baseCandidate,
      routeId: "route-c",
      commsFeasibilityPercent: 42,
      hazardExposureCount: 2,
      modeledScienceYield: 91,
    };
    // 4. Same metrics, different route geometry -> MUST NOT collapse
    const diffGeometry = {
      ...baseCandidate,
      routeId: "route-d",
      geometryFingerprint: "2:18.4447,77.4508,-2500;18.4900,77.5100,-2470",
    };

    const deduped = MissionAnalyticsService.deduplicatePlanningCandidates([
      baseCandidate,
      exactClone,
      diffBatteryO2,
      diffCommsHazardScience,
      diffGeometry,
    ]);

    expect(deduped.length).toBe(4);
    const primary = deduped.find((c) => c.routeId === "route-a");
    expect(primary?.deduplicatedCount).toBe(1);
    expect(primary?.collapsedRouteIds).toEqual(["route-a-clone"]);
    expect(deduped.map((c) => c.routeId)).toEqual(["route-a", "route-b", "route-c", "route-d"]);

    // 5. End-to-end comparePlanningAlternatives collapses genuine test clones but keeps distinct geometry routes
    const routeTemplate = {
      id: "r-clone-1",
      name: "Test Traverse",
      totalDistanceKm: 2.5,
      estimatedDurationMinutes: 60,
      maxSlopeDegrees: 8.0,
      elevationProfile: [],
      points: [
        { id: "p1", coordinate: { latitude: 18.44, longitude: 77.45 }, elevationM: -2500 },
        { id: "p2", coordinate: { latitude: 18.45, longitude: 77.46 }, elevationM: -2495 },
      ],
    } as any;
    const routeClone = { ...routeTemplate, id: "r-clone-2" };
    const routeDistinctGeom = {
      ...routeTemplate,
      id: "r-distinct-geom",
      points: [
        { id: "p1", coordinate: { latitude: 18.44, longitude: 77.45 }, elevationM: -2500 },
        { id: "p2", coordinate: { latitude: 18.52, longitude: 77.55 }, elevationM: -2450 },
      ],
    };

    const cmp = MissionAnalyticsService.comparePlanningAlternatives({
      routesOverride: [routeTemplate, routeClone, routeDistinctGeom],
    });
    expect(cmp.alternatives.length).toBe(2);
    const keptClone = cmp.alternatives.find((a) => a.routeId === "r-clone-1");
    expect(keptClone?.deduplicatedCount).toBe(1);
    expect(keptClone?.collapsedRouteIds).toEqual(["r-clone-2"]);
    expect(cmp.alternatives.some((a) => a.routeId === "r-distinct-geom")).toBe(true);
  });
});

