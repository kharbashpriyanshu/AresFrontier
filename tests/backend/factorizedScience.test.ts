import { describe, it, expect } from "vitest";
import { scienceObjectiveEngine } from "../../backend/src/services/science/scienceObjectiveEngine.js";
import { VERIFIED_NASA_SCIENCE_TARGETS } from "../../backend/src/services/nasa/adapters/benchmarkData.js";

describe("Factorized Science Scoring Model (Phase 3)", () => {
  it("computes explicit factorized breakdown for a high-priority science target", () => {
    const kodiakButte = VERIFIED_NASA_SCIENCE_TARGETS.find((t) => t.id === "tgt-kodiak-butte")!;
    const breakdown = scienceObjectiveEngine.evaluateTargetFactorized(kodiakButte, "ANCIENT_WATER_ACTIVITY");

    expect(breakdown.totalScore).toBeGreaterThanOrEqual(70);
    expect(breakdown.objectiveRelevance).toBeGreaterThan(15);
    expect(breakdown.geologicalEvidence).toBeGreaterThan(10);
    expect(breakdown.targetUniqueness).toBeGreaterThan(10);
    expect(breakdown.dataQuality).toBeGreaterThan(5);
    expect(breakdown.sampleDiversity).toBeGreaterThanOrEqual(4);
    expect(breakdown.scoringMethod).toBe("PROJECT_RULE_FACTORIZED");
    expect(breakdown.provenance.sourceType).toBe("PROJECT_RULE");
    expect(breakdown.observedEvidenceSummary).toContain("Kodiak Butte");
  });

  it("produces route-level factorized science breakdown", () => {
    const targets = VERIFIED_NASA_SCIENCE_TARGETS.slice(0, 2);
    const result = scienceObjectiveEngine.calculateRouteScienceScore(targets, "PAST_HABITABILITY");

    expect(result.score).toBeGreaterThan(40);
    expect(result.breakdown.objectiveRelevance).toBeDefined();
    expect(result.breakdown.geologicalEvidence).toBeDefined();
    expect(result.breakdown.scoringMethod).toBe("PROJECT_RULE_FACTORIZED");
  });
});
