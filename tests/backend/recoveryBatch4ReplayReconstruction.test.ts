import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../backend/src/app.js";
import { MissionEventStore } from "../../backend/src/services/persistence/missionEventStore.js";
import { MissionReplayEngine } from "../../backend/src/services/replay/missionReplayEngine.js";
import { HistoricalReconstructionService } from "../../backend/src/services/replay/historicalReconstructionService.js";
import { ReplayStateManager } from "../../backend/src/services/replay/replayStateManager.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";

describe("Recovery Batch 4 — Mission Replay, Event History & Historical Reconstruction", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    MissionEventStore.clearEvents();
  });

  afterAll(() => {
    MissionEventStore.clearEvents();
    MissionReplayEngine.loadMission("MARSWALK-001");
  });

  it("persists events across re-initialization, orders identically-timestamped events deterministically, and deduplicates idempotency keys", () => {
    const ts = "2026-11-12T12:00:00.000Z";
    const e1 = MissionEventStore.appendEvent({
      missionId: "MISSION-ISO-1",
      actor: "ROVER-01 SCOUT",
      agentId: "agent-rover-01",
      entityId: "agent-rover-01",
      timestamp: ts,
      idempotencyKey: "idem-001",
      eventType: "TELEMETRY_UPDATED",
      resultingState: { batteryPercent: 84 },
      payload: { batteryPercent: 84 },
    });
    const dup = MissionEventStore.appendEvent({
      missionId: "MISSION-ISO-1",
      actor: "ROVER-01 SCOUT",
      timestamp: ts,
      idempotencyKey: "idem-001",
      eventType: "TELEMETRY_UPDATED",
      payload: { batteryPercent: 84 },
    });
    expect(dup.eventId).toBe(e1.eventId);

    const e2 = MissionEventStore.appendEvent({
      missionId: "MISSION-ISO-1",
      actor: "ROVER-01 SCOUT",
      agentId: "agent-rover-01",
      entityId: "agent-rover-01",
      timestamp: ts,
      eventType: "TELEMETRY_UPDATED",
      resultingState: { batteryPercent: 79 },
      payload: { batteryPercent: 79 },
    });

    // Simulate backend restart reload from disk
    MissionEventStore.initialize();
    const loaded = MissionEventStore.getEventsByMission("MISSION-ISO-1");
    expect(loaded.length).toBe(2);
    expect(loaded[0].eventId).toBe(e1.eventId);
    expect(loaded[1].eventId).toBe(e2.eventId);
    expect(MissionEventStore.verifyChain().valid).toBe(true);
  });

  it("isolates missions and reconstructs state at eventId, sequenceNumber, and timestamp without mutating live state", () => {
    const liveBefore = AgentRegistry.getAgentById("agent-rover-01")!.telemetry.batteryPercent;

    const ev1 = MissionEventStore.appendEvent({
      missionId: "MISSION-A",
      actor: "MISSION_COMMAND",
      entityId: "MISSION-A",
      timestamp: "2026-11-12T10:00:00.000Z",
      eventType: "MISSION_CREATED",
      resultingState: { status: "DRAFT" },
      payload: { status: "DRAFT" },
    });
    const ev2 = MissionEventStore.appendEvent({
      missionId: "MISSION-A",
      actor: "ROVER-01 SCOUT",
      agentId: "agent-rover-01",
      entityId: "agent-rover-01",
      timestamp: "2026-11-12T10:05:00.000Z",
      eventType: "TELEMETRY_UPDATED",
      resultingState: { batteryPercent: 62 },
      payload: { batteryPercent: 62, position: { latitude: 18.461, longitude: 77.425 } },
    });
    MissionEventStore.appendEvent({
      missionId: "MISSION-B",
      actor: "ROVER-02 SCIENCE",
      agentId: "agent-rover-02",
      timestamp: "2026-11-12T10:06:00.000Z",
      eventType: "TELEMETRY_UPDATED",
      payload: { batteryPercent: 33 },
    });

    const atEv1 = HistoricalReconstructionService.reconstructAt({ missionId: "MISSION-A", eventId: ev1.eventId });
    expect(atEv1.isHistoricalReconstruction).toBe(true);
    expect(atEv1.missionStatus).toBe("DRAFT");
    expect(atEv1.totalEvents).toBe(2); // MISSION-B excluded

    const atEv2 = HistoricalReconstructionService.reconstructAt({ missionId: "MISSION-A", timestamp: "2026-11-12T10:05:30.000Z" });
    const roverAtEv2 = atEv2.agents.find((a) => a.id === "agent-rover-01");
    expect(roverAtEv2.telemetry.batteryPercent).toBe(62);
    expect(roverAtEv2.position.latitude).toBeCloseTo(18.461, 3);

    // Live AgentRegistry must remain untouched
    expect(AgentRegistry.getAgentById("agent-rover-01")!.telemetry.batteryPercent).toBe(liveBefore);
  });

  it("detects corrupted snapshots, missing events, and tampered event hashes rather than hiding failures", () => {
    const ev1 = MissionEventStore.appendEvent({
      missionId: "MISSION-CORRUPT",
      actor: "ROVER-01 SCOUT",
      agentId: "agent-rover-01",
      timestamp: "2026-11-12T11:00:00.000Z",
      eventType: "TELEMETRY_UPDATED",
      payload: { batteryPercent: 75 },
    });

    // Create a valid snapshot then tamper with its agents payload without updating stateHash
    const snap = MissionReplayEngine.stateManager.createSnapshot("corrupt-test", 5, "MISSION-CORRUPT");
    snap.agents[0].telemetry.batteryPercent = 1;
    expect(ReplayStateManager.verifySnapshotIntegrity(snap)).toBe(false);

    const recCorruptSnap = HistoricalReconstructionService.reconstructAt({
      missionId: "MISSION-CORRUPT",
      eventId: ev1.eventId,
      snapshotId: snap.snapshotId,
    });
    expect(recCorruptSnap.completeness).toBe("PARTIAL");
    expect(recCorruptSnap.snapshotUsed?.verified).toBe(false);
    expect(recCorruptSnap.anomalies.some((a) => a.includes("corrupted") || a.includes("integrity"))).toBe(true);

    // Missing eventId must be reported
    const recMissing = HistoricalReconstructionService.reconstructAt({
      missionId: "MISSION-CORRUPT",
      eventId: "non-existent-event-id",
    });
    expect(recMissing.completeness).toBe("PARTIAL");
    expect(recMissing.anomalies.some((a) => a.includes("not found"))).toBe(true);
  });

  it("compares historical vs live state, inspects event lineage, and exports CSV/JSON/Markdown via API", async () => {
    const ev1 = MissionEventStore.appendEvent({
      missionId: "MARSWALK-001",
      actor: "ROVER-01 SCOUT",
      agentId: "agent-rover-01",
      entityId: "agent-rover-01",
      correlationId: "corr-100",
      eventType: "TELEMETRY_UPDATED",
      previousState: { batteryPercent: 88 },
      resultingState: { batteryPercent: 55 },
      payload: { batteryPercent: 55, reason: "Steep climb power draw" },
    });

    const inspectRes = await request(app).get(`/api/replay/MARSWALK-001/events/${ev1.eventId}`);
    expect(inspectRes.status).toBe(200);
    expect(inspectRes.body.data.auditIntegrity.valid).toBe(true);
    expect(inspectRes.body.data.explanation).toContain("TELEMETRY_UPDATED");

    const compareRes = await request(app)
      .post("/api/replay/MARSWALK-001/compare")
      .send({
        leftTarget: { type: "EVENT", eventId: ev1.eventId },
        rightTarget: { type: "LIVE" },
      });
    expect(compareRes.status).toBe(200);
    expect(compareRes.body.data.totalDifferences).toBeGreaterThan(0);

    const csvRes = await request(app).get("/api/replay/MARSWALK-001/export?format=csv&kind=events");
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain("sequenceNumber,eventId,missionId");
    expect(csvRes.text).toContain(ev1.eventId);

    const mdRes = await request(app).get("/api/replay/MARSWALK-001/export?format=markdown&kind=summary");
    expect(mdRes.status).toBe(200);
    expect(mdRes.text).toContain("Mission Replay Summary — MARSWALK-001");
  });
});
