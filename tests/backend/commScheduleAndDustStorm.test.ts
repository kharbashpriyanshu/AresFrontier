import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { commWindowScheduler } from "../../backend/src/services/comms/commWindowScheduler.js";
import { dustStormSimulationService } from "../../backend/src/services/planetary/dustStormSimulationService.js";

describe("Upgrades U6 & U7: Communication Pass Scheduling & Dust Storm Simulation", () => {
  it("schedules science stops aligned with orbiter visibility windows", () => {
    const points = [
      { id: "p1", coordinate: { latitude: 18.4447, longitude: 77.4508 }, type: "start" as const, label: "Butler Landing" },
      { id: "p2", coordinate: { latitude: 18.4230, longitude: 77.4110 }, type: "science" as const, label: "Kodiak Butte" },
      { id: "p3", coordinate: { latitude: 18.4400, longitude: 77.3950 }, type: "destination" as const, label: "Delta Scarp Camp" },
    ];

    const result = commWindowScheduler.scheduleTraverse(points, 0, 25);
    expect(result.stops.length).toBe(3);
    expect(result.stops[1].durationMinutes).toBe(25);
    expect(result.missionDurationMinutes).toBeGreaterThan(30);
    expect(result.stops[0].commsProfileAtArrival).toBeDefined();
    expect(result.scheduleDirective).toBeDefined();
  });

  it("accurately models Beer-Lambert solar drop and abort directive under dust storms", () => {
    const nominal = dustStormSimulationService.evaluateDustStormImpact({
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      sol: 100,
      stormType: "NOMINAL",
    });

    expect(nominal.evaMobilityStatus).toBe("NOMINAL_EXPLORATION");
    expect(nominal.solarReductionPercent).toBeLessThan(50);
    expect(nominal.visibilityMeters).toBeGreaterThan(1000);

    const severeStorm = dustStormSimulationService.evaluateDustStormImpact({
      coordinate: { latitude: 18.4447, longitude: 77.4508 },
      sol: 100,
      stormType: "PLANET_ENCIRCLING_STORM",
    });

    expect(severeStorm.dustOpticalDepthTau).toBeGreaterThanOrEqual(3.0);
    expect(severeStorm.evaMobilityStatus).toBe("MANDATORY_ABORT_AND_SHELTER");
    expect(severeStorm.solarReductionPercent).toBeGreaterThan(80);
    expect(severeStorm.operationalDirective).toContain("CRITICAL ALERT");
  });

  it("serves communication scheduling via /api/data/authentic/comm-schedule", async () => {
    const res = await request(app).get("/api/data/authentic/comm-schedule?startMinute=0&dwellMinutes=20");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stops.length).toBeGreaterThan(0);
    expect(res.body.metadata.framework).toContain("MRO");
  });

  it("serves dust storm simulation via /api/simulation/dust-storm", async () => {
    const res = await request(app)
      .post("/api/simulation/dust-storm")
      .send({
        latitude: 18.4447,
        longitude: 77.4508,
        sol: 150,
        stormType: "REGIONAL_STORM",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dustOpticalDepthTau).toBeGreaterThan(1.5);
    expect(res.body.data.evaMobilityStatus).toBe("CAUTION_RESTRICTED_SPEED");
    expect(res.body.data.sourceDataset).toContain("MEDA");
  });
});
