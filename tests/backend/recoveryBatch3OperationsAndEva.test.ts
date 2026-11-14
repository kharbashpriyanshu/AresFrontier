import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { TaskLifecycleService } from "../../backend/src/services/operations/taskLifecycleService.js";
import { CommunicationQueueService } from "../../backend/src/services/comms/communicationQueueService.js";

describe("Recovery Batch 3 — Field Operations & EVA Console", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    TaskLifecycleService.reset();
    TaskLifecycleService.syncDigitalTwin();
  });

  it("rejects task assignment when agent lacks required capability and accepts compatible agent", async () => {
    // ROVER-01 SCOUT does not have SPECTROMETER
    const badRes = await request(app)
      .post("/api/operations/tasks")
      .send({
        agentId: "agent-rover-01",
        name: "Raman Spectrometry Scan",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        targetCoordinate: { latitude: 18.45, longitude: 77.44 },
      });

    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe("CAPABILITY_MISMATCH");

    // ROVER-02 SCIENCE has SPECTROMETER
    const goodRes = await request(app)
      .post("/api/operations/tasks")
      .send({
        agentId: "agent-rover-02",
        name: "Raman Spectrometry Scan",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        targetCoordinate: { latitude: 18.45, longitude: 77.44 },
      });

    expect(goodRes.status).toBe(201);
    expect(goodRes.body.data.task.status).toBe("PENDING");
  });

  it("enforces task dependencies and strict lifecycle state transitions", async () => {
    const prereqRes = await request(app)
      .post("/api/operations/tasks")
      .send({
        agentId: "agent-rover-01",
        name: "Prerequisite Recon",
        taskType: "VERIFY_ROUTE",
        priority: "HIGH",
        targetCoordinate: { latitude: 18.45, longitude: 77.44 },
      });
    const prereqId = prereqRes.body.data.task.id;

    const depRes = await request(app)
      .post("/api/operations/tasks")
      .send({
        agentId: "agent-rover-02",
        name: "Dependent Science Core",
        taskType: "COLLECT_SCIENCE",
        priority: "HIGH",
        targetCoordinate: { latitude: 18.45, longitude: 77.44 },
        dependencies: [prereqId],
      });
    const depId = depRes.body.data.task.id;

    // Cannot start dependent task before prereq completes
    const blockedStart = await request(app)
      .post(`/api/operations/tasks/${depId}/transition`)
      .send({ action: "START" });
    expect(blockedStart.status).toBe(400);
    expect(blockedStart.body.error.code).toBe("UNMET_TASK_DEPENDENCIES");

    // Complete prereq: START -> PAUSE -> RESUME -> COMPLETE
    expect((await request(app).post(`/api/operations/tasks/${prereqId}/transition`).send({ action: "START" })).status).toBe(200);
    expect((await request(app).post(`/api/operations/tasks/${prereqId}/transition`).send({ action: "PAUSE" })).status).toBe(200);
    expect((await request(app).post(`/api/operations/tasks/${prereqId}/transition`).send({ action: "RESUME" })).status).toBe(200);
    expect((await request(app).post(`/api/operations/tasks/${prereqId}/transition`).send({ action: "COMPLETE" })).status).toBe(200);

    // Invalid transition from COMPLETED -> START must be rejected
    const invalidRestart = await request(app)
      .post(`/api/operations/tasks/${prereqId}/transition`)
      .send({ action: "START" });
    expect(invalidRestart.status).toBe(400);
    expect(invalidRestart.body.error.code).toBe("INVALID_STATE_TRANSITION");

    // Dependent task can now start
    const unblockedStart = await request(app)
      .post(`/api/operations/tasks/${depId}/transition`)
      .send({ action: "START" });
    expect(unblockedStart.status).toBe(200);
    expect(unblockedStart.body.data.task.status).toBe("IN_PROGRESS");
  });

  it("auto-reassigns active task when agent transitions to UNAVAILABLE", async () => {
    // Assign a general VERIFY_ROUTE task to ROVER-02
    const taskRes = await request(app)
      .post("/api/operations/tasks")
      .send({
        agentId: "agent-rover-02",
        name: "Corridor Verification",
        taskType: "VERIFY_ROUTE",
        priority: "HIGH",
        targetCoordinate: { latitude: 18.45, longitude: 77.44 },
        autoStart: true,
      });
    expect(taskRes.status).toBe(201);

    // Make ROVER-01 IDLE so it can accept auto-reassignment
    await request(app).post("/api/operations/agents/agent-rover-01/status").send({ status: "IDLE" });

    // Mark ROVER-02 UNAVAILABLE
    const statusRes = await request(app)
      .post("/api/operations/agents/agent-rover-02/status")
      .send({ status: "UNAVAILABLE", reason: "Wheel actuator fault" });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.agent.status).toBe("UNAVAILABLE");
    expect(statusRes.body.data.reassignedToAgent).toBeTruthy();
    expect(statusRes.body.data.reassignedTask.agentId).toBe(statusRes.body.data.reassignedToAgent.id);
  });

  it("updates simulated telemetry with provenance and keeps Digital Twin synchronized", async () => {
    const telRes = await request(app)
      .post("/api/operations/agents/agent-rover-01/telemetry")
      .send({ batteryPercent: 18, signalStrengthPercent: 85 });

    expect(telRes.status).toBe(200);
    expect(telRes.body.data.telemetryClassification).toBe("SIMULATED");
    expect(telRes.body.data.safetyWarnings.length).toBeGreaterThan(0);

    const twinRes = await request(app).get("/api/operations/digital-twin/inconsistencies");
    expect(twinRes.status).toBe(200);
    expect(twinRes.body.data.isConsistent).toBe(true);
  });

  it("enqueues packets during blackout and delivers them on queue flush", async () => {
    const pktRes = await request(app)
      .post("/api/operations/comms/packets")
      .send({
        sourceAgentId: "agent-rover-01",
        priority: "CRITICAL",
        type: "HAZARD_ALERT",
        payloadSizeKb: 16,
      });
    expect(pktRes.status).toBe(201);
    const packetId = pktRes.body.data.packet.packetId;

    // Flush with blackout -> BUFFERED
    const blackoutFlush = await request(app)
      .post("/api/operations/comms/flush")
      .send({ orbiterAvailable: false });
    expect(blackoutFlush.status).toBe(200);
    const bufferedPkt = blackoutFlush.body.data.queue.find((p: any) => p.packetId === packetId);
    expect(bufferedPkt.status).toBe("BUFFERED");

    // Flush with orbiter active -> DELIVERED
    const activeFlush = await request(app)
      .post("/api/operations/comms/flush")
      .send({ orbiterAvailable: true });
    expect(activeFlush.status).toBe(200);
    const deliveredPkt = activeFlush.body.data.queue.find((p: any) => p.packetId === packetId);
    expect(deliveredPkt.status).toBe("DELIVERED");
  });

  it("enforces EVA session lifecycle, S1-S8 safety gates, and isolated emergency-return simulation", async () => {
    const createRes = await request(app)
      .post("/api/eva/sessions")
      .send({
        missionId: "MARSWALK-001",
        title: "Sol 101 Verification EVA",
        crewAgentId: "agent-astronaut-01",
        supportRoverId: "agent-rover-01",
        plannedDurationMinutes: 180,
      });
    expect(createRes.status).toBe(201);
    const evaId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe("PLANNED");
    expect(createRes.body.data.telemetryProvenance.sourceType).toBe("SIMULATED");

    // Start -> Advance -> Pause -> Resume
    const startRes = await request(app).post(`/api/eva/sessions/${evaId}/transition`).send({ action: "START" });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe("ACTIVE");

    const advRes = await request(app).post(`/api/eva/sessions/${evaId}/advance`).send({ minutes: 15 });
    expect(advRes.status).toBe(200);
    expect(advRes.body.data.elapsedMinutes).toBe(15);
    expect(advRes.body.data.remainingMinutes).toBe(165);

    // Isolated emergency return simulation must not mutate live session status
    const simRes = await request(app)
      .post(`/api/eva/sessions/${evaId}/simulate-emergency-return`)
      .send({ scenario: "Dust Squall Return", speedFactor: 0.9, extraHazardDelayMinutes: 5 });
    expect(simRes.status).toBe(200);
    expect(simRes.body.data.isolatedFromLiveState).toBe(true);

    const checkLive = await request(app).get(`/api/eva/sessions/${evaId}`);
    expect(checkLive.body.data.status).toBe("ACTIVE");

    // Transition to EMERGENCY_RETURN then COMPLETE
    const rtRes = await request(app).post(`/api/eva/sessions/${evaId}/transition`).send({ action: "EMERGENCY_RETURN" });
    expect(rtRes.status).toBe(200);
    expect(rtRes.body.data.status).toBe("EMERGENCY_RETURN");

    const compRes = await request(app).post(`/api/eva/sessions/${evaId}/transition`).send({ action: "COMPLETE" });
    expect(compRes.status).toBe(200);
    expect(compRes.body.data.status).toBe("COMPLETED");

    // Terminal state cannot resume
    const invalidRes = await request(app).post(`/api/eva/sessions/${evaId}/transition`).send({ action: "RESUME" });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe("INVALID_STATE_TRANSITION");

    // S3 safety block when oxygen reserve < 30 minutes
    await request(app)
      .post("/api/operations/agents/agent-astronaut-01/telemetry")
      .send({ suitOxygenReserveMinutes: 20 });

    const unsafeCreate = await request(app)
      .post("/api/eva/sessions")
      .send({ title: "Unsafe Low-O2 EVA", crewAgentId: "agent-astronaut-01", plannedDurationMinutes: 120 });
    const unsafeStart = await request(app)
      .post(`/api/eva/sessions/${unsafeCreate.body.data.id}/transition`)
      .send({ action: "START" });
    expect(unsafeStart.status).toBe(400);
    expect(unsafeStart.body.error.code).toBe("SAFETY_INVARIANT_VIOLATION");
  });
});

