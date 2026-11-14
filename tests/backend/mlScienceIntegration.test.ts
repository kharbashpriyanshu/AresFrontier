import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mlEngineAdapter } from "../../backend/src/services/ml/mlEngineAdapter.js";
import { scienceEngineAdapter } from "../../backend/src/services/science/scienceEngineAdapter.js";
import { routeOptimizationEngine } from "../../backend/src/services/intelligence/routeOptimizationEngine.js";
import { scienceObjectiveEngine } from "../../backend/src/services/science/scienceObjectiveEngine.js";
import { MarsRoute, CopilotMissionPlanRequest } from "../../backend/src/types/index.js";

describe("WS2 / Batch 1 — External ML & Science Intelligence Services Integration", () => {
  const sampleRoute: MarsRoute = {
    id: "route-jezero-test",
    name: "Jezero Delta Front Sample Path",
    points: [
      {
        id: "p-start",
        label: "Ingress Landing Hub",
        coordinate: { latitude: 18.38, longitude: 77.58 },
        type: "start",
      },
      {
        id: "p-science",
        label: "Delta Scarp Outcrop",
        coordinate: { latitude: 18.41, longitude: 77.62 },
        type: "science",
        targetId: "tgt-jezero-delta",
      },
      {
        id: "p-dest",
        label: "Sample Cache Egress",
        coordinate: { latitude: 18.43, longitude: 77.65 },
        type: "destination",
      },
    ],
    segments: [
      {
        id: "seg-1",
        fromPointId: "p-start",
        toPointId: "p-science",
        distanceMeters: 2400,
        averageSlopeDegrees: 6.5,
        difficulty: "moderate",
      },
      {
        id: "seg-2",
        fromPointId: "p-science",
        toPointId: "p-dest",
        distanceMeters: 1800,
        averageSlopeDegrees: 4.2,
        difficulty: "low",
      },
    ],
    totalDistanceKm: 4.2,
    estimatedDurationMinutes: 110,
    maxSlopeDegrees: 11.5,
    elevationGainM: 45,
    elevationLossM: 20,
    overallDifficulty: "moderate",
  };

  describe("ML Engine Adapter (Person 3 Contract)", () => {
    it("falls back to deterministic baseline heuristic model when external service is disabled", async () => {
      mlEngineAdapter.setEnabled(false);
      const assessment = await mlEngineAdapter.assessMission(sampleRoute, {
        maxDurationMinutes: 180,
        astronautSkillLevel: "expert",
      });

      expect(assessment).toBeDefined();
      expect(assessment.scoringSource).toBe("rule-based");
      expect(assessment.safetyScore).toBeGreaterThanOrEqual(10);
      expect(assessment.safetyScore).toBeLessThanOrEqual(100);
      expect(assessment.scienceScore).toBeGreaterThanOrEqual(15);
      expect(assessment.accessibilityScore).toBeGreaterThanOrEqual(15);
      expect(assessment.overallScore).toBeGreaterThanOrEqual(10);
      expect(assessment.confidence).toBeGreaterThan(0.7);
      expect(assessment.missionStatus).toBe("MISSION FEASIBLE");
      expect(assessment.modelIdentifier).toContain("Baseline-Planetary-EVA");
    });

    it("evaluates constraint-exceeded status when traverse duration breaches life-support limits", async () => {
      mlEngineAdapter.setEnabled(false);
      const assessment = await mlEngineAdapter.assessMission(sampleRoute, {
        maxDurationMinutes: 90, // Route takes 110 min -> constraint breached
      });

      expect(assessment.missionStatus).toBe("MISSION CONSTRAINT EXCEEDED");
      expect(assessment.warnings.some((w) => w.includes("life-support"))).toBe(true);
      expect(assessment.safetyScore).toBeLessThan(75);
    });

    it("evaluates high slope penalty when traverse slope breaches safety threshold", async () => {
      mlEngineAdapter.setEnabled(false);
      const steepRoute: MarsRoute = {
        ...sampleRoute,
        maxSlopeDegrees: 23.5, // Breaches 20° ceiling
      };

      const assessment = await mlEngineAdapter.assessMission(steepRoute, {
        maxDurationMinutes: 180,
      });

      expect(assessment.missionStatus).toBe("MISSION CONSTRAINT EXCEEDED");
      expect(assessment.warnings.some((w) => w.includes("High slope angle"))).toBe(true);
    });

    it("predicts terrain hazard class, slip probability, and factors via adapter", async () => {
      mlEngineAdapter.setEnabled(false);
      const hazard = await mlEngineAdapter.predictTerrainHazard({
        slopeDegrees: 8.5,
        roughnessIndex: 0.25,
        rockAbundancePct: 8.0,
      });

      expect(hazard).toBeDefined();
      expect(hazard.hazard_class).toBe("LOW");
      expect(hazard.hazard_score).toBeGreaterThanOrEqual(0);
      expect(hazard.slip_risk_probability).toBeLessThan(0.5);
      expect(hazard.source).toBe("rule-based");
    });
  });

  describe("Science Engine Adapter (Person 4 Contract)", () => {
    it("returns rich geological and mineralogical assessment for Jezero Crater", async () => {
      scienceEngineAdapter.setEnabled(false);
      const assessment = await scienceEngineAdapter.getScientificAssessment({
        latitude: 18.44,
        longitude: 77.45,
      });

      expect(assessment.scientificValue).toBe("high");
      expect(assessment.geologicalContext).toContain("Jezero Crater");
      expect(assessment.mineralContext).toContain("Mg-smectite");
      expect(assessment.thermalContext).toBeDefined();
      expect(assessment.explanation).toContain("biosignature preservation");
      expect(assessment.sources.length).toBeGreaterThanOrEqual(2);
      expect(assessment.samplePriorities).toContain("Delta bottomset mudstone");
      expect(assessment.geologicalEpoch).toBe("Noachian-Hesperian Transition");
    });

    it("returns rich sedimentary transition assessment for Gale Crater", async () => {
      scienceEngineAdapter.setEnabled(false);
      const assessment = await scienceEngineAdapter.getScientificAssessment({
        latitude: -4.6,
        longitude: 137.4,
      });

      expect(assessment.scientificValue).toBe("high");
      expect(assessment.geologicalContext).toContain("Aeolis Mons");
      expect(assessment.mineralContext).toContain("sulfate");
      expect(assessment.sources.some((s) => s.includes("MSL CheMin"))).toBe(true);
      expect(assessment.samplePriorities).toContain("Murray formation mudstone");
      expect(assessment.geologicalEpoch).toBe("Hesperian");
    });

    it("evaluates candidate science target with MEPAG and biosignature criteria", async () => {
      scienceEngineAdapter.setEnabled(false);
      const targetEval = await scienceEngineAdapter.evaluateTarget({
        targetId: "tgt-delta-jezero",
        name: "Western Delta Scarp",
        coordinate: { latitude: 18.42, longitude: 77.58 },
        targetType: "delta",
        description: "Lacustrine mudstone outcrop rich in Mg-smectite",
      });

      expect(targetEval.scientific_yield_score).toBeGreaterThanOrEqual(85);
      expect(targetEval.biosignature_preservation_potential).toBe("HIGH");
      expect(targetEval.sample_return_priority).toBe("PRIORITY_1");
      expect(targetEval.mepag_goals_supported.some((g) => g.includes("Goal I"))).toBe(true);
    });

    it("assesses polar shallow subsurface water-ice vs equatorial desiccated zones", async () => {
      scienceEngineAdapter.setEnabled(false);
      // High-latitude polar location (>55°)
      const polarIce = await scienceEngineAdapter.assessIceStability({
        latitude: 65.0,
        longitude: 120.0,
      });
      expect(polarIce.subsurface_ice_probability).toBeGreaterThan(0.7);
      expect(polarIce.ice_stability_zone).toBe("STABLE_SHALLOW");
      expect(polarIce.isru_accessibility_rating).toBe("EXCELLENT");

      // Equatorial location (<35°)
      const equatorialIce = await scienceEngineAdapter.assessIceStability({
        latitude: 10.0,
        longitude: -40.0,
      });
      expect(equatorialIce.subsurface_ice_probability).toBeLessThan(0.15);
      expect(equatorialIce.ice_stability_zone).toBe("UNSTABLE");
      expect(equatorialIce.isru_accessibility_rating).toBe("NON_VIABLE");
    });
  });

  describe("Subsystem Integration with Planning & State", () => {
    it("routeOptimizationEngine incorporates ML assessment and outputs valid candidates with provenance", async () => {
      const request: CopilotMissionPlanRequest = {
        startCoordinate: { latitude: 18.38, longitude: 77.58 },
        destinationCoordinate: { latitude: 18.42, longitude: 77.62 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        maxDurationMinutes: 180,
      };

      const candidates = await routeOptimizationEngine.generateCandidates(request);
      expect(candidates.length).toBe(4);

      for (const cand of candidates) {
        expect(cand.overallScore).toBeGreaterThanOrEqual(5);
        expect(cand.overallScore).toBeLessThanOrEqual(100);
        expect(cand.provenance).toBeDefined();
        expect(cand.provenance.sourceType).toBe("DERIVED");
        expect(cand.provenance.processingMethod).toContain("Factorized Science Engine");
        expect(cand.multiObjectiveScore.safety).toBeDefined();
        expect(cand.multiObjectiveScore.science).toBeDefined();
      }
    });

    it("scienceObjectiveEngine assesses target geology through scienceEngineAdapter", async () => {
      const target = {
        id: "tgt-test-jezero",
        name: "Jezero Delta Front",
        coordinate: { latitude: 18.44, longitude: 77.45 },
        scientificValue: "high" as const,
        description: "Fluvial delta deposits",
        targetType: "delta",
        primaryCategory: "paleohydrology",
      };

      const assessment = await scienceObjectiveEngine.assessTargetGeology(target);
      expect(assessment).toBeDefined();
      expect(assessment.scientificValue).toBe("high");
      expect(assessment.geologicalContext).toContain("Jezero");
    });
  });
});
