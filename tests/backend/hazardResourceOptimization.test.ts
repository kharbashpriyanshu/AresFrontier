import { describe, it, expect } from "vitest";
import { hazardEngine } from "../../backend/src/services/hazard/hazardEngine.js";
import { CommunicationRouteEvaluator } from "../../backend/src/services/comms/communicationRouteEvaluator.js";
import { ResourceModelingEngine } from "../../backend/src/services/operations/resourceModelingEngine.js";
import { routeOptimizationEngine } from "../../backend/src/services/intelligence/routeOptimizationEngine.js";
import { missionReasoningService } from "../../backend/src/services/intelligence/missionReasoningService.js";
import { MarsRoute } from "../../backend/src/types/index.js";

describe("Hazard Intelligence, Resource Management & Multi-Objective Route Optimization", () => {
  const dummyRoute: MarsRoute = {
    id: "test-route-1",
    name: "Kodiak Traverse Corridor",
    points: [
      { id: "p1", label: "Ingress Point", coordinate: { latitude: 18.4447, longitude: 77.4508 }, type: "start" },
      { id: "p2", label: "Kodiak Fore-slope", coordinate: { latitude: 18.452, longitude: 77.46 }, type: "waypoint" },
      { id: "p3", label: "Delta Apex", coordinate: { latitude: 18.46, longitude: 77.47 }, type: "destination" },
    ],
    segments: [
      {
        id: "s1",
        start: { latitude: 18.4447, longitude: 77.4508 },
        end: { latitude: 18.452, longitude: 77.46 },
        distanceKm: 1.5,
        elevationGainM: 30,
        elevationLossM: 5,
        averageSlopeDegrees: 8.5,
        difficulty: "moderate",
        estimatedMinutes: 35,
        hazards: [],
      },
      {
        id: "s2",
        start: { latitude: 18.452, longitude: 77.46 },
        end: { latitude: 18.46, longitude: 77.47 },
        distanceKm: 1.8,
        elevationGainM: 50,
        elevationLossM: 10,
        averageSlopeDegrees: 12.0,
        difficulty: "moderate",
        estimatedMinutes: 45,
        hazards: [],
      },
    ],
    totalDistanceKm: 3.3,
    estimatedDurationMinutes: 80,
    elevationGainM: 80,
    elevationLossM: 15,
    maxSlopeDegrees: 14.5,
    averageSlopeDegrees: 10.25,
    overallDifficulty: "moderate",
  };

  describe("Part 1: Expanded Hazard Intelligence", () => {
    it("detects multi-domain hazards across terrain, comms, resources, and mission constraints", () => {
      const assessment = hazardEngine.assessRouteHazards(dummyRoute, {
        agentType: "ASTRONAUT",
        baseCoordinate: { latitude: 18.20, longitude: 77.20 }, // Far behind ridge (>15 km) with no LOS
        simulationTimeMinutes: 10, // Outside MRO orbiter pass window (pass is 42-62 min)
        initialBatteryPercent: 18, // < 20% triggers LOW_BATTERY_RESERVE
        initialOxygenMinutes: 90, // 80 min + 30 min margin = 110 min required > 90 min triggers INSUFFICIENT_OXYGEN
        requireContinuousCommunication: true, // triggers COMMUNICATION_BLACKOUT
        maxDurationMinutes: 60, // Route takes 80 min, triggers MISSION_DEADLINE_BREACH
        sampleTubesAvailable: 0,
      });

      expect(assessment.hazards.length).toBeGreaterThanOrEqual(3);
      const categories = assessment.hazards.map((h) => h.category);
      expect(categories).toContain("RESOURCE");
      expect(categories).toContain("COMMUNICATION");
      expect(categories).toContain("MISSION_CONSTRAINT");

      // Verify standardized hazard contract attributes
      for (const h of assessment.hazards) {
        expect(h.id).toBeDefined();
        expect(h.category).toBeDefined();
        expect(h.severity).toBeDefined();
        expect(h.location).toBeDefined();
        expect(typeof h.probability).toBe("number");
        expect(h.probability).toBeGreaterThanOrEqual(0);
        expect(h.probability).toBeLessThanOrEqual(1);
        expect(h.impactDescription).toBeDefined();
        expect(h.detectionSource).toBeDefined();
        expect(h.provenanceClassification).toBeDefined();
        expect(h.recommendedMitigation).toBeDefined();
      }
    });

    it("identifies terrain hazards on steep slopes and scarps", () => {
      const steepRoute: MarsRoute = {
        ...dummyRoute,
        maxSlopeDegrees: 24.5, // > 22° triggers steep slope & scarp hazards
        segments: [
          {
            ...dummyRoute.segments[0],
            averageSlopeDegrees: 23.0,
          },
        ],
      };

      const assessment = hazardEngine.assessRouteHazards(steepRoute, {
        agentType: "ASTRONAUT",
      });

      const terrainHazards = assessment.hazards.filter((h) => h.category === "TERRAIN" || h.category === "GEOLOGICAL");
      expect(terrainHazards.length).toBeGreaterThanOrEqual(1);
      const types = terrainHazards.map((h) => h.type);
      expect(types.some((t) => t === "STEEP_SLOPE" || t === "SCARP" || t === "EXTREME_SLOPE")).toBe(true);
    });
  });

  describe("Part 2 & 3: Communication-Aware Route Evaluation", () => {
    it("computes line-of-sight and orbiter coverage metrics", () => {
      const commMetrics = CommunicationRouteEvaluator.evaluateRouteCommunication(
        dummyRoute,
        { latitude: 18.38, longitude: 77.58 },
        48,
        false
      );

      expect(commMetrics.losCoveragePercent).toBeGreaterThanOrEqual(0);
      expect(commMetrics.losCoveragePercent).toBeLessThanOrEqual(100);
      expect(commMetrics.orbiterCoveragePercent).toBeGreaterThanOrEqual(0);
      expect(commMetrics.orbiterCoveragePercent).toBeLessThanOrEqual(100);
      expect(commMetrics.combinedCoveragePercent).toBeGreaterThanOrEqual(0);
      expect(commMetrics.combinedCoveragePercent).toBeLessThanOrEqual(100);
      expect(commMetrics.communicationScore).toBeGreaterThanOrEqual(0);
      expect(commMetrics.communicationScore).toBeLessThanOrEqual(100);
      expect(typeof commMetrics.commContinuitySatisfied).toBe("boolean");
    });

    it("detects communication continuity breach when continuous comms required and blackout occurs", () => {
      const commMetrics = CommunicationRouteEvaluator.evaluateRouteCommunication(
        dummyRoute,
        { latitude: 18.38, longitude: 77.58 },
        48,
        true
      );

      if (commMetrics.maxBlackoutDurationMin > 0) {
        expect(commMetrics.commContinuitySatisfied).toBe(false);
      }
    });
  });

  describe("Part 2 & 5: Expanded Resource Management Modeling", () => {
    it("computes physical energy expenditure, battery SoC progression and sample tube capacity", () => {
      const resourceProfile = ResourceModelingEngine.evaluateRouteResources(dummyRoute, {
        agentType: "ROVER",
        initialBatteryPercent: 90,
      });

      expect(resourceProfile.energyExpenditureWh).toBeGreaterThan(0);
      expect(resourceProfile.projectedRemainingPercent).toBeLessThan(90);
      expect(resourceProfile.batteryMarginPercent).toBeDefined();
      expect(resourceProfile.sampleTubesAvailable).toBeGreaterThan(0);
      expect(resourceProfile.emergencyReturnFeasible).toBe(true);
    });

    it("verifies emergency return feasibility and detects battery reserve violation", () => {
      // Starting with very low battery (22%) on a 3.3 km traverse
      const resourceProfile = ResourceModelingEngine.evaluateRouteResources(dummyRoute, {
        agentType: "ROVER",
        initialBatteryPercent: 22,
        batteryCapacityWh: 1200,
      });

      // 3.3 km at ~100 Wh/km = ~330 Wh = ~27.5% capacity drop, so 22% - 27.5% < 20% minimum reserve
      expect(resourceProfile.projectedRemainingPercent).toBeLessThan(20);
      expect(resourceProfile.batteryMarginPercent).toBeLessThan(0);
      expect(resourceProfile.feasible).toBe(false);
      expect(resourceProfile.hardConstraintViolations.some((v) => v.toLowerCase().includes("battery"))).toBe(true);
    });

    it("models astronaut oxygen consumption with 30-min life-support reserve margin", () => {
      const resourceProfile = ResourceModelingEngine.evaluateRouteResources(dummyRoute, {
        agentType: "ASTRONAUT",
        initialOxygenMinutes: 120, // 80 min duration + 30 min reserve = 110 min required
      });

      expect(resourceProfile.oxygenRemainingMin).toBeDefined();
      expect(resourceProfile.oxygenRemainingMin!).toBeLessThan(120);
    });
  });

  describe("Part 4 & 6: Multi-Objective Route Optimization & Constraint Rejection", () => {
    it("synthesizes 4 distinct profiles and integrates multi-objective scores", async () => {
      const candidates = await routeOptimizationEngine.generateCandidates({
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.46, longitude: 77.47 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        maxDurationMinutes: 180,
        initialBatteryPercent: 85,
      });

      expect(candidates.length).toBe(4);
      for (const cand of candidates) {
        expect(cand.multiObjectiveScore).toBeDefined();
        expect(cand.communicationScore).toBeDefined();
        expect(cand.energyWhConsumed).toBeDefined();
        expect(cand.projectedBatteryPercent).toBeDefined();
        expect(cand.tradeoffExplanation).toBeDefined();
        expect(typeof cand.feasible).toBe("boolean");
      }
    });

    it("enforces hard constraint rejection when starting battery is insufficient (<20% reserve)", async () => {
      // Low starting battery: 22%
      const candidates = await routeOptimizationEngine.generateCandidates({
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.465, longitude: 77.48 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        maxDurationMinutes: 180,
        initialBatteryPercent: 22, // Traversing 3+ km drops battery below 20% reserve
      });

      // Candidates that breach the battery reserve floor must have feasible=false and not be Pareto-efficient
      const batteryViolations = candidates.filter(
        (c) => c.hardConstraintViolations && c.hardConstraintViolations.some((v) => v.toLowerCase().includes("battery"))
      );
      expect(batteryViolations.length).toBeGreaterThan(0);
      for (const rejected of batteryViolations) {
        expect(rejected.feasible).toBe(false);
        // Hard constraint violation MUST disqualify candidate from being Pareto-efficient
        expect(rejected.multiObjectiveScore?.isParetoEfficient).toBe(false);
      }
    });

    it("enforces walking slope ceiling constraint for human EVA (max 20° slope)", async () => {
      const candidates = await routeOptimizationEngine.generateCandidates({
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.46, longitude: 77.47 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        agentType: "ASTRONAUT",
      });

      for (const cand of candidates) {
        if (cand.route.maxSlopeDegrees > 20.0) {
          expect(cand.feasible).toBe(false);
        }
      }
    });

    it("generates structured explainable mission recommendation with trade-off justification", async () => {
      const candidates = await routeOptimizationEngine.generateCandidates({
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.46, longitude: 77.47 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        maxDurationMinutes: 180,
        initialBatteryPercent: 90,
      });

      const recommendation = missionReasoningService.generateRecommendation(
        candidates,
        "ANCIENT_WATER_ACTIVITY",
        180
      );

      expect(recommendation.recommendedRouteId).toBeDefined();
      expect(recommendation.decision).toContain("Recommend");
      expect(recommendation.reasoning.length).toBeGreaterThan(0);
      expect(recommendation.majorRisks).toBeDefined();
      expect(recommendation.scienceOpportunities).toBeDefined();
      expect(recommendation.auditHash).toBeDefined();
      expect(recommendation.provenance).toBeDefined();
    });
  });
});
