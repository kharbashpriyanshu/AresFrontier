import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { missionRepository } from "../../backend/src/repositories/missionRepository.js";
import { MissionStateCoordinator } from "../../backend/src/services/state/missionStateCoordinator.js";

describe("Recovery Batch 1: Mission Management & Map API Regression", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    for (const id of createdIds) {
      await request(app).delete(`/api/missions/${id}`);
    }
  });

  it("lists persisted missions including default MARSWALK-001 with name and status", async () => {
    const res = await request(app).get("/api/missions");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const defaultMission = res.body.data.find((m: any) => m.id === "MARSWALK-001");
    expect(defaultMission).toBeDefined();
    expect(defaultMission.name).toBeTruthy();
    expect(defaultMission.status).toBe("APPROVED");
  });

  it("validates mission creation inputs and rejects invalid duration or missing routeId", async () => {
    const missingRoute = await request(app).post("/api/missions").send({
      name: "Invalid Mission",
      maxDurationMinutes: 180,
      returnRequired: true,
    });
    expect(missingRoute.status).toBe(400);
    expect(missingRoute.body.success).toBe(false);

    const invalidDuration = await request(app).post("/api/missions").send({
      name: "Zero Duration Mission",
      routeId: "route-jezero-delta-sol100",
      maxDurationMinutes: -10,
      returnRequired: true,
    });
    expect(invalidDuration.status).toBe(400);
    expect(invalidDuration.body.success).toBe(false);
  });

  it("creates, updates, persists across disk reload, and deletes a mission", async () => {
    const createRes = await request(app).post("/api/missions").send({
      name: "Recovery Batch 1 Test Mission",
      description: "Verify create, edit, and reload persistence",
      objectiveId: "PAST_HABITABILITY",
      routeId: "route-jezero-delta-sol100",
      maxDurationMinutes: 210,
      startCoordinate: { latitude: 18.4447, longitude: 77.4508 },
      returnRequired: true,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const missionId = createRes.body.data.id as string;
    createdIds.push(missionId);

    expect(createRes.body.data.name).toBe("Recovery Batch 1 Test Mission");
    expect(createRes.body.data.status).toBe("DRAFT");
    expect(createRes.body.data.objectiveId).toBe("PAST_HABITABILITY");

    const patchRes = await request(app).patch(`/api/missions/${missionId}`).send({
      name: "Recovery Batch 1 Edited Mission",
      description: "Updated objective and duration",
      objectiveId: "MINERALOGICAL_DIVERSITY",
      maxDurationMinutes: 150,
      status: "APPROVED",
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.name).toBe("Recovery Batch 1 Edited Mission");
    expect(patchRes.body.data.status).toBe("APPROVED");
    expect(patchRes.body.data.objectiveId).toBe("MINERALOGICAL_DIVERSITY");
    expect(patchRes.body.data.parameters.maxDurationMinutes).toBe(150);

    // Simulate backend restart by reloading repository from disk
    missionRepository.loadFromDisk();
    const afterReload = await request(app).get(`/api/missions/${missionId}`);
    expect(afterReload.status).toBe(200);
    expect(afterReload.body.data.name).toBe("Recovery Batch 1 Edited Mission");
    expect(afterReload.body.data.status).toBe("APPROVED");
    expect(afterReload.body.data.parameters.maxDurationMinutes).toBe(150);

    // Delete and verify 404
    const delRes = await request(app).delete(`/api/missions/${missionId}`);
    expect(delRes.status).toBe(200);
    const afterDelete = await request(app).get(`/api/missions/${missionId}`);
    expect(afterDelete.status).toBe(404);
  });

  it("isolates MissionStateCoordinator state per missionId", async () => {
    const resA = await request(app).post("/api/missions").send({
      name: "Isolation Mission Alpha",
      routeId: "route-jezero-delta-sol100",
      maxDurationMinutes: 180,
      returnRequired: true,
    });
    const resB = await request(app).post("/api/missions").send({
      name: "Isolation Mission Beta",
      routeId: "route-jezero-delta-sol100",
      maxDurationMinutes: 260,
      returnRequired: false,
    });
    const idA = resA.body.data.id as string;
    const idB = resB.body.data.id as string;
    createdIds.push(idA, idB);

    const stateA = MissionStateCoordinator.getCanonicalState(idA);
    const stateB = MissionStateCoordinator.getCanonicalState(idB);
    expect(stateA.missionId).toBe(idA);
    expect(stateB.missionId).toBe(idB);
    expect(stateA.metadata.name).toBe("Isolation Mission Alpha");
    expect(stateB.metadata.name).toBe("Isolation Mission Beta");

    // Updating domain for missionA should not mutate missionB
    await request(app)
      .patch(`/api/missions/state/${idA}/domain/metadata`)
      .send({ sol: 222 });

    const reloadedA = MissionStateCoordinator.getCanonicalState(idA);
    const reloadedB = MissionStateCoordinator.getCanonicalState(idB);
    expect(reloadedA.metadata.sol).toBe(222);
    expect(reloadedB.metadata.sol).toBe(100);
  });
});

