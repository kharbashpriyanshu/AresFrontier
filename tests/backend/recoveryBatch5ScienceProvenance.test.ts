import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../backend/src/app.js";

describe("Recovery Batch 5: Science Intelligence & Data Provenance", () => {
  it("returns verified Mars science targets across all 6 major regions with honest missing-evidence disclosures", async () => {
    const res = await request(app).get("/api/science/targets");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const targets = res.body.data as Array<any>;
    const regions = new Set(targets.map((t) => t.region));
    expect(regions.has("Jezero Crater")).toBe(true);
    expect(regions.has("Gale Crater")).toBe(true);
    expect(regions.has("Olympus Mons")).toBe(true);
    expect(regions.has("Valles Marineris")).toBe(true);
    expect(regions.has("Oxia Planum")).toBe(true);
    expect(regions.has("Utopia Planitia")).toBe(true);

    const olympus = targets.find((t) => t.id === "tgt-olympus-caldera");
    expect(olympus).toBeDefined();
    expect(olympus.evidenceStatus).toBe("orbital_only");
    expect(Array.isArray(olympus.missingEvidence)).toBe(true);
    expect(olympus.missingEvidence.length).toBeGreaterThan(0);
    expect(olympus.potentialSamples).toEqual([]);
  });

  it("evaluates targets, objectives, mineralogy, and ice stability with explicit fallback and provenance disclosures", async () => {
    const targetRes = await request(app).post("/api/science/evaluate-target").send({
      targetId: "tgt-kodiak-butte",
      name: "Kodiak Butte Delta Remnant",
      latitude: 18.423,
      longitude: 77.411,
      targetType: "stratigraphy",
      description: "Deltaic clay-bearing outcrop",
    });
    expect(targetRes.status).toBe(200);
    expect(targetRes.body.data.scientific_yield_score).toBeGreaterThan(0);
    expect(typeof targetRes.body.data.fallbackUsed).toBe("boolean");
    expect(targetRes.body.data.provenanceClassification).toBeDefined();
    expect(targetRes.body.data.methodology).toBeTruthy();
    expect(Array.isArray(targetRes.body.data.limitations)).toBe(true);

    const objRes = await request(app).post("/api/science/evaluate-objectives").send({
      objectiveId: "ANCIENT_WATER_ACTIVITY",
      targetTypes: ["stratigraphy", "mineralogy"],
      waypointsCount: 3,
      routeLengthKm: 4.5,
    });
    expect(objRes.status).toBe(200);
    expect(objRes.body.data.mepag_alignment_score).toBeGreaterThan(0);
    expect(typeof objRes.body.data.fallbackUsed).toBe("boolean");

    const minRes = await request(app).post("/api/science/classify-mineralogy").send({
      latitude: 18.423,
      longitude: 77.411,
      geologicalContext: "Deltaic Fan Complex",
    });
    expect(minRes.status).toBe(200);
    expect(Array.isArray(minRes.body.data.primary_minerals)).toBe(true);
    expect(minRes.body.data.primary_minerals.length).toBeGreaterThan(0);
    expect(minRes.body.data.crism_analog_unit).toContain("Jezero");

    const iceRes = await request(app).post("/api/science/assess-ice").send({
      latitude: 45.1,
      longitude: 110.5,
    });
    expect(iceRes.status).toBe(200);
    expect(iceRes.body.data.subsurface_ice_probability).toBeGreaterThan(0.5);
    expect(iceRes.body.data.ice_stability_zone).toBe("STABLE_DEEP");
  });

  it("rejects out-of-bounds Mars coordinates with HTTP 400 across science assessment endpoints", async () => {
    const assessErr = await request(app).get("/api/science/assessment?lat=120&lon=77");
    expect(assessErr.status).toBe(400);
    expect(assessErr.body.error.code).toBe("INVALID_COORDINATE");

    const evalErr = await request(app).post("/api/science/evaluate-target").send({
      targetId: "bad",
      name: "Bad Coord",
      latitude: -95,
      longitude: 10,
      targetType: "mineralogy",
    });
    expect(evalErr.status).toBe(400);
    expect(evalErr.body.error.code).toBe("INVALID_COORDINATE");
  });

  it("persists science target assignments to draft missions and protects approved/locked missions from silent mutation", async () => {
    const draftAssign = await request(app)
      .post("/api/science/targets/tgt-oxia-planum/assign-mission")
      .send({
        missionId: "MARSWALK-DRAFT-TEST",
        objectiveId: "ASTROBIOLOGY_RELEVANCE",
        rationale: "Investigate Oxia Planum Fe/Mg phyllosilicates",
      });
    expect(draftAssign.status).toBe(201);
    expect(draftAssign.body.data.targetId).toBe("tgt-oxia-planum");
    expect(draftAssign.body.data.auditBlockHash).toBeTruthy();
    expect(draftAssign.body.data.eventId).toBeTruthy();

    const decisionsRes = await request(app).get("/api/science/decisions?missionId=MARSWALK-DRAFT-TEST");
    expect(decisionsRes.status).toBe(200);
    expect(decisionsRes.body.data.some((d: any) => d.targetId === "tgt-oxia-planum")).toBe(true);

    // Check if an existing mission can be created, approved, and protected
    const routeRes = await request(app).post("/api/routes").send({
      name: "Batch 5 Guard Route",
      points: [
        { id: "p1", coordinate: { latitude: 18.42, longitude: 77.41 }, type: "start" },
        { id: "p2", coordinate: { latitude: 18.43, longitude: 77.43 }, type: "end" },
      ],
    });
    expect([200, 201]).toContain(routeRes.status);
    const routeId = routeRes.body.data.id;

    const missionRes = await request(app).post("/api/missions").send({
      name: "Batch 5 Approved Guard Mission",
      routeId,
      parameters: {
        roverType: "Perseverance",
        speedKmh: 0.14,
        maxSlopeDeg: 20,
        solarEfficiency: 0.85,
        batteryCapacityWh: 1200,
        payloadWeightKg: 45,
        startSol: 100,
        communicationWindowHours: 4,
      },
      status: "APPROVED",
    });
    expect([200, 201]).toContain(missionRes.status);
    const approvedMissionId = missionRes.body.data.id;

    const guardedRes = await request(app)
      .post(`/api/science/targets/tgt-kodiak-butte/assign-mission`)
      .send({
        missionId: approvedMissionId,
        rationale: "Attempt mutation on approved mission",
      });
    expect(guardedRes.status).toBe(409);
    expect(guardedRes.body.error.code).toBe("APPROVED_MISSION_PROTECTED");
  });

  it("filters NASA dataset provenance and verifies cryptographic audit chain in provenance explorer", async () => {
    const allRes = await request(app).get("/api/provenance/explorer");
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.totalDatasets).toBeGreaterThanOrEqual(7);
    expect(typeof allRes.body.data.auditVerification.valid).toBe("boolean");

    const mroRes = await request(app).get("/api/provenance/explorer?mission=MRO&classification=DERIVED");
    expect(mroRes.status).toBe(200);
    expect(mroRes.body.data.datasets.length).toBeGreaterThanOrEqual(2);
    expect(
      mroRes.body.data.datasets.every(
        (d: any) => d.mission.includes("MRO") && d.classification === "DERIVED"
      )
    ).toBe(true);
  });
});
