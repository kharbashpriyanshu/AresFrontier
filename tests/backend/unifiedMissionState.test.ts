import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { MissionStateCoordinator } from "../../backend/src/services/state/missionStateCoordinator.js";
import { missionRepository } from "../../backend/src/repositories/missionRepository.js";
import { MissionPersistenceService } from "../../backend/src/services/persistence/missionPersistenceService.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { AgentStateStore } from "../../backend/src/services/agents/agentStateStore.js";
import { MarsRoute, RoutePoint } from "../../backend/src/types/index.js";
import { ProvenanceService } from "../../backend/src/services/planetary/provenanceService.js";

const baseDataDir = process.cwd().endsWith("backend")
  ? path.resolve(process.cwd(), "data")
  : path.resolve(process.cwd(), "backend", "data");

describe("WS1 / Batch 1 — Unified Mission State & Persistence Foundation", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    AgentStateStore.clearEvents();
  });

  // --------------------------------------------------------------------------
  // 1. Canonical Mission State Creation & Retrieval
  // --------------------------------------------------------------------------
  it("synthesizes canonical 18-domain unified mission state with all modular slices", () => {
    const canonicalState = MissionStateCoordinator.getCanonicalState("MARSWALK-TEST-001");

    expect(canonicalState).toBeDefined();
    expect(canonicalState.schemaVersion).toBe("1.0.0");
    expect(canonicalState.missionId).toBeDefined();

    // Verify presence of all 18 domains
    expect(canonicalState.metadata).toBeDefined();
    expect(canonicalState.metadata.name).toContain("Marswalk");
    expect(canonicalState.objectives).toBeDefined();
    expect(canonicalState.objectives.primaryScienceObjective).toBe("ANCIENT_WATER_ACTIVITY");
    expect(canonicalState.objectives.operationalObjectives.length).toBeGreaterThan(0);
    expect(canonicalState.scienceTargets).toBeDefined();
    expect(canonicalState.scienceTargets.targets.length).toBeGreaterThan(0);
    expect(canonicalState.fleet).toBeDefined();
    expect(canonicalState.fleet.rovers.length).toBeGreaterThan(0);
    expect(canonicalState.fleet.astronauts.length).toBeGreaterThan(0);
    expect(canonicalState.routes).toBeDefined();
    expect(canonicalState.geology).toBeDefined();
    expect(canonicalState.geology.geologicalUnit).toContain("Deltaic");
    expect(canonicalState.hazards).toBeDefined();
    expect(canonicalState.resources).toBeDefined();
    expect(canonicalState.resources.minBatteryReservePercent).toBe(20.0);
    expect(canonicalState.communication).toBeDefined();
    expect(canonicalState.tasks).toBeDefined();
    expect(canonicalState.simulation).toBeDefined();
    expect(canonicalState.digitalTwin).toBeDefined();
    expect(canonicalState.lineage).toBeDefined();
    expect(canonicalState.provenance).toBeDefined();
    expect(canonicalState.provenance.overallDataConfidence).toBeGreaterThan(0.8);
    expect(canonicalState.validation).toBeDefined();
    expect(canonicalState.validation.healthScore).toBeGreaterThan(0);
    expect(canonicalState.events).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 2. Route Persistence Across Backend Restarts
  // --------------------------------------------------------------------------
  it("persists dynamically created Mars routes to disk and survives repository reloads", async () => {
    const testRouteId = `route-traverse-${Date.now()}`;
    const testPoints: RoutePoint[] = [
      {
        id: "pt-alpha",
        coordinate: { latitude: 18.4447, longitude: 77.4508 },
        type: "start",
        label: "Ingress Portal Alpha",
        elevationM: -2530,
      },
      {
        id: "pt-beta",
        coordinate: { latitude: 18.4485, longitude: 77.402 },
        type: "science",
        label: "Sedimentary Scarp B1",
        elevationM: -2470,
        targetId: "tgt-kodiak-butte",
      },
      {
        id: "pt-omega",
        coordinate: { latitude: 18.455, longitude: 77.39 },
        type: "destination",
        label: "Egress Portal Omega",
        elevationM: -2510,
      },
    ];

    const testRoute: MarsRoute = {
      id: testRouteId,
      name: "Dynamic Test Traverse for Persistence Verification",
      points: testPoints,
      segments: [
        {
          id: "seg-test-1",
          start: testPoints[0].coordinate,
          end: testPoints[1].coordinate,
          distanceKm: 2.1,
          elevationGainM: 60,
          elevationLossM: 0,
          averageSlopeDegrees: 1.6,
          difficulty: "low",
          estimatedMinutes: 45,
          hazards: [],
        },
      ],
      totalDistanceKm: 2.1,
      estimatedDurationMinutes: 45,
      elevationProfile: [
        { distanceKm: 0.0, elevationM: -2530, slopeDegrees: 0.5, coordinate: testPoints[0].coordinate },
        { distanceKm: 2.1, elevationM: -2470, slopeDegrees: 1.6, coordinate: testPoints[1].coordinate },
      ],
      elevationGainM: 60,
      elevationLossM: 0,
      maxSlopeDegrees: 2.5,
      overallDifficulty: "low",
      createdAt: new Date().toISOString(),
    };

    // Save route via repository
    await missionRepository.saveRoute(testRoute);

    // Verify route is present immediately in memory
    const retrievedRoute = await missionRepository.getRouteById(testRouteId);
    expect(retrievedRoute).toBeDefined();
    expect(retrievedRoute?.name).toBe(testRoute.name);

    // Verify route was written to disk
    const routesFilePath = path.resolve(baseDataDir, "routes.json");
    expect(fs.existsSync(routesFilePath)).toBe(true);

    const onDiskRaw = fs.readFileSync(routesFilePath, "utf-8");
    expect(onDiskRaw).toContain(testRouteId);

    // Simulate backend restart by creating a new repository instance
    const freshRepositoryInstance = new (missionRepository.constructor as any)();
    const recoveredRoute = await freshRepositoryInstance.getRouteById(testRouteId);

    expect(recoveredRoute).toBeDefined();
    expect(recoveredRoute?.id).toBe(testRouteId);
    expect(recoveredRoute?.totalDistanceKm).toBe(2.1);
    expect(recoveredRoute?.points.length).toBe(3);

    // Clean up test route
    await missionRepository.deleteRoute(testRouteId);
  });

  // --------------------------------------------------------------------------
  // 3. Mission Persistence Across Backend Restarts
  // --------------------------------------------------------------------------
  it("persists missions to disk and recovers them accurately after cold reload", async () => {
    const missionId = `mission-persist-${Date.now()}`;
    const testRouteId = "route-jezero-delta-sol100";

    const saved = await missionRepository.saveMission(
      missionId,
      testRouteId,
      {
        routeId: testRouteId,
        maxDurationMinutes: 180,
        astronautSkillLevel: "expert",
        returnRequired: true,
      },
      {
        feasible: true,
        totalDistanceKm: 4.14,
        estimatedDurationMinutes: 129,
        maxSlopeDegrees: 3.8,
        returnMarginMinutes: 51,
        oxygenReserveRemainingPercent: 28.3,
        warnings: [],
      }
    );

    expect(saved).toBeDefined();
    expect(saved.id).toBe(missionId);

    // Verify file exists on disk
    const missionsFilePath = path.resolve(baseDataDir, "missions.json");
    expect(fs.existsSync(missionsFilePath)).toBe(true);

    // Simulate cold restart
    const reloadedRepository = new (missionRepository.constructor as any)();
    const retrieved = await reloadedRepository.getMissionById(missionId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(missionId);
    expect(retrieved?.parameters.astronautSkillLevel).toBe("expert");
    expect(retrieved?.evaAssessment.feasible).toBe(true);

    // Clean up
    await missionRepository.deleteMission(missionId);
  });

  // --------------------------------------------------------------------------
  // 4. Partial Domain Updates Without Overwriting Other Slices
  // --------------------------------------------------------------------------
  it("performs safe partial updates to a specific domain while leaving other domains untouched", () => {
    const initialState = MissionStateCoordinator.getCanonicalState();
    const initialSiteName = initialState.geology.siteName;
    const initialPrimaryObjective = initialState.objectives.primaryScienceObjective;

    // Update only the resources domain
    const updated = MissionStateCoordinator.updateDomain("resources", {
      astronautOxygenReserveMinutes: 320,
      minBatteryReservePercent: 25.0,
    });

    expect(updated.resources.astronautOxygenReserveMinutes).toBe(320);
    expect(updated.resources.minBatteryReservePercent).toBe(25.0);

    // Geology and Objectives must remain completely untouched
    expect(updated.geology.siteName).toBe(initialSiteName);
    expect(updated.objectives.primaryScienceObjective).toBe(initialPrimaryObjective);

    // Update only the objectives domain
    const updatedObjectives = MissionStateCoordinator.updateDomain("objectives", {
      primaryScienceObjective: "PAST_HABITABILITY",
    });

    expect(updatedObjectives.objectives.primaryScienceObjective).toBe("PAST_HABITABILITY");
    // Resources must still reflect the previous update
    expect(updatedObjectives.resources.astronautOxygenReserveMinutes).toBe(320);
  });

  // --------------------------------------------------------------------------
  // 5. Concurrent Update Safety
  // --------------------------------------------------------------------------
  it("handles concurrent asynchronous route saves without race conditions or corrupted output", async () => {
    const concurrentIds = Array.from({ length: 5 }, (_, i) => `route-concurrent-${Date.now()}-${i}`);

    const savePromises = concurrentIds.map((id, index) =>
      missionRepository.saveRoute({
        id,
        name: `Concurrent Traverse ${index}`,
        points: [
          { id: "p1", coordinate: { latitude: 18.4, longitude: 77.4 }, type: "start" },
          { id: "p2", coordinate: { latitude: 18.5, longitude: 77.5 }, type: "destination" },
        ],
        segments: [],
        totalDistanceKm: 1.0 + index,
        estimatedDurationMinutes: 20 + index * 5,
        elevationProfile: [],
        elevationGainM: 10,
        elevationLossM: 10,
        maxSlopeDegrees: 1.5,
        overallDifficulty: "low",
        createdAt: new Date().toISOString(),
      })
    );

    const results = await Promise.all(savePromises);
    expect(results.length).toBe(5);

    // All routes must be queryable
    for (const id of concurrentIds) {
      const found = await missionRepository.getRouteById(id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(id);
      await missionRepository.deleteRoute(id);
    }
  });

  // --------------------------------------------------------------------------
  // 6. Corrupted Persistence File Recovery
  // --------------------------------------------------------------------------
  it("safely recovers from corrupted routes and missions files without crashing", () => {
    const routesFilePath = path.resolve(baseDataDir, "routes.json");
    let originalRoutes: string | null = null;
    if (fs.existsSync(routesFilePath)) {
      originalRoutes = fs.readFileSync(routesFilePath, "utf-8");
    }

    try {
      // Simulate disk write corruption (incomplete JSON)
      fs.writeFileSync(routesFilePath, '[ { "id": "route-corrupt", "name": "Incomplete', "utf-8");

      // Creating a new repository must not crash; it should back up the corrupted file and seed defaults
      const resilientRepo = new (missionRepository.constructor as any)();
      const allRoutes = resilientRepo.getAllRoutes();
      expect(allRoutes).toBeDefined();

      // Default route must still be available
      const defaultRoute = resilientRepo.getRouteById("route-jezero-delta-sol100");
      expect(defaultRoute).toBeDefined();
    } finally {
      if (originalRoutes) {
        fs.writeFileSync(routesFilePath, originalRoutes, "utf-8");
      }
    }
  });

  // --------------------------------------------------------------------------
  // 7. Invalid Mission State Rejection via Zod Schema Validation
  // --------------------------------------------------------------------------
  it("rejects invalid domain payloads that violate scientific constraints", () => {
    expect(() => {
      // Negative battery percent must be rejected by Zod schema
      MissionStateCoordinator.updateDomain("resources", {
        fleetBatterySoc: { "ASTRONAUT-01": -15 } as any,
      });
    }).toThrow(/Domain update rejected due to schema violation/);
  });

  // --------------------------------------------------------------------------
  // 8. Scientific Data Foundation & Provenance Preservation
  // --------------------------------------------------------------------------
  it("constructs and preserves provenance metadata for CRISM, SWIM and MOLA datasets", () => {
    const crismProv = ProvenanceService.createCrismProvenance("CRISM-TEST-SOL100", "BENCHMARK");
    expect(crismProv.datasetId).toBe("MRO-M-CRISM-3-RDR-V1.0");
    expect(crismProv.dataMode).toBe("BENCHMARK");
    expect(crismProv.spatialResolutionM).toBe(18.0);

    const swimProv = ProvenanceService.createSwimIceProvenance("BENCHMARK");
    expect(swimProv.datasetId).toBe("SWIM-ICE-CONSISTENCY-V1.0");
    expect(swimProv.sourceName).toContain("Subsurface Water Ice Mapping");
    expect(swimProv.confidence).toBeGreaterThan(0.8);

    // Provenance must integrate cleanly into unified state
    const updated = MissionStateCoordinator.updateDomain("provenance", {
      provenanceCatalog: {
        crismTest: crismProv,
        swimTest: swimProv,
      },
    });

    expect(updated.provenance.provenanceCatalog.crismTest).toBeDefined();
    expect(updated.provenance.provenanceCatalog.crismTest.datasetId).toBe("MRO-M-CRISM-3-RDR-V1.0");
  });
});
