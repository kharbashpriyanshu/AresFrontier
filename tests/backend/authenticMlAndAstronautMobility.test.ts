import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { mlEngineAdapter } from "../../backend/src/services/ml/mlEngineAdapter.js";
import { microTerrainService } from "../../backend/src/services/terrain/microTerrainService.js";
import { astronautMobilityEngine } from "../../backend/src/services/astronaut/astronautMobilityEngine.js";

describe("Milestone 3 — Authentic ML, Micro-Terrain Obstacles & Astronaut Mobility (Items 14 - 19)", () => {
  const jezeroCoord = { latitude: 18.4447, longitude: 77.4508 };

  // --------------------------------------------------------------------------
  // Items 14 & 15: Authentic ML Models & Real Mars Rover Validation
  // --------------------------------------------------------------------------
  it("Items 14 & 15: Exposes empirical ML validation metrics cross-validated on real rover logs", () => {
    const metrics = mlEngineAdapter.getEmpiricalValidationMetrics();
    expect(metrics.length).toBeGreaterThanOrEqual(2);

    const hazardModel = metrics.find((m) => m.modelName.includes("RandomForest"))!;
    expect(hazardModel.accuracy).toBeGreaterThan(0.90);
    expect(hazardModel.sampleCount).toBeGreaterThanOrEqual(3000);
    expect(hazardModel.empiricalValidationSources.some((s) => s.includes("Jezero Séítah"))).toBe(true);
    expect(hazardModel.empiricalValidationSources.some((s) => s.includes("MSL Curiosity"))).toBe(true);

    const riskModel = metrics.find((m) => m.modelName.includes("GradientBoosting"))!;
    expect(riskModel.r2Score).toBeGreaterThan(0.85);
  });

  // --------------------------------------------------------------------------
  // Item 16: Localized Micro-Terrain & Golombek Rock Distribution
  // --------------------------------------------------------------------------
  it("Item 16: Models Golombek rock size-frequency, scarp repose margins, and regolith sinkage", async () => {
    // Flat Jezero floor
    const floorProfile = await microTerrainService.evaluateMicroTerrain(jezeroCoord, 5.0);
    expect(floorProfile.golombekRockDistribution.cumulativeRockCoverFraction).toBeGreaterThan(0);
    expect(floorProfile.golombekRockDistribution.traversabilityIndex).toBeGreaterThan(60);
    expect(floorProfile.scarpAndSlopeHazards.scarpHazardLevel).toBe("SAFE");
    expect(floorProfile.scarpAndSlopeHazards.reposeAngleMarginDegrees).toBe(29.0); // 34 - 5 = 29
    expect(floorProfile.scarpAndSlopeHazards.switchbackRecommended).toBe(false);

    // Steep scarp (24 degrees)
    const scarpProfile = await microTerrainService.evaluateMicroTerrain(jezeroCoord, 24.0);
    expect(scarpProfile.scarpAndSlopeHazards.scarpHazardLevel).toBe("HIGH_SLIP");
    expect(scarpProfile.scarpAndSlopeHazards.reposeAngleMarginDegrees).toBe(10.0); // 34 - 24 = 10
    expect(scarpProfile.scarpAndSlopeHazards.switchbackRecommended).toBe(true);

    // Eolian sand dune (low thermal inertia)
    const duneCoord = { latitude: 18.448, longitude: 77.442 }; // South Séítah
    const duneProfile = await microTerrainService.evaluateMicroTerrain(duneCoord, 8.0);
    expect(duneProfile.looseRegolithEntrapment.estimatedWheelOrBootSinkageCm).toBeGreaterThan(5.0);
  });

  // --------------------------------------------------------------------------
  // Item 17: Spacesuit Biomechanics & 0.38g Mobility
  // --------------------------------------------------------------------------
  it("Item 17: Simulates spacesuit mass (230 kg), Mars weight (855 N), and gait transitions", () => {
    // Flat traversal -> Martian loping
    const flatBio = astronautMobilityEngine.evaluateBiomechanics(3.0, "standard", 30);
    expect(flatBio.totalEarthMassKg).toBe(230.0);
    expect(flatBio.marsWeightNewtons).toBeCloseTo(855.8, 1);
    expect(flatBio.locomotionMode).toBe("MARTIAN_LOPING");
    expect(flatBio.effectiveTraversalSpeedKmH).toBeGreaterThan(2.5);

    // Steep incline -> Hopping gait
    const steepBio = astronautMobilityEngine.evaluateBiomechanics(18.0, "standard", 60);
    expect(steepBio.locomotionMode).toBe("INCLINE_HOPPING");
    expect(steepBio.metabolicExertionWatts).toBeGreaterThan(flatBio.metabolicExertionWatts);

    // Fatigue effect: 300 minutes vs 30 minutes
    const exhaustedBio = astronautMobilityEngine.evaluateBiomechanics(3.0, "standard", 300);
    expect(exhaustedBio.fatigueAccumulationIndex).toBeGreaterThan(flatBio.fatigueAccumulationIndex);
    expect(exhaustedBio.effectiveTraversalSpeedKmH).toBeLessThan(flatBio.effectiveTraversalSpeedKmH);
  });

  // --------------------------------------------------------------------------
  // Item 18: Astronaut Life-Support Consumables
  // --------------------------------------------------------------------------
  it("Item 18: Tracks O2 reserves, cooling water loop, battery power draw, and LiOH scrubber", () => {
    const consumables = astronautMobilityEngine.calculateConsumables(180, 5.0, 5.0);

    // Oxygen
    expect(consumables.oxygen.initialCapacityLiters).toBe(1200);
    expect(consumables.oxygen.consumedLiters).toBeGreaterThan(150);
    expect(consumables.oxygen.remainingLiters).toBeLessThan(1200);
    expect(consumables.oxygen.remainingMinutes).toBeGreaterThan(0);

    // Cooling water
    expect(consumables.coolingWater.remainingLiters).toBeLessThan(4.5);
    expect(consumables.coolingWater.coolingMarginMinutes).toBeGreaterThan(100);

    // Battery
    expect(consumables.batteryPower.batteryRemainingPct).toBeLessThan(100);
    expect(consumables.batteryPower.powerDrawWatts).toBeGreaterThanOrEqual(150);

    // CO2 Scrubber
    expect(consumables.carbonDioxideScrubber.saturationPct).toBeGreaterThan(0);
    expect(consumables.carbonDioxideScrubber.saturationPct).toBeLessThan(100);

    // Sample payload
    expect(consumables.sampleStorage.currentSampleMassKg).toBe(5.0);
    expect(consumables.sampleStorage.remainingCapacityKg).toBe(10.0);
  });

  // --------------------------------------------------------------------------
  // Item 19: EVA Workload & Mandatory 30-Minute NASA Return Margin
  // --------------------------------------------------------------------------
  it("Item 19: Enforces 30-min NASA return margin and calculates Point of No Return", () => {
    // Nominal 3-hour EVA (60 min outbound, 60 min return, 2 stops)
    const nominal = astronautMobilityEngine.evaluateEVAWorkload(60, 60, 2, 360);
    expect(nominal.mandatory30MinReturnBufferPreserved).toBe(true);
    expect(nominal.safeReturnFeasible).toBe(true);
    expect(nominal.marginToSafetyViolationMinutes).toBeGreaterThan(0);
    expect(nominal.pointOfNoReturnMinute).toBe(270); // 360 - (60 return + 30 buffer) = 270

    // Over-budget 6-hour EVA exceeding limits
    const overBudget = astronautMobilityEngine.evaluateEVAWorkload(150, 150, 4, 360);
    expect(overBudget.mandatory30MinReturnBufferPreserved).toBe(false);
    expect(overBudget.safeReturnFeasible).toBe(false);
    expect(overBudget.recommendations.some((r) => r.includes("CRITICAL: Mandatory 30-min return margin violated"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // REST API Endpoints Verification
  // --------------------------------------------------------------------------
  it("REST API: Serves ml-validation, micro-terrain, and astronaut-mobility endpoints", async () => {
    const mlRes = await request(app).get("/api/data/authentic/ml-validation");
    expect(mlRes.status).toBe(200);
    expect(mlRes.body.data.length).toBeGreaterThanOrEqual(2);

    const terrainRes = await request(app).get("/api/data/authentic/micro-terrain?lat=18.44&lon=77.45&slope=12");
    expect(terrainRes.status).toBe(200);
    expect(terrainRes.body.data.golombekRockDistribution.traversabilityIndex).toBeDefined();

    const mobilityRes = await request(app).get("/api/data/authentic/astronaut-mobility?slope=6&duration=180");
    expect(mobilityRes.status).toBe(200);
    expect(mobilityRes.body.data.biomechanics.marsWeightNewtons).toBeDefined();
    expect(mobilityRes.body.data.consumables.oxygen.remainingLiters).toBeDefined();
    expect(mobilityRes.body.data.workload.mandatory30MinReturnBufferPreserved).toBe(true);
  });
});
