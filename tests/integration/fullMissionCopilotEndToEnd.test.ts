import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";

describe("Phase 3 Full Mission Copilot End-to-End Test", () => {
  it("executes complete structured reasoning pipeline with Pareto analysis and hash-chain verification", async () => {
    // 1. Send natural language prompt to Copilot endpoint
    const res = await request(app)
      .post("/api/copilot/mission-plan")
      .send({
        prompt: "Plan a 4-hour EVA from Octavia Butler base to investigate ancient lake delta sediments and collect clay cores",
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.440, longitude: 77.395 },
        maxDurationMinutes: 240,
        returnRequired: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;

    // Verify parsed mission objective
    expect(data.missionObjective).toBeDefined();
    expect(data.missionObjective.id).toBe("ANCIENT_WATER_ACTIVITY");
    expect(data.missionObjective.constraints.length).toBeGreaterThan(0);

    // Verify 4 candidates
    expect(data.candidates.length).toBe(4);

    // Verify Pareto frontier identification
    expect(data.paretoFrontier).toBeDefined();
    expect(data.paretoFrontier.length).toBeGreaterThanOrEqual(1);

    // Verify risk-adjusted scoring
    const recommended = data.recommendedRoute;
    expect(recommended).toBeDefined();
    expect(recommended.multiObjectiveScore.riskAdjustedScore).toBeGreaterThanOrEqual(5);
    expect(recommended.multiObjectiveScore.riskAdjustedScore).toBeLessThanOrEqual(100);

    // Verify EVA operational status (GREEN / YELLOW / RED)
    expect(["GREEN", "YELLOW", "RED"]).toContain(data.evaAssessment.status);
    expect(data.evaAssessment.statusReason).toBeDefined();
    expect(data.evaAssessment.emergencyReserveMinutes).toBeGreaterThanOrEqual(0);

    // Verify evidence and uncertainty
    expect(data.evidence.coverage).toBeDefined();
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(data.evidence.coverage.overallEvidence);
    expect(data.uncertainty.terrainUncertaintyM).toBeDefined();
    expect(data.uncertainty.limitations.length).toBeGreaterThan(0);

    // Verify decision and directives
    expect(data.decision).toContain("Recommend");
    expect(data.directives.length).toBeGreaterThan(0);

    // Verify plan versioning & status
    expect(data.planVersion).toBeGreaterThanOrEqual(1);
    expect(data.planStatus).toBe("ASSESSED");

    // Verify hash-chain verification endpoint
    const verifyRes = await request(app).post("/api/security/verify-audit-chain");
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.isValid).toBe(true);
    expect(verifyRes.body.data.chainLength).toBeGreaterThan(0);
  });
});
