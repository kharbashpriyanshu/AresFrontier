import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "../../backend/src/services/agents/agentRegistry.js";
import { ReplanningEngine } from "../../backend/src/services/operations/replanningEngine.js";
import { ResourceAllocator } from "../../backend/src/services/operations/resourceAllocator.js";
import { CommunicationEngine } from "../../backend/src/services/comms/communicationEngine.js";
import { MultiAgentCoordinator } from "../../backend/src/services/operations/multiAgentCoordinator.js";
import { auditChainService } from "../../backend/src/services/security/auditChainService.js";

describe("Phase 4: Multi-Agent Operations End-to-End Integration", () => {
  beforeEach(() => {
    AgentRegistry.resetAgents();
  });

  it("should execute full autonomous replanning lifecycle with Mission Command approval and audit logging", async () => {
    const scout = AgentRegistry.getAgentById("agent-rover-01")!;
    expect(scout).toBeDefined();

    // 1. Rover detects high slope hazard along traverse
    const proposal = await ReplanningEngine.triggerReplan({
      triggerType: "HAZARD_DETECTED",
      initiatorAgentId: scout.id,
      initiatorCallsign: scout.callsign,
      hazardId: "haz-jezero-delta-scarp",
      hazardDescription: "Steep 22.4° scarp exceeding rover 20° tilt threshold",
      detectedCoordinate: { latitude: 18.452, longitude: 77.428 },
      reason: "Obstacle detected by navigation cameras. Safe detour required.",
    });

    expect(proposal).toBeDefined();
    expect(proposal.status).toBe("PROPOSED");
    expect(proposal.humanApprovalRequired).toBe(true);
    expect(proposal.candidateAlternatives.length).toBeGreaterThan(0);
    expect(proposal.auditBlockHash).toBeDefined();

    // 2. Mission Command approves the recommended reroute
    const approvedProposal = ReplanningEngine.approveReplan(proposal.replanId, "FLIGHT_DIRECTOR_01");
    expect(approvedProposal.status).toBe("APPROVED");
    expect(approvedProposal.approvedBy).toBe("FLIGHT_DIRECTOR_01");

    // 3. Verify cryptographic audit chain integrity
    const chainVerification = auditChainService.verifyChain();
    expect(chainVerification.isValid).toBe(true);
  });

  it("should resolve resource contention prioritizing astronaut human safety over autonomous rovers", () => {
    const astronaut = AgentRegistry.getAgentById("agent-astronaut-01")!;
    const rover = AgentRegistry.getAgentById("agent-rover-01")!;

    // Rover initially requests corridor
    const roverRes = ResourceAllocator.requestResource(
      "corridor-delta-01",
      "SAFE_ROUTE_CORRIDOR",
      "Jezero Western Delta Traverse Corridor",
      rover,
      60
    );
    expect(roverRes.winnerAgentId).toBe(rover.id);

    // Astronaut requests the same corridor: Human crew safety must preempt rover
    const conflictRes = ResourceAllocator.requestResource(
      "corridor-delta-01",
      "SAFE_ROUTE_CORRIDOR",
      "Jezero Western Delta Traverse Corridor",
      astronaut,
      95
    );

    expect(conflictRes.conflictDetected).toBe(true);
    expect(conflictRes.winnerAgentId).toBe(astronaut.id);
    expect(conflictRes.loserAgentId).toBe(rover.id);
    expect(conflictRes.resolutionReason.toLowerCase()).toContain("astronaut");
  });

  it("should maintain communication connectivity via ROVER-03 RELAY when direct surface link is blocked", () => {
    const agents = AgentRegistry.getAllAgents();
    const topology = CommunicationEngine.evaluateNetwork(agents);

    expect(topology).toBeDefined();
    expect(topology.missionControlReachable).toBe(true);
    expect(topology.activeRelayCount).toBeGreaterThanOrEqual(1);

    // Rover 03 Relay link is active and connected
    const relayLink = topology.links.find(
      (l) => l.sourceCallsign.includes("RELAY") || l.targetCallsign.includes("RELAY")
    );
    expect(relayLink).toBeDefined();
    expect(relayLink?.status).toBe("CONNECTED");
  });

  it("should manage multi-agent science target queue workflow and complete targets", () => {
    const queue = MultiAgentCoordinator.getScienceQueue();
    expect(queue.length).toBeGreaterThan(0);

    const firstItem = queue[0];
    const assigned = MultiAgentCoordinator.updateQueueItemStatus(firstItem.id, "ASSIGNED", "ROVER-02 SCIENCE");
    expect(assigned).toBeDefined();
    expect(assigned.recommendedAgentCallsign).toBe("ROVER-02 SCIENCE");
    expect(assigned.status).toBe("ASSIGNED");

    // Complete target
    const completed = MultiAgentCoordinator.updateQueueItemStatus(firstItem.id, "COMPLETED");
    expect(completed).toBeDefined();
    expect(completed.status).toBe("COMPLETED");
    expect(completed.sampleReturnPayloadId).toBeDefined();
  });
});
