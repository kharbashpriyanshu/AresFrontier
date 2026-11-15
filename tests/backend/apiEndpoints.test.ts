import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";

describe("Ares Frontier API Integration Endpoints", () => {
  it("GET / returns status online", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("online");
  });

  it("GET /api/locations returns benchmark planetary locations", async () => {
    const res = await request(app).get("/api/locations");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("GET /api/locations/:id returns specific location", async () => {
    const res = await request(app).get("/api/locations/loc-jezero-crater");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toContain("Jezero Crater");
    expect(res.body.data.elevationM).toBe(-2530);
  });

  it("GET /api/terrain returns elevation and slope at coordinates", async () => {
    const res = await request(app).get("/api/terrain?lat=18.44&lon=77.45");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.elevationM).toBeDefined();
    expect(res.body.data.difficulty).toBeDefined();
  });

  it("GET /api/science/targets returns verified science targets", async () => {
    const res = await request(app).get("/api/science/targets");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("GET /api/science/assessment returns geological context", async () => {
    const res = await request(app).get("/api/science/assessment?lat=18.44&lon=77.45");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scientificValue).toBe("high");
    expect(res.body.data.mineralContext).toBeDefined();
  });

  it("POST /api/routes creates and computes a valid route", async () => {
    const res = await request(app)
      .post("/api/routes")
      .send({
        name: "Test Traverse",
        points: [
          { coordinate: { latitude: 18.44, longitude: 77.45 }, type: "start" },
          { coordinate: { latitude: 18.42, longitude: 77.41 }, type: "destination" },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.totalDistanceKm).toBeGreaterThan(0);
  });

  it("POST /api/assessment returns ML hazard & science scores", async () => {
    const res = await request(app)
      .post("/api/assessment")
      .send({
        routeId: "route-jezero-delta-sol100",
        missionParameters: { maxDurationMinutes: 240 },
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.safetyScore).toBeGreaterThan(0);
    expect(res.body.data.scienceScore).toBeGreaterThan(0);
    expect(res.body.data.overallScore).toBeGreaterThan(0);
  });

  it("GET /api/data/sources returns catalog of NASA data pipelines", async () => {
    const res = await request(app).get("/api/data/sources");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(2);
  });
});
