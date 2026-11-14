import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";

describe("Phase 4: Operations API Endpoints", () => {
  it("GET /api/operations/agents returns all registered planetary agents", async () => {
    const res = await request(app).get("/api/operations/agents");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);

    const callsigns = res.body.data.map((a: any) => a.callsign);
    expect(callsigns.some((c: string) => c.includes("SCOUT"))).toBe(true);
    expect(callsigns.some((c: string) => c.includes("ASTRONAUT"))).toBe(true);
    expect(callsigns.some((c: string) => c.includes("ORBITER"))).toBe(true);
  });

  it("GET /api/operations/agents/:id returns individual agent with telemetry", async () => {
    const res = await request(app).get("/api/operations/agents/agent-rover-01");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("agent-rover-01");
    expect(res.body.data.telemetry).toBeDefined();
    expect(res.body.data.telemetry.batteryPercent).toBeGreaterThan(0);
    expect(res.body.data.position).toBeDefined();
  });

  it("POST /api/operations/agents/:id/commands executes agent command", async () => {
    const res = await request(app)
      .post("/api/operations/agents/agent-rover-01/commands")
      .send({ command: "PAUSE", reason: "Precautionary terrain inspection" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent.status).toBe("PAUSED");
  });

  it("GET /api/operations/communications returns topology and active links", async () => {
    const res = await request(app).get("/api/operations/communications");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.links).toBeDefined();
    expect(Array.isArray(res.body.data.links)).toBe(true);
    expect(res.body.data.missionControlReachable).toBe(true);
  });

  it("POST /api/operations/simulation/advance increments MET timeline step", async () => {
    const res = await request(app)
      .post("/api/operations/simulation/advance")
      .send({ minutes: 15 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.simState).toBeDefined();
    expect(res.body.data.simState.simulationTimeMinutes).toBeGreaterThan(0);
  });

  it("POST /api/operations/copilot/query generates explainable operations response", async () => {
    const res = await request(app)
      .post("/api/operations/copilot/query")
      .send({ query: "Send Scout to investigate steep region" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendation).toBeDefined();
    expect(res.body.data.assessment).toBeDefined();
    expect(res.body.data.agentDirectives.length).toBeGreaterThan(0);
  });
});
