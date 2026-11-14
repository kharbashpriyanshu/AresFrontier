import { describe, it, expect } from "vitest";
import { scienceObjectiveEngine } from "../../backend/src/services/science/scienceObjectiveEngine.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../../backend/src/services/nasa/adapters/benchmarkData.js";

describe("Science Objective Intelligence Engine", () => {
  it("provides 6 well-defined MEPAG planetary exploration objectives", () => {
    const objectives = scienceObjectiveEngine.getObjectives();
    expect(objectives.length).toBe(6);

    const waterObj = scienceObjectiveEngine.getObjective("ANCIENT_WATER_ACTIVITY");
    expect(waterObj.name).toContain("Ancient Fluvial & Lacustrine");
    expect(waterObj.preferredCategories).toContain("paleohydrology");
  });

  it("scores delta and inflow targets highly under Ancient Water Activity objective", () => {
    const kodiakButte = VERIFIED_NASA_SCIENCE_TARGETS.find((t) => t.id === "tgt-kodiak-butte")!;
    const seitahOlivine = VERIFIED_NASA_SCIENCE_TARGETS.find((t) => t.id === "tgt-seitah-olivine")!;

    const waterObj = scienceObjectiveEngine.getObjective("ANCIENT_WATER_ACTIVITY");
    const kodiakRel = scienceObjectiveEngine.evaluateTargetRelevance(kodiakButte, waterObj);
    const seitahRel = scienceObjectiveEngine.evaluateTargetRelevance(seitahOlivine, waterObj);

    expect(kodiakRel).toBeGreaterThan(0.7);
    expect(kodiakRel).toBeGreaterThan(seitahRel);
  });

  it("calculates multi-target route science yield score", () => {
    const targets = VERIFIED_NASA_SCIENCE_TARGETS.slice(0, 2);
    const scoreResult = scienceObjectiveEngine.calculateRouteScienceScore(targets, "ANCIENT_WATER_ACTIVITY");

    expect(scoreResult.score).toBeGreaterThanOrEqual(50);
    expect(scoreResult.score).toBeLessThanOrEqual(100);
    expect(scoreResult.targetEvaluations.length).toBe(2);
  });
});
