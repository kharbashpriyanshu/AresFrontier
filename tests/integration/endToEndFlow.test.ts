import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";

describe("Martian Map — Complete End-to-End Mission Journey", () => {
  it("executes the full user journey: Location -> Science -> Route -> EVA -> Assessment", async () => {
    // 1. Explore Mars: Get verified location (Jezero Crater)
    const locRes = await request(app).get("/api/locations/loc-jezero-crater");
    expect(locRes.status).toBe(200);
    expect(locRes.body.success).toBe(true);
    const startLocation = locRes.body.data;
    expect(startLocation.coordinate.latitude).toBeCloseTo(18.44, 1);

    // 2. Inspect terrain at that location
    const terrainRes = await request(app).get(
      `/api/terrain?lat=${startLocation.coordinate.latitude}&lon=${startLocation.coordinate.longitude}`
    );
    expect(terrainRes.status).toBe(200);
    expect(terrainRes.body.data.elevationM).toBeDefined();

    // 3. View nearby Science Targets
    const targetsRes = await request(app).get("/api/science/targets");
    expect(targetsRes.status).toBe(200);
    const targets = targetsRes.body.data;
    const seitahTarget = targets.find((t: { id: string }) => t.id === "tgt-seitah-olivine");
    const kodiakTarget = targets.find((t: { id: string }) => t.id === "tgt-kodiak-butte");
    expect(seitahTarget).toBeDefined();

    // 4. Construct Marswalk Route (Start -> 2 Science Stops -> Destination)
    const routePayload = {
      name: "E2E Jezero Delta Traversal Mission",
      points: [
        {
          id: "pt-1",
          coordinate: startLocation.coordinate,
          type: "start",
          label: "Jezero Base",
        },
        {
          id: "pt-2",
          coordinate: seitahTarget.coordinate,
          type: "science",
          label: seitahTarget.name,
          targetId: seitahTarget.id,
        },
        {
          id: "pt-3",
          coordinate: kodiakTarget.coordinate,
          type: "science",
          label: kodiakTarget.name,
          targetId: kodiakTarget.id,
        },
        {
          id: "pt-4",
          coordinate: { latitude: 18.44, longitude: 77.395 },
          type: "destination",
          label: "Base Camp",
        },
      ],
    };

    const routeRes = await request(app).post("/api/routes").send(routePayload);
    expect(routeRes.status).toBe(201);
    expect(routeRes.body.success).toBe(true);
    const generatedRoute = routeRes.body.data;
    expect(generatedRoute.id).toBeDefined();
    expect(generatedRoute.segments.length).toBe(3);
    expect(generatedRoute.elevationProfile.length).toBeGreaterThan(10);

    // 5. Calculate EVA Feasibility
    const missionRes = await request(app)
      .post("/api/missions")
      .send({
        routeId: generatedRoute.id,
        maxDurationMinutes: 240,
        startCoordinate: startLocation.coordinate,
        returnRequired: true,
      });
    expect(missionRes.status).toBe(201);
    expect(missionRes.body.data.evaAssessment.feasible).toBe(true);
    expect(missionRes.body.data.evaAssessment.returnMarginMinutes).toBeGreaterThan(0);

    // 6. Assess Mission with AI / Rule-based Adapter
    const assessRes = await request(app)
      .post("/api/assessment")
      .send({
        routeId: generatedRoute.id,
        missionParameters: { maxDurationMinutes: 240 },
      });
    expect(assessRes.status).toBe(200);
    expect(assessRes.body.success).toBe(true);
    expect(assessRes.body.data.overallScore).toBeGreaterThan(0);
    expect(assessRes.body.data.scoringSource).toBeDefined();
    expect(assessRes.body.data.missionStatus).toBeDefined();

    // 7. Verify Data Status & Pipelines report active
    const statusRes = await request(app).get("/api/data/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.pipelines.molaElevation).toBe("Available");
    expect(statusRes.body.data.pipelines.scienceTargets).toBe("Available");
  }, 15000);
});
