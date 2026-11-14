import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";

describe("Copilot Mission Intelligence End-to-End API Flow", () => {
  it("GET /api/intelligence/hazards returns catalog of Mars surface hazards", async () => {
    const res = await request(app).get("/api/intelligence/hazards");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.metadata.source).toBeDefined();
  });

  it("GET /api/intelligence/science-objectives returns MEPAG objectives", async () => {
    const res = await request(app).get("/api/intelligence/science-objectives");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(6);
  });

  it("POST /api/intelligence/assess-terrain returns slope and roughness analysis", async () => {
    const res = await request(app)
      .post("/api/intelligence/assess-terrain")
      .send({
        coordinate: { latitude: 18.4447, longitude: 77.4508 },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.elevationM).toBeDefined();
    expect(res.body.data.traversalDifficulty).toBeDefined();
  });

  it("POST /api/copilot/mission-plan completes full multi-candidate reasoning with audit trail", async () => {
    const res = await request(app)
      .post("/api/copilot/mission-plan")
      .send({
        prompt: "Plan a safe 3-hour EVA from Octavia E. Butler landing to inspect ancient deltaic sediments",
        startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
        destinationCoordinate: { latitude: 18.455, longitude: 77.465 },
        objectiveId: "ANCIENT_WATER_ACTIVITY",
        maxDurationMinutes: 180,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.candidates.length).toBe(4);
    expect(res.body.data.recommendation).toBeDefined();
    expect(res.body.data.recommendation.decision).toContain("Recommend");
    expect(res.body.data.auditEvent.integrityHash).toBeDefined();

    // Verify audit log endpoint
    const auditRes = await request(app).get("/api/intelligence/audit-log");
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
  });
});
