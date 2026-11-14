import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { mepagTargetPrioritizer } from "../../backend/src/services/science/mepagTargetPrioritizer.js";
import { comprehensiveParetoPlanner } from "../../backend/src/services/intelligence/comprehensiveParetoPlanner.js";

describe("Milestone 5 — MEPAG Science Prioritization & Multi-Objective Pareto Planning (Items 24 - 27)", () => {
  const jezeroBase = { latitude: 18.4447, longitude: 77.4508 };
  const deltaScarp = { latitude: 18.438, longitude: 77.418 };

  // --------------------------------------------------------------------------
  // Item 27: MEPAG Goals I-IV Science Target Prioritization
  // --------------------------------------------------------------------------
  it("Item 27: Prioritizes targets against NASA MEPAG Goals I-IV and adapts to mission focus", async () => {
    // Focus on Goal I: Life (Astrobiology)
    const lifeFocus = await mepagTargetPrioritizer.prioritizeTargets(jezeroBase, "GOAL_I_LIFE");
    expect(lifeFocus.length).toBeGreaterThanOrEqual(4);

    // Delta clay outcrop should rank near the top for Goal I Life due to extreme biosignature preservation
    const topLife = lifeFocus[0];
    expect(topLife.mepagGoals.goalILifeScore).toBeGreaterThan(80);
    expect(topLife.recommendedSamplingInstrument).toBeDefined();

    // Focus on Goal IV: Human Exploration (Water / Trafficability)
    const humanFocus = await mepagTargetPrioritizer.prioritizeTargets(jezeroBase, "GOAL_IV_HUMAN");
    expect(humanFocus.length).toBeGreaterThanOrEqual(4);
    // Rankings should shift based on chosen MEPAG goal
    expect(humanFocus[0].mepagGoals.goalIVHumanExplorationScore).toBeGreaterThan(60);
  });

  // --------------------------------------------------------------------------
  // Item 26: Multi-Objective Pareto Traverse Planning
  // --------------------------------------------------------------------------
  it("Item 26: Evaluates 7-dimensional non-dominated Pareto frontier and selects optimal trade-off", async () => {
    const analysis = await comprehensiveParetoPlanner.evaluatePlans(jezeroBase, deltaScarp, 360);

    expect(analysis.evaluatedPlansCount).toBe(4);
    expect(analysis.paretoFrontierCount).toBeGreaterThanOrEqual(3);
    expect(analysis.recommendedPlanId).toBe("plan-pareto-optimal");

    const recommended = analysis.plans.find((p) => p.planId === analysis.recommendedPlanId)!;
    expect(recommended.isParetoOptimal).toBe(true);
    expect(recommended.scienceScore).toBeGreaterThan(80);
    expect(recommended.safetyScore).toBeGreaterThan(80);
    expect(recommended.mandatory30MinReturnBufferPreserved).toBe(true);
    expect(recommended.safeReturnMarginMinutes).toBeGreaterThan(30);

    // Direct plan should have minimal duration/distance but lower science
    const direct = analysis.plans.find((p) => p.planId === "plan-pareto-direct")!;
    expect(direct.distanceKm).toBeLessThan(recommended.distanceKm);
    expect(direct.scienceScore).toBeLessThan(recommended.scienceScore);
  });

  // --------------------------------------------------------------------------
  // REST API Endpoints Verification
  // --------------------------------------------------------------------------
  it("REST API: Serves mepag-targets and pareto-plans endpoints", async () => {
    const mepagRes = await request(app).get("/api/data/authentic/mepag-targets?lat=18.44&lon=77.45&focus=GOAL_I_LIFE");
    expect(mepagRes.status).toBe(200);
    expect(mepagRes.body.data.length).toBeGreaterThanOrEqual(4);
    expect(mepagRes.body.data[0].samplingPriorityRank).toBe(1);

    const paretoRes = await request(app).get("/api/data/authentic/pareto-plans?startLat=18.44&startLon=77.45&destLat=18.438&destLon=77.418");
    expect(paretoRes.status).toBe(200);
    expect(paretoRes.body.data.paretoFrontierCount).toBeGreaterThanOrEqual(3);
    expect(paretoRes.body.data.recommendedPlanId).toBe("plan-pareto-optimal");
  });
});
