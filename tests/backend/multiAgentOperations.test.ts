import { describe, it, expect, beforeEach } from "vitest";
import { ResourceAllocator } from "../../backend/src/services/operations/resourceAllocator.js";
import { MultiAgentCoordinator } from "../../backend/src/services/operations/multiAgentCoordinator.js";
import { MissionOperationsEngine } from "../../backend/src/services/operations/missionOperationsEngine.js";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";

describe("Phase 4: Multi-Agent Operations & Shared Resource Coordination", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
    ResourceAllocator.clear();
    MissionOperationsEngine.resetSimulation();
  });

  it("should grant resource allocation to unallocated resources", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01")!;
    const result = ResourceAllocator.requestResource(
      "corridor-delta-01",
      "SAFE_ROUTE_CORRIDOR",
      "Delta Northern Valley Traversal Corridor",
      scout,
      60,
      45
    );

    expect(result.conflictDetected).toBe(false);
    expect(result.winnerAgentId).toBe(scout.id);
  });

  it("should prioritize Astronaut human life support over autonomous rover upon resource contention", () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01")!;
    const astronaut = AgentRegistry.getAgentById("agent-astronaut-01")!;

    // Scout claims corridor first
    ResourceAllocator.requestResource(
      "corridor-delta-01",
      "SAFE_ROUTE_CORRIDOR",
      "Delta Northern Valley Traversal Corridor",
      scout,
      50,
      60
    );

    // Astronaut requests same corridor with equal priority
    const conflictResult = ResourceAllocator.requestResource(
      "corridor-delta-01",
      "SAFE_ROUTE_CORRIDOR",
      "Delta Northern Valley Traversal Corridor",
      astronaut,
      50,
      60
    );

    expect(conflictResult.conflictDetected).toBe(true);
    expect(conflictResult.winnerAgentId).toBe(astronaut.id);
    expect(conflictResult.resolutionReason).toContain("Astronaut");
    expect(conflictResult.auditHash).toBeDefined();
  });

  it("should manage shared collaborative science queue progression and track completion", () => {
    const queue = MultiAgentCoordinator.getScienceQueue();
    expect(queue.length).toBeGreaterThanOrEqual(3);

    const firstItem = queue[0];
    const updated = MultiAgentCoordinator.updateQueueItemStatus(firstItem.id, "COMPLETED", "ROVER-02 SCIENCE");

    expect(updated.status).toBe("COMPLETED");
    expect(updated.completedAt).toBeDefined();
    expect(updated.sampleReturnPayloadId).toBeDefined();
  });

  it("should advance simulation clock and trigger rover telemetry updates", () => {
    const advanceRes = MissionOperationsEngine.advanceSimulation(15);

    expect(advanceRes.simState.simulationTimeMinutes).toBe(45);
    expect(advanceRes.network.links.length).toBeGreaterThan(0);
  });

  it("should handle emergency battery critical scenario", () => {
    const emergency = MissionOperationsEngine.triggerEmergency("BATTERY_CRITICAL");

    expect(emergency.title).toContain("Battery Critical");
    const sciRover = AgentRegistry.getAgentById("agent-rover-02")!;
    expect(sciRover.status).toBe("EMERGENCY");
  });
});
